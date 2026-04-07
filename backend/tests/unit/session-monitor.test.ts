import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdirSync, writeFileSync, utimesSync } from 'fs';
import { randomUUID } from 'crypto';

// Mutable so individual tests can control which processes are "running"
let mockPsListResult: Array<{ pid: number; name: string; cmd?: string }> = [
  { pid: 9999, name: 'some-process', cmd: 'some-process' },
];

// Mutable so individual tests can control what branch getCurrentBranch returns
let mockGetCurrentBranchResult: string | null = null;

// Mutable so tests can control the homedir for JSONL path resolution without touching real ~/.claude
let mockHomedir: string = tmpdir();

vi.mock('os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('os')>();
  return { ...actual, homedir: () => mockHomedir };
});

// Mock ps-list to control which PIDs are "running"
vi.mock('ps-list', () => ({
  default: vi.fn(async () => mockPsListResult),
}));

// Mock config to avoid reading real watch dirs
vi.mock('../../src/config/config-loader.js', () => ({
  loadConfig: () => ({
    port: 7411,
    watchDirectories: [],
    sessionRetentionHours: 24,
    outputRetentionMbPerSession: 10,
    autoRegisterRepos: false,
    idleSessionThresholdMinutes: 60,
  }),
}));

// Stub out the detectors so start() doesn't touch the real filesystem
vi.mock('../../src/services/repository-scanner.js', () => ({
  RepositoryScanner: vi.fn().mockImplementation(() => ({
    scan: vi.fn(async () => []),
  })),
  getCurrentBranch: vi.fn((..._args: unknown[]) => mockGetCurrentBranchResult),
}));

vi.mock('../../src/services/copilot-cli-detector.js', () => ({
  CopilotCliDetector: vi.fn().mockImplementation(() => ({
    scan: vi.fn(async () => []),
    stopWatchers: vi.fn(),
  })),
}));

vi.mock('../../src/services/claude-code-detector.js', () => ({
  ACTIVE_JSONL_THRESHOLD_MS: 30 * 60 * 1000,
  ClaudeCodeDetector: Object.assign(
    vi.fn().mockImplementation(() => ({
      injectHooks: vi.fn(),
      scanExistingSessions: vi.fn(async () => {}),
      stopWatchers: vi.fn(),
      closeSessionWatcher: vi.fn(),
    })),
    { projectDirName: (p: string) => p.replace(/[:\\/]/g, '-') }
  ),
}));

describe('SessionMonitor.reconcileStaleSessions', () => {
  let closeDb: () => void;
  let upsertSession: (s: unknown) => void;
  let getSessions: (f: unknown) => unknown[];
  let insertRepository: (r: unknown) => void;
  let SessionMonitor: new () => { start(): Promise<void>; stop(): void };

  beforeEach(async () => {
    // Unique DB per test so state doesn't bleed between tests
    process.env.ARGUS_DB_PATH = join(tmpdir(), `argus-sm-test-${randomUUID()}.db`);
    mkdirSync(tmpdir(), { recursive: true });
    vi.resetModules();
    mockPsListResult = [{ pid: 9999, name: 'some-process', cmd: 'some-process' }];
    mockGetCurrentBranchResult = null;
    const db = await import('../../src/db/database.js');
    closeDb = db.closeDb;
    upsertSession = db.upsertSession;
    getSessions = db.getSessions as (f: unknown) => unknown[];
    insertRepository = db.insertRepository as (r: unknown) => void;
    // Insert a stub repository so sessions can satisfy the FK constraint
    insertRepository({
      id: 'repo-1',
      path: '/stub/repo',
      name: 'stub',
      source: 'ui',
      addedAt: new Date().toISOString(),
      lastScannedAt: null,
    });
    const mod = await import('../../src/services/session-monitor.js');
    SessionMonitor = mod.SessionMonitor as unknown as new () => { start(): Promise<void>; stop(): void };
  });

  afterEach(() => {
    closeDb();
    vi.resetModules();
  });

  // T094: with the new JSONL-based staleness check, a null-PID session with no JSONL file is always ended
  it('should mark null-PID Claude Code session as ended when JSONL file is missing (even when Claude is running)', async () => {
    const now = new Date().toISOString();
    mockPsListResult = [
      { pid: 9999, name: 'some-process', cmd: 'some-process' },
      { pid: 4242, name: 'claude', cmd: 'claude' },
    ];
    upsertSession({
      id: 'claude-hook-session-1',
      repositoryId: 'repo-1',
      type: 'claude-code',
      pid: null,           // <-- hook-created sessions have no PID
      status: 'active',
      startedAt: now,
      endedAt: null,
      lastActivityAt: now,
      summary: null,
      expiresAt: null,
      model: null,
    });

    const monitor = new SessionMonitor();
    await monitor.start();
    monitor.stop();

    const sessions = getSessions({}) as Array<{ id: string; status: string }>;
    const session = sessions.find(s => s.id === 'claude-hook-session-1');
    // JSONL file doesn't exist → session is stale → ended even though Claude is running
    expect(session?.status).toBe('ended');
  });

  it('should mark an active session with a dead PID as ended on startup', async () => {
    const now = new Date().toISOString();
    upsertSession({
      id: 'copilot-dead-pid-session',
      repositoryId: 'repo-1',
      type: 'copilot-cli',
      pid: 12345,          // <-- PID not in ps-list mock (only 9999 is "running")
      status: 'active',
      startedAt: now,
      endedAt: null,
      lastActivityAt: now,
      summary: null,
      expiresAt: null,
      model: null,
    });

    const monitor = new SessionMonitor();
    await monitor.start();
    monitor.stop();

    const allSessions = getSessions({}) as Array<{ id: string; status: string }>;
    const session = allSessions.find(s => s.id === 'copilot-dead-pid-session');
    expect(session?.status).toBe('ended');
  });

  // T092: active Claude Code sessions with a dead PID are ended by reconcileClaudeCodeSessions().
  it('T092: should mark an active Claude Code session with a dead PID as ended via periodic check', async () => {
    const now = new Date().toISOString();
    upsertSession({
      id: 'claude-active-dead-pid',
      repositoryId: 'repo-1',
      type: 'claude-code',
      pid: 55555,          // dead PID — not in ps-list
      status: 'active',
      startedAt: now,
      endedAt: null,
      lastActivityAt: now,
      summary: null,
      expiresAt: null,
      model: null,
    });

    const monitor = new SessionMonitor();
    await monitor.start();
    monitor.stop();

    const allSessions = getSessions({}) as Array<{ id: string; status: string }>;
    const session = allSessions.find(s => s.id === 'claude-active-dead-pid');
    expect(session?.status).toBe('ended');
  });

  // T094 regression: stale null-PID session should be ended even when another Claude process is running
  it('T094: should mark null-PID Claude Code session as ended when JSONL file is missing, even if Claude is running', async () => {
    const now = new Date().toISOString();
    // Another Claude process IS running — old code would have left this session alive
    mockPsListResult = [
      { pid: 9999, name: 'some-process', cmd: 'some-process' },
      { pid: 4242, name: 'claude', cmd: 'claude' },
    ];
    upsertSession({
      id: 'stale-null-pid-session',
      repositoryId: 'repo-1',
      type: 'claude-code',
      pid: null,
      status: 'active',
      startedAt: now,
      endedAt: null,
      lastActivityAt: now,
      summary: null,
      expiresAt: null,
      model: null,
    });

    const monitor = new SessionMonitor();
    await monitor.start();
    monitor.stop();

    const allSessions = getSessions({}) as Array<{ id: string; status: string }>;
    const session = allSessions.find(s => s.id === 'stale-null-pid-session');
    // JSONL file doesn't exist → session is stale → should be ended
    expect(session?.status).toBe('ended');
  });
});

describe('SessionMonitor.refreshRepositoryBranches', () => {
  let closeDb: () => void;
  let insertRepository: (r: unknown) => void;
  let getRepositories: () => unknown[];
  let SessionMonitor: new () => { start(): Promise<void>; stop(): void };

  beforeEach(async () => {
    process.env.ARGUS_DB_PATH = join(tmpdir(), `argus-sm-branch-test-${randomUUID()}.db`);
    mkdirSync(tmpdir(), { recursive: true });
    vi.resetModules();
    mockPsListResult = [{ pid: 9999, name: 'some-process', cmd: 'some-process' }];
    mockGetCurrentBranchResult = null;
    const db = await import('../../src/db/database.js');
    closeDb = db.closeDb;
    insertRepository = db.insertRepository as (r: unknown) => void;
    getRepositories = db.getRepositories as () => unknown[];
    const mod = await import('../../src/services/session-monitor.js');
    SessionMonitor = mod.SessionMonitor as unknown as new () => { start(): Promise<void>; stop(): void };
  });

  afterEach(() => {
    closeDb();
    vi.resetModules();
  });

  // T095 regression: branch update must propagate to DB on each scan cycle (not just on window focus)
  it('T095: should update repository branch in DB when git branch changes between scans', async () => {
    insertRepository({
      id: 'repo-branch-test',
      path: '/stub/repo',
      name: 'stub',
      source: 'ui' as const,
      addedAt: new Date().toISOString(),
      lastScannedAt: null,
      branch: 'main',
    });

    // Simulate user switching branch before the next scan cycle
    mockGetCurrentBranchResult = 'feature/my-new-branch';

    const monitor = new SessionMonitor();
    await monitor.start();
    monitor.stop();

    const repos = getRepositories() as Array<{ id: string; branch: string | null }>;
    const repo = repos.find(r => r.id === 'repo-branch-test');
    expect(repo?.branch).toBe('feature/my-new-branch');
  });

  it('T095: should not update DB when branch is unchanged', async () => {
    insertRepository({
      id: 'repo-stable-branch',
      path: '/stub/repo',
      name: 'stub',
      source: 'ui' as const,
      addedAt: new Date().toISOString(),
      lastScannedAt: null,
      branch: 'main',
    });

    mockGetCurrentBranchResult = 'main'; // same as stored

    const monitor = new SessionMonitor();
    await monitor.start();
    monitor.stop();

    const repos = getRepositories() as Array<{ id: string; branch: string | null }>;
    const repo = repos.find(r => r.id === 'repo-stable-branch');
    expect(repo?.branch).toBe('main');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests T005–T014: reconcileClaudeCodeSessions active/ended logic
// Resting display is frontend-only via isInactive(); backend uses active/ended only.
// ─────────────────────────────────────────────────────────────────────────────

describe('SessionMonitor.reconcileClaudeCodeSessions — active/ended logic', () => {
  let closeDb: () => void;
  let upsertSession: (s: unknown) => void;
  let getSessions: (f: unknown) => unknown[];
  let insertRepository: (r: unknown) => void;
  let SessionMonitor: new () => {
    start(): Promise<void>;
    stop(): void;
    on(event: string, cb: (s: unknown) => void): void;
  };

  function projectDir(): string {
    // Mirrors the mock: projectDirName('/stub/repo') = '-stub-repo'
    return join(mockHomedir, '.claude', 'projects', '-stub-repo');
  }

  function jsonlPath(sessionId: string): string {
    return join(projectDir(), `${sessionId}.jsonl`);
  }

  function createJsonlWithAge(sessionId: string, ageMinutes: number): void {
    mkdirSync(projectDir(), { recursive: true });
    const filePath = jsonlPath(sessionId);
    writeFileSync(filePath, '{}');
    const mtime = new Date(Date.now() - ageMinutes * 60 * 1000);
    utimesSync(filePath, mtime, mtime);
  }

  const baseSession = (id: string, status: string, pid: number | null) => ({
    id,
    repositoryId: 'repo-1',
    type: 'claude-code',
    pid,
    status,
    startedAt: new Date().toISOString(),
    endedAt: null,
    lastActivityAt: new Date().toISOString(),
    summary: null,
    expiresAt: null,
    model: null,
  });

  beforeEach(async () => {
    mockHomedir = join(tmpdir(), `argus-ccr-${randomUUID()}`);
    process.env.ARGUS_DB_PATH = join(tmpdir(), `argus-ccr-db-${randomUUID()}.db`);
    vi.resetModules();
    mockPsListResult = [{ pid: 9999, name: 'some-process', cmd: 'some-process' }];
    mockGetCurrentBranchResult = null;

    const db = await import('../../src/db/database.js');
    closeDb = db.closeDb;
    upsertSession = db.upsertSession;
    getSessions = db.getSessions as (f: unknown) => unknown[];
    insertRepository = db.insertRepository as (r: unknown) => void;
    insertRepository({
      id: 'repo-1', path: '/stub/repo', name: 'stub', source: 'ui',
      addedAt: new Date().toISOString(), lastScannedAt: null,
    });
    const mod = await import('../../src/services/session-monitor.js');
    SessionMonitor = mod.SessionMonitor as unknown as typeof SessionMonitor;
  });

  afterEach(() => {
    closeDb();
    vi.resetModules();
  });

  // T005: stale JSONL + alive PID → stays active (frontend shows "resting")
  it('T005: should stay active when JSONL is stale and PID is alive', async () => {
    const id = `t005-${randomUUID()}`;
    createJsonlWithAge(id, 65); // 65 min old, threshold = 60 min
    mockPsListResult = [{ pid: 9999, name: 'other' }, { pid: 12345, name: 'node', cmd: 'claude' }];
    upsertSession(baseSession(id, 'active', 12345));

    const monitor = new SessionMonitor();
    await monitor.start();
    monitor.stop();

    const result = (getSessions({}) as Array<{ id: string; status: string }>).find(s => s.id === id);
    expect(result?.status).toBe('active');
  });

  // T006: stale JSONL + dead PID → ended
  it('T006: should classify as ended when JSONL is stale and PID is dead', async () => {
    const id = `t006-${randomUUID()}`;
    createJsonlWithAge(id, 65);
    // PID 22222 not in mockPsListResult

    upsertSession(baseSession(id, 'active', 22222));

    const monitor = new SessionMonitor();
    await monitor.start();
    monitor.stop();

    const result = (getSessions({}) as Array<{ id: string; status: string }>).find(s => s.id === id);
    expect(result?.status).toBe('ended');
  });

  // T007: stale JSONL + null PID → ended
  it('T007: should classify as ended when JSONL is stale and PID is null', async () => {
    const id = `t007-${randomUUID()}`;
    createJsonlWithAge(id, 65);
    upsertSession(baseSession(id, 'active', null));

    const monitor = new SessionMonitor();
    await monitor.start();
    monitor.stop();

    const result = (getSessions({}) as Array<{ id: string; status: string }>).find(s => s.id === id);
    expect(result?.status).toBe('ended');
  });

  // T008: fresh JSONL + alive PID → active (no change)
  it('T008: should leave active session unchanged when JSONL is fresh and PID is alive', async () => {
    const id = `t008-${randomUUID()}`;
    createJsonlWithAge(id, 5); // 5 min old, well within 60-min threshold
    mockPsListResult = [{ pid: 9999, name: 'other' }, { pid: 33333, name: 'node' }];
    upsertSession(baseSession(id, 'active', 33333));

    const monitor = new SessionMonitor();
    await monitor.start();
    monitor.stop();

    const result = (getSessions({}) as Array<{ id: string; status: string }>).find(s => s.id === id);
    expect(result?.status).toBe('active');
  });

  // T009: missing JSONL + alive PID → ended (file gone = session over)
  it('T009: should classify as ended when JSONL file is missing, even if PID is alive', async () => {
    const id = `t009-${randomUUID()}`;
    // No JSONL file created
    mockPsListResult = [{ pid: 9999, name: 'other' }, { pid: 44444, name: 'node' }];
    upsertSession(baseSession(id, 'active', 44444));

    const monitor = new SessionMonitor();
    await monitor.start();
    monitor.stop();

    const result = (getSessions({}) as Array<{ id: string; status: string }>).find(s => s.id === id);
    expect(result?.status).toBe('ended');
  });

  // T011: startup reconcileStaleSessions — idle session + dead PID → ended
  it('T011: startup sweep should end idle session whose PID has died', async () => {
    const id = `t011-${randomUUID()}`;
    // PID 66666 not in mockPsListResult

    upsertSession(baseSession(id, 'idle', 66666));

    const monitor = new SessionMonitor();
    await monitor.start();
    monitor.stop();

    const result = (getSessions({}) as Array<{ id: string; status: string }>).find(s => s.id === id);
    expect(result?.status).toBe('ended');
  });

  // T012: startup reconcileStaleSessions — idle session + alive PID → unchanged
  it('T012: startup sweep should leave idle session unchanged when PID is still alive', async () => {
    const id = `t012-${randomUUID()}`;
    createJsonlWithAge(id, 65); // stale, but PID alive
    mockPsListResult = [{ pid: 9999, name: 'other' }, { pid: 77777, name: 'node' }];
    upsertSession(baseSession(id, 'idle', 77777));

    const monitor = new SessionMonitor();
    await monitor.start();
    monitor.stop();

    const result = (getSessions({}) as Array<{ id: string; status: string }>).find(s => s.id === id);
    expect(result?.status).toBe('idle');
  });

  // T014: threshold read from config (60 min), not hardcoded constant (30 min)
  it('T014: should use config threshold (60 min) — 31-min-old null-PID session stays active', async () => {
    const id = `t014-${randomUUID()}`;
    createJsonlWithAge(id, 31); // 31 min old: beyond 30-min constant but within 60-min config threshold
    upsertSession(baseSession(id, 'active', null));

    const monitor = new SessionMonitor();
    await monitor.start();
    monitor.stop();

    const result = (getSessions({}) as Array<{ id: string; status: string }>).find(s => s.id === id);
    // New code reads 60-min config → 31 < 60 → fresh → active (no change)
    // Old code used 30-min constant → 31 > 30 → stale → ended
    expect(result?.status).toBe('active');
  });
});
