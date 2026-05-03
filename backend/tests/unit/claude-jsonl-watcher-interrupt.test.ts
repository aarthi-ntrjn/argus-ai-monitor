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

function makeMessage(content: string): SessionOutput {
  return {
    id: 'test-id',
    sessionId: 'test-session',
    timestamp: new Date().toISOString(),
    type: 'message',
    role: 'user',
    content,
    toolName: null,
    toolCallId: null,
    sequenceNumber: 1,
  };
}

beforeEach(() => {
  mockBroadcast.mockClear();
  mockPendingChoiceEmit.mockClear();
});

describe('ClaudeJsonlWatcher — ask_user interrupt detection', () => {
  it('broadcasts session.pending_choice.resolved when interrupt sentinel appears', () => {
    const watcher = new TestableWatcher();
    watcher.callOnNewOutputs('sess-1', [
      makeMessage('[Request interrupted by user for tool use]'),
    ]);

    const resolved = mockBroadcast.mock.calls.find(
      (call) => (call[0] as { type: string }).type === 'session.pending_choice.resolved',
    );
    expect(resolved).toBeDefined();
    expect((resolved![0] as { data: Record<string, unknown> }).data.sessionId).toBe('sess-1');
    expect(mockPendingChoiceEmit).toHaveBeenCalledWith('session.pending_choice.resolved', 'sess-1');
  });

  it('does NOT broadcast session.pending_choice.resolved for ordinary user messages', () => {
    const watcher = new TestableWatcher();
    watcher.callOnNewOutputs('sess-2', [makeMessage('hi')]);

    const resolved = mockBroadcast.mock.calls.find(
      (call) => (call[0] as { type: string }).type === 'session.pending_choice.resolved',
    );
    expect(resolved).toBeUndefined();
  });

  it('does NOT fire for assistant messages with the same text', () => {
    const watcher = new TestableWatcher();
    watcher.callOnNewOutputs('sess-3', [{
      ...makeMessage('[Request interrupted by user for tool use]'),
      role: 'assistant',
    }]);

    const resolved = mockBroadcast.mock.calls.find(
      (call) => (call[0] as { type: string }).type === 'session.pending_choice.resolved',
    );
    expect(resolved).toBeUndefined();
  });
});
