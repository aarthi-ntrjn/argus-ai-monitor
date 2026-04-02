import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdirSync } from 'fs';
import { randomUUID } from 'crypto';

// Mutable so individual tests can control which processes are "running"
let mockPsListResult: Array<{ pid: number; name: string; cmd?: string }> = [
  { pid: 9999, name: 'some-process', cmd: 'some-process' },
];

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
}));

vi.mock('../../src/services/copilot-cli-detector.js', () => ({
  CopilotCliDetector: vi.fn().mockImplementation(() => ({
    scan: vi.fn(async () => []),
    stopWatchers: vi.fn(),
  })),
}));

vi.mock('../../src/services/claude-code-detector.js', () => ({
  ClaudeCodeDetector: vi.fn().mockImplementation(() => ({
    injectHooks: vi.fn(),
    scanExistingSessions: vi.fn(async () => {}),
    stopWatchers: vi.fn(),
  })),
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

  it('should NOT mark an active Claude Code session (pid: null) as ended on startup when Claude is running', async () => {
    const now = new Date().toISOString();
    // Claude IS running — session should stay alive
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
    expect(session?.status).toBe('active');
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

  // T092: idle status no longer exists for Claude Code — remove this test scenario.
  // Active Claude Code sessions with a dead PID are ended by reconcileClaudeCodeSessions().
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

  // T091 regression: null-PID Claude Code sessions end when no Claude process is running
  it('T091: should mark null-PID Claude Code session as ended when no Claude process is running', async () => {
    const now = new Date().toISOString();
    // No Claude process in the mock — only unrelated processes
    mockPsListResult = [{ pid: 9999, name: 'some-process', cmd: 'some-process' }];
    upsertSession({
      id: 'claude-null-pid-session',
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
    const session = allSessions.find(s => s.id === 'claude-null-pid-session');
    expect(session?.status).toBe('ended');
  });
});
