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

// Mutable statSync mtime — individual tests can override
let mockMtime = new Date(); // recent by default

// JSONL files to return when readdirSync is called on the project dir
let fakeJsonlFiles: string[] = ['test-session-abc123.jsonl'];

// Mock fs: readdirSync returns project-dir entries when called with withFileTypes,
// and JSONL filenames when called on the individual project dir
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    existsSync: vi.fn(() => true),
    readdirSync: vi.fn((_p: unknown, opts?: unknown) => {
      if (opts && typeof opts === 'object' && 'withFileTypes' in opts) {
        // Called on projectsDir — return the project directory listing
        return [{ name: FAKE_DIR_NAME, isDirectory: () => true }];
      }
      // Called on an individual project dir — return JSONL filenames
      return fakeJsonlFiles;
    }),
    statSync: vi.fn(() => ({ mtime: mockMtime, size: 0 })),
  };
});

describe('ClaudeCodeDetector.scanExistingSessions', () => {
  let dbModule: typeof import('../../src/db/database.js');

  beforeEach(async () => {
    process.env.ARGUS_DB_PATH = join(tmpdir(), `argus-claude-scan-test-${randomUUID()}.db`);
    vi.resetModules();

    // Reset to default: Claude is running, mtime is recent
    mockPsListResult = [{ pid: 4242, name: 'claude', cmd: 'claude' }];
    mockMtime = new Date();
    fakeJsonlFiles = ['test-session-abc123.jsonl'];

    dbModule = await import('../../src/db/database.js');

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

  it('re-activates an ended session when Claude is running and JSONL file is recent', async () => {
    mockMtime = new Date(); // recent
    const now = new Date().toISOString();
    const sessionId = 'hook-session-was-ended';
    fakeJsonlFiles = [`${sessionId}.jsonl`];
    dbModule.upsertSession({
      id: sessionId,
      repositoryId: 'repo-scan-test',
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
  });

  it('does NOT re-activate an ended session when JSONL file is older than 30 minutes', async () => {
    // Set mtime to 31 minutes ago
    mockMtime = new Date(Date.now() - 31 * 60 * 1000);
    const now = new Date().toISOString();
    const sessionId = 'hook-session-stale-mtime';
    fakeJsonlFiles = [`${sessionId}.jsonl`];
    dbModule.upsertSession({
      id: sessionId,
      repositoryId: 'repo-scan-test',
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
    expect(session?.status).toBe('ended');
  });

  it('does NOT re-activate when no JSONL files exist in the project dir', async () => {
    fakeJsonlFiles = []; // no JSONL files
    const now = new Date().toISOString();
    const sessionId = 'hook-session-no-jsonl';
    dbModule.upsertSession({
      id: sessionId,
      repositoryId: 'repo-scan-test',
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
    expect(session?.status).toBe('ended');
  });

  it('creates a new session with the JSONL filename as ID when Claude is running and no prior session exists', async () => {
    fakeJsonlFiles = ['brand-new-session-xyz.jsonl'];

    const { ClaudeCodeDetector } = await import('../../src/services/claude-code-detector.js');
    await new ClaudeCodeDetector().scanExistingSessions();

    const session = dbModule.getSession('brand-new-session-xyz');
    expect(session).not.toBeUndefined();
    expect(session?.status).toBe('active');
  });

  it('does nothing when no Claude process is running', async () => {
    mockPsListResult = [{ pid: 1, name: 'other-process', cmd: 'other-process' }];
    const now = new Date().toISOString();
    const sessionId = 'hook-session-no-claude';
    fakeJsonlFiles = [`${sessionId}.jsonl`];
    dbModule.upsertSession({
      id: sessionId,
      repositoryId: 'repo-scan-test',
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
    expect(session?.status).toBe('ended');
  });

  // T089 regression: scanExistingSessions must use JSONL filename as session ID,
  // not the old ended-session ID or a fake claude-startup-* ID
  it('T089: activates with real JSONL-derived session ID, not old DB ID or fake startup ID', async () => {
    const realSessionId = 'real-new-claude-session-abc123';
    fakeJsonlFiles = [`${realSessionId}.jsonl`];

    // Insert an OLD ended session with a different ID (simulates previous run)
    const now = new Date().toISOString();
    dbModule.upsertSession({
      id: 'old-ended-session-from-last-run',
      repositoryId: 'repo-scan-test',
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

    // The new session MUST be created with the real JSONL-derived ID
    const newSession = dbModule.getSession(realSessionId);
    expect(newSession).not.toBeUndefined();
    expect(newSession?.status).toBe('active');

    // The old ended session must NOT be re-activated
    const oldSession = dbModule.getSession('old-ended-session-from-last-run');
    expect(oldSession?.status).toBe('ended');

    // No fake claude-startup-* sessions must exist
    const allSessions = dbModule.getSessions({ repositoryId: 'repo-scan-test' });
    const fakeSession = allSessions.find(s => s.id.startsWith('claude-startup-'));
    expect(fakeSession).toBeUndefined();
  });
});

describe('ClaudeCodeDetector.handleHookPayload — Stop hook', () => {
  let dbModule: typeof import('../../src/db/database.js');

  beforeEach(async () => {
    process.env.ARGUS_DB_PATH = join(tmpdir(), `argus-claude-hook-test-${randomUUID()}.db`);
    vi.resetModules();
    mockMtime = new Date();
    fakeJsonlFiles = ['stop-test-session.jsonl'];
    dbModule = await import('../../src/db/database.js');
    dbModule.insertRepository({
      id: 'repo-hook-test',
      path: FAKE_REPO_PATH,
      name: 'hook-test',
      source: 'ui',
      addedAt: new Date().toISOString(),
      lastScannedAt: null,
    });
  });

  afterEach(() => {
    dbModule.closeDb();
    vi.resetModules();
  });

  // T090/T092: Stop hook fires at end of every AI turn, NOT session exit.
  // Session must stay 'active' (not idle or ended) — resting display is UI-only via isInactive().
  it('T092: Stop hook keeps session active and updates lastActivityAt, not ended or idle', async () => {
    const sessionId = 'stop-test-session';
    const before = new Date(Date.now() - 5000).toISOString();
    dbModule.upsertSession({
      id: sessionId,
      repositoryId: 'repo-hook-test',
      type: 'claude-code',
      pid: null,
      status: 'active',
      startedAt: before,
      endedAt: null,
      lastActivityAt: before,
      summary: null,
      expiresAt: null,
      model: null,
    });

    const { ClaudeCodeDetector } = await import('../../src/services/claude-code-detector.js');
    const detector = new ClaudeCodeDetector();
    await detector.handleHookPayload({
      hook_event_name: 'Stop',
      session_id: sessionId,
      cwd: FAKE_REPO_PATH,
    });

    const session = dbModule.getSession(sessionId);
    expect(session?.status).toBe('active');
    expect(session?.endedAt).toBeNull();
    expect(session?.lastActivityAt).not.toBe(before);
  });

  it('T092: PreToolUse hook keeps session active', async () => {
    const sessionId = 'stop-test-session';
    const now = new Date().toISOString();
    dbModule.upsertSession({
      id: sessionId,
      repositoryId: 'repo-hook-test',
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

    const { ClaudeCodeDetector } = await import('../../src/services/claude-code-detector.js');
    const detector = new ClaudeCodeDetector();
    await detector.handleHookPayload({
      hook_event_name: 'PreToolUse',
      session_id: sessionId,
      cwd: FAKE_REPO_PATH,
    });

    const session = dbModule.getSession(sessionId);
    expect(session?.status).toBe('active');
  });
});


describe('ClaudeCodeDetector — PTY session deduplication (T029)', () => {
  let dbModule: typeof import('../../src/db/database.js');

  beforeEach(async () => {
    process.env.ARGUS_DB_PATH = join(tmpdir(), `argus-pty-dedup-test-${randomUUID()}.db`);
    vi.resetModules();
    mockPsListResult = [{ pid: 4242, name: 'claude', cmd: 'claude' }];
    mockMtime = new Date();
    fakeJsonlFiles = ['test-session-abc123.jsonl'];
    dbModule = await import('../../src/db/database.js');
    dbModule.insertRepository({
      id: 'repo-dedup-test',
      path: FAKE_REPO_PATH,
      name: 'dedup-test',
      source: 'ui',
      addedAt: new Date().toISOString(),
      lastScannedAt: null,
    });
  });

  afterEach(() => {
    dbModule.closeDb();
    vi.resetModules();
  });

  it('handleHookPayload does NOT create a detected session when an active PTY session exists for the same repo', async () => {
    const ptySessionId = 'pty-session-uuid-1234';
    const claudeSessionId = 'claude-internal-session-e4d9';
    const now = new Date().toISOString();

    dbModule.upsertSession({
      id: ptySessionId,
      repositoryId: 'repo-dedup-test',
      type: 'claude-code',
      launchMode: 'pty',
      pid: 8348,
      status: 'active',
      startedAt: now,
      endedAt: null,
      lastActivityAt: now,
      summary: null,
      expiresAt: null,
      model: null,
    });

    const { ClaudeCodeDetector } = await import('../../src/services/claude-code-detector.js');
    await new ClaudeCodeDetector().handleHookPayload({
      hook_event_name: 'SessionStart',
      session_id: claudeSessionId,
      cwd: FAKE_REPO_PATH,
    });

    expect(dbModule.getSession(claudeSessionId)).toBeUndefined();
    expect(dbModule.getSession(ptySessionId)?.status).toBe('active');
  });

  it('scanExistingSessions does NOT create a detected session when an active PTY session exists for the same repo', async () => {
    const ptySessionId = 'pty-session-uuid-5678';
    const claudeSessionId = 'claude-scan-session-abcd';
    const now = new Date().toISOString();
    fakeJsonlFiles = [`${claudeSessionId}.jsonl`];

    dbModule.upsertSession({
      id: ptySessionId,
      repositoryId: 'repo-dedup-test',
      type: 'claude-code',
      launchMode: 'pty',
      pid: 8348,
      status: 'active',
      startedAt: now,
      endedAt: null,
      lastActivityAt: now,
      summary: null,
      expiresAt: null,
      model: null,
    });

    const { ClaudeCodeDetector } = await import('../../src/services/claude-code-detector.js');
    await new ClaudeCodeDetector().scanExistingSessions();

    expect(dbModule.getSession(claudeSessionId)).toBeUndefined();
    expect(dbModule.getSession(ptySessionId)?.status).toBe('active');
  });
});
