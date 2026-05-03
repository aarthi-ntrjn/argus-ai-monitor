import { describe, it, expect, vi, beforeEach } from 'vitest';
import { writeFileSync, appendFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

// Mock chokidar — capture the 'change' handler so tests can trigger it
let capturedChangeHandler: (() => void) | null = null;
const mockWatcherOn = vi.fn((event: string, handler: () => void) => {
  if (event === 'change') capturedChangeHandler = handler;
  return mockFsWatcher;
});
const mockFsWatcher = { on: mockWatcherOn, close: vi.fn().mockResolvedValue(undefined) };
vi.mock('chokidar', () => ({
  default: { watch: vi.fn(() => mockFsWatcher) },
}));

vi.mock('../../src/db/database.js', () => ({
  getMaxSequenceNumber: vi.fn(() => 0),
}));

vi.mock('../../src/services/output-store.js', () => ({
  OutputStore: vi.fn().mockImplementation(() => ({ insertOutput: vi.fn(() => true) })),
}));

vi.mock('../../src/services/watcher-session-helpers.js', () => ({
  applyActivityUpdate: vi.fn(),
  applyModelUpdate: vi.fn(),
  applySummaryUpdate: vi.fn(),
}));

// Mock broadcast — capture calls to verify pending_choice events
const mockBroadcast = vi.hoisted(() => vi.fn());
vi.mock('../../src/api/ws/event-dispatcher.js', () => ({
  broadcast: mockBroadcast,
}));

import { CopilotJsonlWatcher } from '../../src/services/copilot-jsonl-watcher.js';

function writeTempJsonl(content: string): string {
  const dir = join(tmpdir(), `argus-copilot-watcher-test-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, 'events.jsonl');
  writeFileSync(file, content, 'utf-8');
  return file;
}

const ASK_USER_TOOL_CALL_ID = 'toolu_01TestAskUser';

const askUserStartEvent = JSON.stringify({
  type: 'tool.execution_start',
  timestamp: '2025-01-01T00:00:00.000Z',
  data: {
    toolCallId: ASK_USER_TOOL_CALL_ID,
    toolName: 'ask_user',
    arguments: {
      question: 'What would you like to do?',
      choices: ['Option A', 'Option B', 'Option C'],
    },
  },
});

const askUserCompleteEvent = JSON.stringify({
  type: 'tool.execution_complete',
  timestamp: '2025-01-01T00:00:05.000Z',
  data: {
    toolCallId: ASK_USER_TOOL_CALL_ID,
    model: 'claude-sonnet-4-6',
    success: true,
    result: {
      content: 'User selected: Option A',
      detailedContent: 'User selected: Option A',
    },
  },
});

beforeEach(() => {
  capturedChangeHandler = null;
  mockWatcherOn.mockClear();
  mockBroadcast.mockClear();
});

describe('CopilotJsonlWatcher — ask_user pending choice detection', () => {
  it('broadcasts session.pending_choice when tool.execution_start for ask_user is processed', async () => {
    const file = writeTempJsonl(askUserStartEvent + '\n');
    const watcher = new CopilotJsonlWatcher();
    await watcher.watchFile('sess-1', join(file, '..'));

    const pendingCall = mockBroadcast.mock.calls.find(
      (call) => (call[0] as { type: string }).type === 'session.pending_choice',
    );
    expect(pendingCall).toBeDefined();
    const event = pendingCall![0] as { type: string; data: Record<string, unknown> };
    expect(event.data.sessionId).toBe('sess-1');
    expect(event.data.question).toBe('What would you like to do?');
    expect(event.data.choices).toEqual(['Option A', 'Option B', 'Option C']);
    expect(Array.isArray(event.data.allQuestions)).toBe(true);
  });

  it('broadcasts session.pending_choice.resolved when tool.execution_complete for ask_user arrives', async () => {
    // Start: ask_user fires
    const file = writeTempJsonl(askUserStartEvent + '\n');
    const watcher = new CopilotJsonlWatcher();
    await watcher.watchFile('sess-2', join(file, '..'));

    expect(capturedChangeHandler).not.toBeNull();

    // Append: ask_user completes (same toolCallId, but toolName absent in data)
    appendFileSync(file, askUserCompleteEvent + '\n', 'utf-8');
    capturedChangeHandler!();
    await new Promise((r) => setTimeout(r, 50));

    const resolvedCall = mockBroadcast.mock.calls.find(
      (call) => (call[0] as { type: string }).type === 'session.pending_choice.resolved',
    );
    expect(resolvedCall).toBeDefined();
    const event = resolvedCall![0] as { type: string; data: Record<string, unknown> };
    expect(event.data.sessionId).toBe('sess-2');
  });

  it('broadcasts question text when ask_user has no choices (single-arg, non-JSON content)', async () => {
    const noChoicesEvent = JSON.stringify({
      type: 'tool.execution_start',
      timestamp: '2025-01-01T00:00:00.000Z',
      data: {
        toolCallId: 'toolu_no_choices',
        toolName: 'ask_user',
        arguments: {
          question: 'Are you sure you want to proceed?',
        },
      },
    });
    const file = writeTempJsonl(noChoicesEvent + '\n');
    const watcher = new CopilotJsonlWatcher();
    await watcher.watchFile('sess-no-choices', join(file, '..'));

    const pendingCall = mockBroadcast.mock.calls.find(
      (call) => (call[0] as { type: string }).type === 'session.pending_choice',
    );
    expect(pendingCall).toBeDefined();
    const event = pendingCall![0] as { type: string; data: Record<string, unknown> };
    expect(event.data.question).toBe('Are you sure you want to proceed?');
    expect(event.data.choices).toEqual([]);
  });

  it('does NOT broadcast session.pending_choice for non-ask_user tool_use events', async () => {
    const otherToolEvent = JSON.stringify({
      type: 'tool.execution_start',
      timestamp: '2025-01-01T00:00:00.000Z',
      data: {
        toolCallId: 'toolu_other',
        toolName: 'bash',
        arguments: { command: 'ls' },
      },
    });
    const file = writeTempJsonl(otherToolEvent + '\n');
    const watcher = new CopilotJsonlWatcher();
    await watcher.watchFile('sess-3', join(file, '..'));

    const pendingCall = mockBroadcast.mock.calls.find(
      (call) => (call[0] as { type: string }).type === 'session.pending_choice',
    );
    expect(pendingCall).toBeUndefined();
  });

  it('does NOT broadcast session.pending_choice.resolved for unrelated tool_result events', async () => {
    // First process an ask_user start to prime the pending map
    const file = writeTempJsonl(askUserStartEvent + '\n');
    const watcher = new CopilotJsonlWatcher();
    await watcher.watchFile('sess-4', join(file, '..'));

    mockBroadcast.mockClear();
    expect(capturedChangeHandler).not.toBeNull();

    // Append a tool.execution_complete with a DIFFERENT toolCallId
    const unrelatedComplete = JSON.stringify({
      type: 'tool.execution_complete',
      timestamp: '2025-01-01T00:00:05.000Z',
      data: {
        toolCallId: 'toolu_DIFFERENT',
        success: true,
        result: { content: 'done' },
      },
    });
    appendFileSync(file, unrelatedComplete + '\n', 'utf-8');
    capturedChangeHandler!();
    await new Promise((r) => setTimeout(r, 50));

    const resolvedCall = mockBroadcast.mock.calls.find(
      (call) => (call[0] as { type: string }).type === 'session.pending_choice.resolved',
    );
    expect(resolvedCall).toBeUndefined();
  });

  it('clears the pending ask_user callId on stopWatchers so resolved does not fire for stale state', async () => {
    // Process the ask_user start — stores toolCallId in pendingAskUserCallIds for 'sess-5'
    const file = writeTempJsonl(askUserStartEvent + '\n');
    const watcher = new CopilotJsonlWatcher();
    await watcher.watchFile('sess-5', join(file, '..'));

    // Stop: clears pendingAskUserCallIds (and all other internal state)
    watcher.stopWatchers();
    mockBroadcast.mockClear();

    // Re-attach the same watcher instance to a file with only the completion event.
    // If stopWatchers had NOT cleared the map, the toolCallId would still be stored and
    // resolved would be broadcast erroneously.
    const file2 = writeTempJsonl(askUserCompleteEvent + '\n');
    await watcher.watchFile('sess-5', join(file2, '..'));

    const resolvedCall = mockBroadcast.mock.calls.find(
      (call) => (call[0] as { type: string }).type === 'session.pending_choice.resolved',
    );
    expect(resolvedCall).toBeUndefined();
  });
});
