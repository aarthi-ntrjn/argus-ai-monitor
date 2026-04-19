import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Session, SessionOutput } from '../../src/models/index.js';

// Mock broadcast
const mockBroadcast = vi.hoisted(() => vi.fn());
vi.mock('../../src/api/ws/event-dispatcher.js', () => ({
  broadcast: mockBroadcast,
}));

// Mock database functions — we control what getSession returns per test
const mockGetSession = vi.hoisted(() => vi.fn<[string], Session | undefined>());
const mockUpsertSession = vi.hoisted(() => vi.fn());
vi.mock('../../src/db/database.js', () => ({
  getSession: mockGetSession,
  upsertSession: mockUpsertSession,
}));

import {
  applyActivityUpdate,
  applyModelUpdate,
  applySummaryUpdate,
} from '../../src/services/watcher-session-helpers.js';

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'session-1',
    repositoryId: 'repo-1',
    type: 'claude-code',
    launchMode: null,
    pid: null,
    hostPid: null,
    pidSource: null,
    status: 'active',
    startedAt: '2024-01-01T00:00:00.000Z',
    endedAt: null,
    lastActivityAt: '2024-01-01T00:00:00.000Z',
    summary: null,
    expiresAt: null,
    model: null,
    reconciled: false,
    yoloMode: null,
    ...overrides,
  };
}

function makeOutput(overrides: Partial<SessionOutput> = {}): SessionOutput {
  return {
    id: 'out-1',
    sessionId: 'session-1',
    timestamp: '2024-01-01T00:00:00.000Z',
    type: 'message',
    content: 'hello',
    toolName: null,
    toolCallId: null,
    role: 'user',
    sequenceNumber: 1,
    isMeta: false,
    ...overrides,
  };
}

beforeEach(() => {
  mockBroadcast.mockClear();
  mockGetSession.mockClear();
  mockUpsertSession.mockClear();
});

describe('applyActivityUpdate', () => {
  it('does nothing when session is not found', () => {
    mockGetSession.mockReturnValue(undefined);
    applyActivityUpdate('missing-session');
    expect(mockUpsertSession).not.toHaveBeenCalled();
    expect(mockBroadcast).not.toHaveBeenCalled();
  });

  it('updates lastActivityAt and broadcasts session.updated', () => {
    const session = makeSession();
    mockGetSession.mockReturnValue(session);

    const before = Date.now();
    applyActivityUpdate('session-1');
    const after = Date.now();

    expect(mockUpsertSession).toHaveBeenCalledOnce();
    const upserted = mockUpsertSession.mock.calls[0][0] as Session;
    const updatedTime = new Date(upserted.lastActivityAt).getTime();
    expect(updatedTime).toBeGreaterThanOrEqual(before);
    expect(updatedTime).toBeLessThanOrEqual(after);

    expect(mockBroadcast).toHaveBeenCalledOnce();
    expect(mockBroadcast.mock.calls[0][0]).toMatchObject({ type: 'session.updated' });
  });
});

describe('applyModelUpdate', () => {
  it('does nothing when session is not found', () => {
    mockGetSession.mockReturnValue(undefined);
    applyModelUpdate('missing-session', 'claude-opus', '[Test]');
    expect(mockUpsertSession).not.toHaveBeenCalled();
    expect(mockBroadcast).not.toHaveBeenCalled();
  });

  it('sets the model and broadcasts session.updated when model is not yet set', () => {
    mockGetSession.mockReturnValue(makeSession({ model: null }));
    applyModelUpdate('session-1', 'claude-opus-4-5', '[Test]');

    expect(mockUpsertSession).toHaveBeenCalledOnce();
    const upserted = mockUpsertSession.mock.calls[0][0] as Session;
    expect(upserted.model).toBe('claude-opus-4-5');
    expect(mockBroadcast).toHaveBeenCalledOnce();
    expect(mockBroadcast.mock.calls[0][0]).toMatchObject({ type: 'session.updated' });
  });

  it('does NOT overwrite an already-detected model', () => {
    mockGetSession.mockReturnValue(makeSession({ model: 'claude-opus-4-5' }));
    applyModelUpdate('session-1', 'gpt-4o', '[Test]');

    expect(mockUpsertSession).not.toHaveBeenCalled();
    expect(mockBroadcast).not.toHaveBeenCalled();
  });
});

describe('applySummaryUpdate', () => {
  it('does nothing when session is not found', () => {
    mockGetSession.mockReturnValue(undefined);
    const outputs = [makeOutput({ role: 'user', content: 'hello', isMeta: false })];
    applySummaryUpdate('missing-session', outputs, '[Test]');
    expect(mockUpsertSession).not.toHaveBeenCalled();
  });

  it('does nothing when there are no user message outputs', () => {
    mockGetSession.mockReturnValue(makeSession());
    const outputs = [makeOutput({ role: 'assistant', type: 'message', content: 'reply' })];
    applySummaryUpdate('session-1', outputs, '[Test]');
    expect(mockUpsertSession).not.toHaveBeenCalled();
  });

  it('does nothing when the only user output is isMeta=true', () => {
    mockGetSession.mockReturnValue(makeSession());
    const outputs = [makeOutput({ role: 'user', type: 'message', content: 'meta msg', isMeta: true })];
    applySummaryUpdate('session-1', outputs, '[Test]');
    expect(mockUpsertSession).not.toHaveBeenCalled();
  });

  it('updates summary to last user message content (truncated to 120 chars)', () => {
    mockGetSession.mockReturnValue(makeSession({ summary: null }));
    const longContent = 'A'.repeat(200);
    const outputs = [makeOutput({ role: 'user', type: 'message', content: longContent, isMeta: false })];
    applySummaryUpdate('session-1', outputs, '[Test]');

    expect(mockUpsertSession).toHaveBeenCalledOnce();
    const upserted = mockUpsertSession.mock.calls[0][0] as Session;
    expect(upserted.summary).toBe('A'.repeat(120));
  });

  it('does not upsert when summary is already up-to-date', () => {
    const existingSummary = 'hello';
    mockGetSession.mockReturnValue(makeSession({ summary: existingSummary }));
    const outputs = [makeOutput({ role: 'user', type: 'message', content: existingSummary, isMeta: false })];
    applySummaryUpdate('session-1', outputs, '[Test]');
    expect(mockUpsertSession).not.toHaveBeenCalled();
  });

  it('uses the LAST user message when multiple exist', () => {
    mockGetSession.mockReturnValue(makeSession({ summary: null }));
    const outputs = [
      makeOutput({ id: 'o1', role: 'user', type: 'message', content: 'first', sequenceNumber: 1, isMeta: false }),
      makeOutput({ id: 'o2', role: 'assistant', type: 'message', content: 'reply', sequenceNumber: 2, isMeta: false }),
      makeOutput({ id: 'o3', role: 'user', type: 'message', content: 'second', sequenceNumber: 3, isMeta: false }),
    ];
    applySummaryUpdate('session-1', outputs, '[Test]');

    expect(mockUpsertSession).toHaveBeenCalledOnce();
    const upserted = mockUpsertSession.mock.calls[0][0] as Session;
    expect(upserted.summary).toBe('second');
  });
});
