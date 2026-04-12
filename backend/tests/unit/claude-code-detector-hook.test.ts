/**
 * Unit tests for T010: real-time pending choice detection via PreToolUse/PostToolUse hooks.
 *
 * Tests verify that handleHookPayload correctly stores and clears pending choices
 * when Claude Code fires PreToolUse/PostToolUse events for the AskUserQuestion tool.
 * These should FAIL until T011-T013 are implemented.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { mkdirSync, rmSync, existsSync } from 'fs';

// Mock chokidar to prevent real file watchers from being created
vi.mock('chokidar', () => ({
  default: {
    watch: vi.fn(() => ({
      on: vi.fn(() => ({ on: vi.fn() })),
      close: vi.fn(async () => {}),
    })),
  },
}));

const TEST_REPO_PATH = 'C:\\testhookrepo';
const FAKE_CLAUDE_DIR = join(tmpdir(), `argus-hook-test-${randomUUID()}`);

vi.mock('os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('os')>();
  return { ...actual, homedir: () => FAKE_CLAUDE_DIR };
});

function makeSession(sessionId: string): import('../../src/models/index.js').Session {
  return {
    id: sessionId,
    repositoryId: 'repo-hook-test',
    type: 'claude-code',
    launchMode: null,
    pid: null,
    hostPid: null,
    pidSource: null,
    status: 'active',
    startedAt: new Date().toISOString(),
    endedAt: null,
    lastActivityAt: new Date().toISOString(),
    summary: null,
    expiresAt: null,
    model: null,
    reconciled: true,
    yoloMode: null,
  };
}

describe('ClaudeCodeDetector — hook-based pending choice', () => {
  let dbModule: typeof import('../../src/db/database.js');
  let detector: import('../../src/services/claude-code-detector.js').ClaudeCodeDetector;

  beforeEach(async () => {
    process.env.ARGUS_DB_PATH = join(tmpdir(), `argus-hook-test-${randomUUID()}.db`);
    vi.resetModules();

    mkdirSync(join(FAKE_CLAUDE_DIR, '.claude'), { recursive: true });

    dbModule = await import('../../src/db/database.js');
    dbModule.insertRepository({
      id: 'repo-hook-test',
      path: TEST_REPO_PATH,
      name: 'hook-test',
      source: 'ui',
      addedAt: new Date().toISOString(),
      lastScannedAt: null,
    });

    const { ClaudeCodeDetector } = await import('../../src/services/claude-code-detector.js');
    detector = new ClaudeCodeDetector();
  });

  afterEach(() => {
    dbModule.closeDb();
    vi.resetModules();
    if (existsSync(FAKE_CLAUDE_DIR)) rmSync(FAKE_CLAUDE_DIR, { recursive: true, force: true });
  });

  it('PreToolUse/AskUserQuestion stores pending choice in internal map', async () => {
    const sessionId = randomUUID();
    dbModule.upsertSession(makeSession(sessionId));

    await detector.handleHookPayload({
      hook_event_name: 'PreToolUse',
      session_id: sessionId,
      tool_name: 'AskUserQuestion',
      tool_use_id: 'toolu_01abc',
      tool_input: {
        questions: [{
          question: 'Which color do you prefer?',
          header: 'Color',
          multiSelect: false,
          options: [
            { label: 'Red', description: 'Bold, fiery red' },
            { label: 'Blue', description: 'Calm, cool blue' },
          ],
        }],
      },
      cwd: TEST_REPO_PATH,
    });

    const pending = detector.getPendingChoice(sessionId);
    expect(pending).not.toBeNull();
    expect(pending?.question).toBe('Which color do you prefer?');
    expect(pending?.choices).toEqual(['Red', 'Blue']);
  });

  it('extracts question and choices correctly from nested questions[0] format', async () => {
    const sessionId = randomUUID();
    dbModule.upsertSession(makeSession(sessionId));

    await detector.handleHookPayload({
      hook_event_name: 'PreToolUse',
      session_id: sessionId,
      tool_name: 'AskUserQuestion',
      tool_use_id: 'toolu_02def',
      tool_input: {
        questions: [{
          question: 'Which directory should I use?',
          header: 'Directory',
          multiSelect: false,
          options: [
            { label: 'src/', description: 'Source directory' },
            { label: 'lib/', description: 'Library directory' },
            { label: 'dist/', description: 'Distribution directory' },
          ],
        }],
      },
      cwd: TEST_REPO_PATH,
    });

    const pending = detector.getPendingChoice(sessionId);
    expect(pending?.question).toBe('Which directory should I use?');
    expect(pending?.choices).toEqual(['src/', 'lib/', 'dist/']);
  });

  it('PostToolUse/AskUserQuestion removes the pending choice from internal map', async () => {
    const sessionId = randomUUID();
    dbModule.upsertSession(makeSession(sessionId));

    // First store a pending choice via PreToolUse
    await detector.handleHookPayload({
      hook_event_name: 'PreToolUse',
      session_id: sessionId,
      tool_name: 'AskUserQuestion',
      tool_use_id: 'toolu_03ghi',
      tool_input: {
        questions: [{ question: 'Pick?', options: [{ label: 'Yes' }, { label: 'No' }] }],
      },
      cwd: TEST_REPO_PATH,
    });

    expect(detector.getPendingChoice(sessionId)).not.toBeNull();

    // Now resolve it via PostToolUse
    await detector.handleHookPayload({
      hook_event_name: 'PostToolUse',
      session_id: sessionId,
      tool_name: 'AskUserQuestion',
      tool_use_id: 'toolu_03ghi',
      cwd: TEST_REPO_PATH,
    });

    expect(detector.getPendingChoice(sessionId)).toBeNull();
  });

  it('PreToolUse with non-AskUserQuestion tool_name does not store a pending choice', async () => {
    const sessionId = randomUUID();
    dbModule.upsertSession(makeSession(sessionId));

    await detector.handleHookPayload({
      hook_event_name: 'PreToolUse',
      session_id: sessionId,
      tool_name: 'Bash',
      tool_input: { command: 'ls -la' },
      cwd: TEST_REPO_PATH,
    });

    expect(detector.getPendingChoice(sessionId)).toBeNull();
  });

  it('PreToolUse/AskUserQuestion with session_id not in any known session does nothing', async () => {
    const unknownSessionId = randomUUID();
    // Intentionally do NOT insert a session for this ID

    await detector.handleHookPayload({
      hook_event_name: 'PreToolUse',
      session_id: unknownSessionId,
      tool_name: 'AskUserQuestion',
      tool_input: {
        questions: [{ question: 'Ignored?', options: [{ label: 'A' }] }],
      },
      cwd: TEST_REPO_PATH,
    });

    expect(detector.getPendingChoice(unknownSessionId)).toBeNull();
  });
});
