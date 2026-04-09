import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdirSync } from 'fs';
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
    scanLockEntries: vi.fn(() => new Map()),
    stopWatchers: vi.fn(),
  })),
}));

vi.mock('../../src/services/claude-code-detector.js', () => ({
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
    SessionMonitor = mod.SessionMonitor as unknown as typeof SessionMonitor;
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

  const baseSession = (id: string, status: string, pid: number | null, ageMs = 0) => ({
    id,
    repositoryId: 'repo-1',
    type: 'claude-code',
    launchMode: null,
    pid,
    pidSource: pid != null ? ('session_registry' as const) : null,
    status,
    startedAt: new Date(Date.now() - ageMs).toISOString(),
    endedAt: null,
    lastActivityAt: new Date(Date.now() - ageMs).toISOString(),
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

  // T005: alive PID → stays active
  it('T005: should stay active when PID is alive', async () => {
    const id = `t005-${randomUUID()}`;
    mockPsListResult = [{ pid: 9999, name: 'other' }, { pid: 12345, name: 'node', cmd: 'claude' }];
    upsertSession(baseSession(id, 'active', 12345));

    const monitor = new SessionMonitor();
    await monitor.start();
    monitor.stop();

    const result = (getSessions({}) as Array<{ id: string; status: string }>).find(s => s.id === id);
    expect(result?.status).toBe('active');
  });

  // T006: dead PID → ended
  it('T006: should classify as ended when PID is dead', async () => {
    const id = `t006-${randomUUID()}`;
    // PID 22222 not in mockPsListResult
    upsertSession(baseSession(id, 'active', 22222));

    const monitor = new SessionMonitor();
    await monitor.start();
    monitor.stop();

    const result = (getSessions({}) as Array<{ id: string; status: string }>).find(s => s.id === id);
    expect(result?.status).toBe('ended');
  });

  // T008: fresh PID alive → active (no change)
  it('T008: should leave active session unchanged when PID is alive', async () => {
    const id = `t008-${randomUUID()}`;
    mockPsListResult = [{ pid: 9999, name: 'other' }, { pid: 33333, name: 'node' }];
    upsertSession(baseSession(id, 'active', 33333));

    const monitor = new SessionMonitor();
    await monitor.start();
    monitor.stop();

    const result = (getSessions({}) as Array<{ id: string; status: string }>).find(s => s.id === id);
    expect(result?.status).toBe('active');
  });

  // T009: PID alive → session stays active
  it('T009: should keep session active when PID is alive', async () => {
    const id = `t009-${randomUUID()}`;
    mockPsListResult = [{ pid: 9999, name: 'other' }, { pid: 44444, name: 'node' }];
    upsertSession(baseSession(id, 'active', 44444));

    const monitor = new SessionMonitor();
    await monitor.start();
    monitor.stop();

    const result = (getSessions({}) as Array<{ id: string; status: string }>).find(s => s.id === id);
    expect(result?.status).toBe('active');
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

  // T012: startup reconcileStaleSessions — idle session + alive PID → active (reconciliation promotes to active)
  it('T012: startup sweep should mark idle session as active when PID is still alive', async () => {
    const id = `t012-${randomUUID()}`;
    mockPsListResult = [{ pid: 9999, name: 'other' }, { pid: 77777, name: 'node' }];
    upsertSession(baseSession(id, 'idle', 77777));

    const monitor = new SessionMonitor();
    await monitor.start();
    monitor.stop();

    const result = (getSessions({}) as Array<{ id: string; status: string }>).find(s => s.id === id);
    expect(result?.status).toBe('active');
  });
});
