import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';

// Mutable so individual tests can override
let mockPsListResult: Array<{ pid: number; name: string; cmd?: string }> = [];
vi.mock('ps-list', () => ({
  default: vi.fn(async () => mockPsListResult),
}));

const FAKE_REPO_PATH = 'C:\\pidtestproject';
const FAKE_DIR_NAME = FAKE_REPO_PATH.replace(/[:\\/]/g, '-');

let fakeReaddirEntries: Array<{ name: string; isDirectory: () => boolean }> = [];
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    existsSync: vi.fn(() => true),
    readdirSync: vi.fn((_p: unknown, _opts?: unknown) => fakeReaddirEntries),
  };
});

describe('ClaudeCodeDetector - PID capture', () => {
  let dbModule: typeof import('../../src/db/database.js');

  beforeEach(async () => {
    process.env.ARGUS_DB_PATH = join(tmpdir(), `argus-pid-test-${randomUUID()}.db`);
    vi.resetModules();

    fakeReaddirEntries = [{ name: FAKE_DIR_NAME, isDirectory: () => true }];

    dbModule = await import('../../src/db/database.js');
    dbModule.insertRepository({
      id: 'repo-pid-test',
      path: FAKE_REPO_PATH,
      name: 'pid-test',
      source: 'ui',
      addedAt: new Date().toISOString(),
      lastScannedAt: null,
    });
  });

  afterEach(() => {
    dbModule.closeDb();
    vi.resetModules();
  });

  it('stores the OS PID on a newly created session when Claude process is found', async () => {
    mockPsListResult = [{ pid: 9999, name: 'claude', cmd: '/usr/bin/claude' }];

    const { ClaudeCodeDetector } = await import('../../src/services/claude-code-detector.js');
    await new ClaudeCodeDetector().scanExistingSessions();

    const sessions = dbModule.getSessions({ repositoryId: 'repo-pid-test', type: 'claude-code' });
    expect(sessions.length).toBeGreaterThan(0);
    expect(sessions[0].pid).toBe(9999);
  });

  it('stores the OS PID when re-activating an ended session', async () => {
    mockPsListResult = [{ pid: 7777, name: 'claude', cmd: 'claude' }];
    const now = new Date().toISOString();
    dbModule.upsertSession({
      id: 'pid-reactivate-session',
      repositoryId: 'repo-pid-test',
      type: 'claude-code',
      pid: null,
      status: 'ended',
      startedAt: now,
      endedAt: now,
      lastActivityAt: now,
      summary: null,
      expiresAt: null,
    });

    const { ClaudeCodeDetector } = await import('../../src/services/claude-code-detector.js');
    await new ClaudeCodeDetector().scanExistingSessions();

    const session = dbModule.getSession('pid-reactivate-session');
    expect(session?.status).toBe('active');
    expect(session?.pid).toBe(7777);
  });

  it('leaves pid null when no Claude process is running', async () => {
    mockPsListResult = [{ pid: 1, name: 'bash', cmd: 'bash' }];
    const now = new Date().toISOString();
    dbModule.upsertSession({
      id: 'pid-noclaud-session',
      repositoryId: 'repo-pid-test',
      type: 'claude-code',
      pid: null,
      status: 'ended',
      startedAt: now,
      endedAt: now,
      lastActivityAt: now,
      summary: null,
      expiresAt: null,
    });

    const { ClaudeCodeDetector } = await import('../../src/services/claude-code-detector.js');
    await new ClaudeCodeDetector().scanExistingSessions();

    const session = dbModule.getSession('pid-noclaud-session');
    // Session should remain ended — no Claude process
    expect(session?.status).toBe('ended');
    expect(session?.pid).toBeNull();
  });

  it('detects Claude process by cmd when name does not match', async () => {
    mockPsListResult = [{ pid: 5555, name: 'node', cmd: '/usr/local/bin/claude --version' }];

    const { ClaudeCodeDetector } = await import('../../src/services/claude-code-detector.js');
    await new ClaudeCodeDetector().scanExistingSessions();

    const sessions = dbModule.getSessions({ repositoryId: 'repo-pid-test', type: 'claude-code' });
    expect(sessions.length).toBeGreaterThan(0);
    expect(sessions[0].pid).toBe(5555);
  });
});
