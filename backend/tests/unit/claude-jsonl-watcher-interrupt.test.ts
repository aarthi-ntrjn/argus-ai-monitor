import { describe, it, expect, vi, beforeEach } from 'vitest';

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
vi.mock('chokidar', () => ({
  default: { watch: vi.fn(() => ({ on: vi.fn(), close: vi.fn().mockResolvedValue(undefined) })) },
}));

const mockBroadcast = vi.hoisted(() => vi.fn());
vi.mock('../../src/api/ws/event-dispatcher.js', () => ({
  broadcast: mockBroadcast,
}));

const mockPendingChoiceEmit = vi.hoisted(() => vi.fn());
vi.mock('../../src/services/pending-choice-events.js', () => ({
  pendingChoiceEvents: { emit: mockPendingChoiceEmit },
}));

import { ClaudeJsonlWatcher } from '../../src/services/claude-jsonl-watcher.js';
import type { SessionOutput } from '../../src/models/index.js';

class TestableWatcher extends ClaudeJsonlWatcher {
  callOnNewOutputs(sessionId: string, outputs: SessionOutput[]): void {
    this.onNewOutputs(sessionId, outputs);
  }
}

function makeOutput(overrides: Partial<SessionOutput>): SessionOutput {
  return {
    id: 'test-id',
    sessionId: 'test-session',
    timestamp: new Date().toISOString(),
    type: 'message',
    role: 'user',
    content: '',
    toolName: null,
    toolCallId: null,
    sequenceNumber: 1,
    ...overrides,
  };
}

function assertResolved(sessionId: string): void {
  const resolved = mockBroadcast.mock.calls.find(
    (call) => (call[0] as { type: string }).type === 'session.pending_choice.resolved',
  );
  expect(resolved).toBeDefined();
  expect((resolved![0] as { data: Record<string, unknown> }).data.sessionId).toBe(sessionId);
  expect(mockPendingChoiceEmit).toHaveBeenCalledWith('session.pending_choice.resolved', sessionId);
}

function assertNotResolved(): void {
  const resolved = mockBroadcast.mock.calls.find(
    (call) => (call[0] as { type: string }).type === 'session.pending_choice.resolved',
  );
  expect(resolved).toBeUndefined();
}

beforeEach(() => {
  mockBroadcast.mockClear();
  mockPendingChoiceEmit.mockClear();
});

describe('ClaudeJsonlWatcher — pending choice resolution', () => {
  it('resolves when tool_result arrives for a tracked AskUserQuestion call (normal answer)', () => {
    const watcher = new TestableWatcher();
    watcher.callOnNewOutputs('sess-1', [
      makeOutput({ type: 'tool_use', toolName: 'AskUserQuestion', toolCallId: 'call-123', role: null }),
    ]);
    mockBroadcast.mockClear();
    mockPendingChoiceEmit.mockClear();

    watcher.callOnNewOutputs('sess-1', [
      makeOutput({ type: 'tool_result', toolCallId: 'call-123', role: null }),
    ]);
    assertResolved('sess-1');
  });

  it('resolves when "clarify" rejection tool_result arrives (no interrupt sentinel)', () => {
    const watcher = new TestableWatcher();
    watcher.callOnNewOutputs('sess-2', [
      makeOutput({ type: 'tool_use', toolName: 'AskUserQuestion', toolCallId: 'call-clarify', role: null }),
    ]);
    mockBroadcast.mockClear();
    mockPendingChoiceEmit.mockClear();

    watcher.callOnNewOutputs('sess-2', [
      makeOutput({ type: 'tool_result', toolCallId: 'call-clarify', content: "The user wants to clarify these questions.", role: null }),
    ]);
    assertResolved('sess-2');
  });

  it('resolves via interrupt sentinel even without a prior tool_use in the same session', () => {
    const watcher = new TestableWatcher();
    watcher.callOnNewOutputs('sess-3', [
      makeOutput({ type: 'message', role: 'user', content: '[Request interrupted by user for tool use]' }),
    ]);
    assertResolved('sess-3');
  });

  it('does NOT resolve for ordinary user messages', () => {
    const watcher = new TestableWatcher();
    watcher.callOnNewOutputs('sess-4', [makeOutput({ content: 'hi' })]);
    assertNotResolved();
  });

  it('does NOT resolve for tool_result with a non-matching call ID', () => {
    const watcher = new TestableWatcher();
    watcher.callOnNewOutputs('sess-5', [
      makeOutput({ type: 'tool_use', toolName: 'AskUserQuestion', toolCallId: 'call-abc', role: null }),
    ]);
    mockBroadcast.mockClear();

    watcher.callOnNewOutputs('sess-5', [
      makeOutput({ type: 'tool_result', toolCallId: 'call-different', role: null }),
    ]);
    assertNotResolved();
  });

  it('does NOT fire for assistant messages with the interrupt sentinel text', () => {
    const watcher = new TestableWatcher();
    watcher.callOnNewOutputs('sess-6', [
      makeOutput({ type: 'message', role: 'assistant', content: '[Request interrupted by user for tool use]' }),
    ]);
    assertNotResolved();
  });
});
