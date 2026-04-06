/**
 * Regression tests for T082: model not detected on incremental JSONL reads.
 *
 * Bug: readNewJsonlLines was called with updateModel=false for every file-change event,
 * so if the initial load had no assistant entries yet (JSONL had only user messages),
 * the model stayed null forever even after assistant messages arrived.
 *
 * Fix: removed the updateModel parameter; now uses needsModel = !(getSession(id)?.model)
 * at the start of every call so model extraction happens whenever the session still needs it.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { writeFileSync, appendFileSync, mkdirSync, rmSync, existsSync } from 'fs';

// Capture chokidar change callbacks so tests can trigger them manually
let changeCallbacks = new Map<string, () => void>();
vi.mock('chokidar', () => ({
  default: {
    watch: vi.fn((filePath: string) => ({
      on: vi.fn((event: string, cb: () => void) => {
        if (event === 'change') changeCallbacks.set(filePath, cb);
        return { on: vi.fn() };
      }),
      close: vi.fn(async () => {}),
    })),
  },
}));

// Use real filesystem (no fs mock) — temp files
const TEST_REPO_PATH = 'C:\\testmodelrepo';
const FAKE_CLAUDE_DIR = join(tmpdir(), `argus-model-test-${randomUUID()}`);

// Override homedir() to point to temp dir
vi.mock('os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('os')>();
  return { ...actual, homedir: () => FAKE_CLAUDE_DIR };
});

const PROJECTS_DIR = join(FAKE_CLAUDE_DIR, '.claude', 'projects');
const PROJECT_DIR_NAME = TEST_REPO_PATH.replace(/[:\\/]/g, '-'); // C--testmodelrepo
const PROJECT_DIR = join(PROJECTS_DIR, PROJECT_DIR_NAME);

function makeUserLine(sessionId: string): string {
  return JSON.stringify({
    type: 'user', uuid: randomUUID(),
    timestamp: new Date().toISOString(),
    sessionId,
    message: { role: 'user', content: 'What is 2+2?' },
  });
}

function makeAssistantLine(sessionId: string, model = 'claude-opus-4-5'): string {
  return JSON.stringify({
    type: 'assistant', uuid: randomUUID(),
    timestamp: new Date().toISOString(),
    sessionId,
    message: { role: 'assistant', model, content: [{ type: 'text', text: '4' }] },
  });
}

describe('ClaudeCodeDetector — model extraction from JSONL', () => {
  let dbModule: typeof import('../../src/db/database.js');

  beforeEach(async () => {
    process.env.ARGUS_DB_PATH = join(tmpdir(), `argus-model-test-${randomUUID()}.db`);
    vi.resetModules();
    changeCallbacks = new Map();

    mkdirSync(PROJECT_DIR, { recursive: true });

    dbModule = await import('../../src/db/database.js');
    dbModule.insertRepository({
      id: 'repo-model-test',
      path: TEST_REPO_PATH,
      name: 'model-test',
      source: 'ui',
      addedAt: new Date().toISOString(),
      lastScannedAt: null,
    });
  });

  afterEach(() => {
    dbModule.closeDb();
    vi.resetModules();
    if (existsSync(FAKE_CLAUDE_DIR)) rmSync(FAKE_CLAUDE_DIR, { recursive: true, force: true });
    changeCallbacks = new Map();
  });

  it('extracts model from initial JSONL load when assistant entry already present', async () => {
    const sessionId = randomUUID();
    const jsonlPath = join(PROJECT_DIR, `${sessionId}.jsonl`);
    writeFileSync(jsonlPath, makeUserLine(sessionId) + '\n' + makeAssistantLine(sessionId, 'claude-opus-4-5') + '\n');

    const { ClaudeCodeDetector } = await import('../../src/services/claude-code-detector.js');
    const detector = new ClaudeCodeDetector();
    await detector.handleHookPayload({ hook_event_name: 'PreToolUse', session_id: sessionId, cwd: TEST_REPO_PATH });

    const session = dbModule.getSession(sessionId);
    expect(session?.model).toBe('claude-opus-4-5');
  });

  it('extracts model on incremental (change event) read when initial load had no assistant entries', async () => {
    const sessionId = randomUUID();
    const jsonlPath = join(PROJECT_DIR, `${sessionId}.jsonl`);

    // Initial JSONL has only a user message — no model yet
    writeFileSync(jsonlPath, makeUserLine(sessionId) + '\n');

    const { ClaudeCodeDetector } = await import('../../src/services/claude-code-detector.js');
    const detector = new ClaudeCodeDetector();
    await detector.handleHookPayload({ hook_event_name: 'PreToolUse', session_id: sessionId, cwd: TEST_REPO_PATH });

    // After initial load: no model yet
    expect(dbModule.getSession(sessionId)?.model).toBeNull();

    // Simulate Claude responding: append assistant line with model
    appendFileSync(jsonlPath, makeAssistantLine(sessionId, 'claude-sonnet-4-5') + '\n');

    // Trigger the chokidar change callback (simulates file-system event)
    const changeHandler = changeCallbacks.get(jsonlPath);
    expect(changeHandler, 'chokidar change handler should be registered').toBeDefined();
    changeHandler!();
    // Wait for the async readNewJsonlLines to complete
    await new Promise(resolve => setTimeout(resolve, 50));

    // After incremental read: model must now be set
    const session = dbModule.getSession(sessionId);
    expect(session?.model).toBe('claude-sonnet-4-5');
  });

  it('does not overwrite an already-detected model when new lines arrive', async () => {
    const sessionId = randomUUID();
    const jsonlPath = join(PROJECT_DIR, `${sessionId}.jsonl`);

    // Initial JSONL has user + assistant (model: claude-haiku-4-5)
    writeFileSync(
      jsonlPath,
      makeUserLine(sessionId) + '\n' + makeAssistantLine(sessionId, 'claude-haiku-4-5') + '\n',
    );

    const { ClaudeCodeDetector } = await import('../../src/services/claude-code-detector.js');
    const detector = new ClaudeCodeDetector();
    await detector.handleHookPayload({ hook_event_name: 'PreToolUse', session_id: sessionId, cwd: TEST_REPO_PATH });

    expect(dbModule.getSession(sessionId)?.model).toBe('claude-haiku-4-5');

    // More assistant lines with a different model string arrive
    appendFileSync(jsonlPath, makeAssistantLine(sessionId, 'claude-opus-4-5') + '\n');

    const changeHandler = changeCallbacks.get(jsonlPath);
    changeHandler!();
    // Wait for the async readNewJsonlLines to complete
    await new Promise(resolve => setTimeout(resolve, 50));

    // Model should NOT be overwritten — first model wins
    expect(dbModule.getSession(sessionId)?.model).toBe('claude-haiku-4-5');
  });
});
