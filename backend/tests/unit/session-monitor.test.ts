import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdirSync } from 'fs';
import { randomUUID } from 'crypto';

// Mock ps-list to control which PIDs are "running"
vi.mock('ps-list', () => ({
  default: vi.fn(async () => [
    { pid: 9999, name: 'some-process', cmd: 'some-process' },
  ]),
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
  })),
}));

vi.mock('../../src/services/claude-code-detector.js', () => ({
  ClaudeCodeDetector: vi.fn().mockImplementation(() => ({
    injectHooks: vi.fn(),
    scanExistingSessions: vi.fn(async () => {}),
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

  it('should NOT mark an active Claude Code session (pid: null) as ended on startup', async () => {
    const now = new Date().toISOString();
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
    });

    const monitor = new SessionMonitor();
    await monitor.start();
    monitor.stop();

    const sessions = getSessions({ status: 'active' }) as Array<{ id: string; status: string }>;
    const session = sessions.find(s => s.id === 'claude-hook-session-1');
    expect(session, 'Claude hook session should still be active after startup').toBeDefined();
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
    });

    const monitor = new SessionMonitor();
    await monitor.start();
    monitor.stop();

    const allSessions = getSessions({}) as Array<{ id: string; status: string }>;
    const session = allSessions.find(s => s.id === 'copilot-dead-pid-session');
    expect(session?.status).toBe('ended');
  });
});
