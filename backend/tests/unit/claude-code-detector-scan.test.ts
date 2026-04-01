import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';

// Mock ps-list: use a mutable variable so individual tests can override
let mockPsListResult: Array<{ pid: number; name: string; cmd?: string }> = [
  { pid: 4242, name: 'claude', cmd: 'claude' },
];
vi.mock('ps-list', () => ({
  default: vi.fn(async () => mockPsListResult),
}));

const FAKE_REPO_PATH = 'C:\\testproject';
// Claude dir naming: replace :, \, / with hyphens → 'C--testproject'
const FAKE_DIR_NAME = FAKE_REPO_PATH.replace(/[:\\/]/g, '-');

// Mock fs so we control what project directories the detector "sees"
// readdirSync returns a fake Claude project dir matching FAKE_REPO_PATH
let fakeReaddirEntries: Array<{ name: string; isDirectory: () => boolean }> = [];
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    existsSync: vi.fn(() => true),
    readdirSync: vi.fn((_p: unknown, _opts?: unknown) => fakeReaddirEntries),
  };
});

describe('ClaudeCodeDetector.scanExistingSessions', () => {
  let dbModule: typeof import('../../src/db/database.js');

  beforeEach(async () => {
    process.env.ARGUS_DB_PATH = join(tmpdir(), `argus-claude-scan-test-${randomUUID()}.db`);
    vi.resetModules();

    // Reset to default: Claude is running
    mockPsListResult = [{ pid: 4242, name: 'claude', cmd: 'claude' }];

    dbModule = await import('../../src/db/database.js');

    // Reset fake dir entries to the default (one matching dir)
    fakeReaddirEntries = [{ name: FAKE_DIR_NAME, isDirectory: () => true }];

    // Insert a repo matching FAKE_REPO_PATH
    dbModule.insertRepository({
      id: 'repo-scan-test',
      path: FAKE_REPO_PATH,
      name: 'scan-test',
      source: 'ui',
      addedAt: new Date().toISOString(),
      lastScannedAt: null,
    });
  });

  afterEach(() => {
    dbModule.closeDb();
    vi.resetModules();
  });

  it('re-activates an ended session when Claude is running and project dir exists', async () => {
    const now = new Date().toISOString();
    dbModule.upsertSession({
      id: 'hook-session-was-ended',
      repositoryId: 'repo-scan-test',
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

    const session = dbModule.getSession('hook-session-was-ended');
    expect(session?.status).toBe('active');
  });

  it('creates a new session when Claude is running and no prior session exists', async () => {
    const { ClaudeCodeDetector } = await import('../../src/services/claude-code-detector.js');
    await new ClaudeCodeDetector().scanExistingSessions();

    const sessions = dbModule.getSessions({ repositoryId: 'repo-scan-test', type: 'claude-code' });
    expect(sessions.length).toBeGreaterThan(0);
    expect(sessions[0].status).toBe('active');
  });

  it('does nothing when no Claude process is running', async () => {
    mockPsListResult = [{ pid: 1, name: 'other-process', cmd: 'other-process' }];

    const now = new Date().toISOString();
    dbModule.upsertSession({
      id: 'hook-session-no-claude',
      repositoryId: 'repo-scan-test',
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

    const session = dbModule.getSession('hook-session-no-claude');
    expect(session?.status).toBe('ended');
  });
});

