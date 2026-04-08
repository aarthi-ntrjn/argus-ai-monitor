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

// Fake session registry: maps session IDs to registry JSON content.
// scanExistingSessions now cross-references ~/.claude/sessions/ to filter dead sessions.
let fakeRegistryEntries: Record<string, { pid: number; sessionId: string; cwd: string }> = {};

// Mock fs: readdirSync returns project-dir entries when called with withFileTypes,
// JSONL filenames for project dirs, and registry JSON files for the sessions dir
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    existsSync: vi.fn(() => true),
    readdirSync: vi.fn((p: unknown, opts?: unknown) => {
      const pathStr = String(p);
      if (opts && typeof opts === 'object' && 'withFileTypes' in opts) {
        return [{ name: FAKE_DIR_NAME, isDirectory: () => true }];
      }
      // Session registry directory
      if (pathStr.includes('sessions')) {
        return Object.values(fakeRegistryEntries).map(e => `${e.pid}.json`);
      }
      return fakeJsonlFiles;
    }),
    readFileSync: vi.fn((p: unknown, _enc?: unknown) => {
      const pathStr = String(p);
      // Session registry JSON files
      if (pathStr.includes('sessions') && pathStr.endsWith('.json')) {
        const pid = parseInt(pathStr.replace(/^.*[/\\](\d+)\.json$/, '$1'), 10);
        const entry = Object.values(fakeRegistryEntries).find(e => e.pid === pid);
        if (entry) return JSON.stringify({ ...entry, startedAt: Date.now(), kind: 'interactive', entrypoint: 'cli' });
      }
      return actual.readFileSync(p as string, _enc as string);
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
    fakeRegistryEntries = { 'test-session-abc123': { pid: 4242, sessionId: 'test-session-abc123', cwd: FAKE_REPO_PATH } };

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
    fakeRegistryEntries = { [sessionId]: { pid: 4242, sessionId, cwd: FAKE_REPO_PATH } };
    dbModule.upsertSession({
      id: sessionId,
      repositoryId: 'repo-scan-test',
      type: 'claude-code',
      launchMode: null,
      pid: null,
      pidSource: null,
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

  it('re-activates an ended session even when JSONL file is older than 30 minutes, if Claude is running', async () => {
    // mtime is stale but Claude is running — startup scan activates it;
    // reconcileClaudeCodeSessions (running every 5 s) will end it if the PID is dead.
    mockMtime = new Date(Date.now() - 31 * 60 * 1000);
    const now = new Date().toISOString();
    const sessionId = 'hook-session-stale-mtime';
    fakeJsonlFiles = [`${sessionId}.jsonl`];
    fakeRegistryEntries = { [sessionId]: { pid: 4242, sessionId, cwd: FAKE_REPO_PATH } };
    dbModule.upsertSession({
      id: sessionId,
      repositoryId: 'repo-scan-test',
      type: 'claude-code',
      launchMode: null,
      pid: null,
      pidSource: null,
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
    fakeRegistryEntries = { 'brand-new-session-xyz': { pid: 4242, sessionId: 'brand-new-session-xyz', cwd: FAKE_REPO_PATH } };

    const { ClaudeCodeDetector } = await import('../../src/services/claude-code-detector.js');
    await new ClaudeCodeDetector().scanExistingSessions();

    const session = dbModule.getSession('brand-new-session-xyz');
    expect(session).not.toBeUndefined();
    expect(session?.status).toBe('active');
  });

  it('re-activates ended session when JSONL exists (PID handled by registry, not psList)', async () => {
    mockPsListResult = [{ pid: 1, name: 'other-process', cmd: 'other-process' }];
    const now = new Date().toISOString();
    const sessionId = 'hook-session-no-claude';
    fakeJsonlFiles = [`${sessionId}.jsonl`];
    fakeRegistryEntries = { [sessionId]: { pid: 9999, sessionId, cwd: FAKE_REPO_PATH } };
    dbModule.upsertSession({
      id: sessionId,
      repositoryId: 'repo-scan-test',
      type: 'claude-code',
      launchMode: null,
      pid: null,
      pidSource: null,
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
    // scanExistingSessions no longer checks psList — it activates JSONL sessions
    // and leaves PID assignment to the session registry scanner
    expect(session?.status).toBe('active');
    expect(session?.pid).toBeNull();
  });

  // T089 regression: scanExistingSessions must use JSONL filename as session ID,
  // not the old ended-session ID or a fake claude-startup-* ID
  it('T089: activates with real JSONL-derived session ID, not old DB ID or fake startup ID', async () => {
    const realSessionId = 'real-new-claude-session-abc123';
    fakeJsonlFiles = [`${realSessionId}.jsonl`];
    fakeRegistryEntries = { [realSessionId]: { pid: 4242, sessionId: realSessionId, cwd: FAKE_REPO_PATH } };

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


describe('ClaudeCodeDetector — PTY claim on first hook (T029 redesign)', () => {
  let dbModule: typeof import('../../src/db/database.js');
  let ptyRegistryModule: typeof import('../../src/services/pty-registry.js');

  beforeEach(async () => {
    process.env.ARGUS_DB_PATH = join(tmpdir(), `argus-pty-claim-test-${randomUUID()}.db`);
    vi.resetModules();
    mockPsListResult = [{ pid: 4242, name: 'claude', cmd: 'claude' }];
    mockMtime = new Date();
    fakeJsonlFiles = ['test-session-abc123.jsonl'];
    dbModule = await import('../../src/db/database.js');
    ptyRegistryModule = await import('../../src/services/pty-registry.js');
    dbModule.insertRepository({
      id: 'repo-claim-test',
      path: FAKE_REPO_PATH,
      name: 'claim-test',
      source: 'ui',
      addedAt: new Date().toISOString(),
      lastScannedAt: null,
    });
  });

  afterEach(() => {
    dbModule.closeDb();
    vi.resetModules();
  });

  it('handleHookPayload creates a single launchMode=pty session using Claude\'s real session ID when a launcher is pending', async () => {
    const claudeSessionId = 'claude-real-session-e4d9';
    const mockWs = { send: vi.fn(), readyState: 1 };

    // Simulate: launcher registered but no DB session yet
    ptyRegistryModule.ptyRegistry.registerPending('temp-uuid', mockWs as any, FAKE_REPO_PATH, 8348);

    const { ClaudeCodeDetector } = await import('../../src/services/claude-code-detector.js');
    await new ClaudeCodeDetector().handleHookPayload({
      hook_event_name: 'SessionStart',
      session_id: claudeSessionId,
      cwd: FAKE_REPO_PATH,
    });

    // Only the claude session exists — no fake powershell/UUID session
    const session = dbModule.getSession(claudeSessionId);
    expect(session).toBeDefined();
    expect(session?.launchMode).toBe('pty');
    expect(session?.pid).toBe(8348);

    // The PTY registry now routes to the claude session ID
    expect(ptyRegistryModule.ptyRegistry.has(claudeSessionId)).toBe(true);
    expect(ptyRegistryModule.ptyRegistry.getClaimedId('temp-uuid')).toBe(claudeSessionId);
  });

  it('handleHookPayload creates a plain detected session when no launcher is pending', async () => {
    const claudeSessionId = 'claude-detected-session-f1a2';

    const { ClaudeCodeDetector } = await import('../../src/services/claude-code-detector.js');
    await new ClaudeCodeDetector().handleHookPayload({
      hook_event_name: 'SessionStart',
      session_id: claudeSessionId,
      cwd: FAKE_REPO_PATH,
    });

    const session = dbModule.getSession(claudeSessionId);
    expect(session).toBeDefined();
    expect(session?.launchMode).toBeNull();
    expect(ptyRegistryModule.ptyRegistry.has(claudeSessionId)).toBe(false);
  });
});
