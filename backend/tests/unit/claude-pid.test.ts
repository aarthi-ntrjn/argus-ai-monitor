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

// JSONL files to return for individual project dir listings
let fakeJsonlFiles: string[] = ['default-session.jsonl'];

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    existsSync: vi.fn(() => true),
    readdirSync: vi.fn((_p: unknown, opts?: unknown) => {
      if (opts && typeof opts === 'object' && 'withFileTypes' in opts) {
        return [{ name: FAKE_DIR_NAME, isDirectory: () => true }];
      }
      return fakeJsonlFiles;
    }),
    statSync: vi.fn(() => ({ mtime: new Date(), size: 0 })),
  };
});

describe('ClaudeCodeDetector - PID capture', () => {
  let dbModule: typeof import('../../src/db/database.js');

  beforeEach(async () => {
    process.env.ARGUS_DB_PATH = join(tmpdir(), `argus-pid-test-${randomUUID()}.db`);
    vi.resetModules();

    fakeJsonlFiles = ['default-session.jsonl'];

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
    fakeJsonlFiles = ['new-pid-session.jsonl'];

    const { ClaudeCodeDetector } = await import('../../src/services/claude-code-detector.js');
    await new ClaudeCodeDetector().scanExistingSessions();

    const sessions = dbModule.getSessions({ repositoryId: 'repo-pid-test', type: 'claude-code' });
    expect(sessions.length).toBeGreaterThan(0);
    expect(sessions[0].pid).toBe(9999);
  });

  it('stores the OS PID when re-activating an ended session', async () => {
    mockPsListResult = [{ pid: 7777, name: 'claude', cmd: 'claude' }];
    const now = new Date().toISOString();
    const sessionId = 'pid-reactivate-session';
    fakeJsonlFiles = [`${sessionId}.jsonl`];
    dbModule.upsertSession({
      id: sessionId,
      repositoryId: 'repo-pid-test',
      type: 'claude-code',
      pid: null,
      status: 'ended',
      startedAt: now,
      endedAt: now,
      lastActivityAt: now,
      summary: null,
      expiresAt: null,
      model: null,
    });

    const { ClaudeCodeDetector } = await import('../../src/services/claude-code-detector.js');
    await new ClaudeCodeDetector().scanExistingSessions();

    const session = dbModule.getSession(sessionId);
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
      model: null,
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
    fakeJsonlFiles = ['cmd-detect-session.jsonl'];

    const { ClaudeCodeDetector } = await import('../../src/services/claude-code-detector.js');
    await new ClaudeCodeDetector().scanExistingSessions();

    const sessions = dbModule.getSessions({ repositoryId: 'repo-pid-test', type: 'claude-code' });
    expect(sessions.length).toBeGreaterThan(0);
    expect(sessions[0].pid).toBe(5555);
  });
});
