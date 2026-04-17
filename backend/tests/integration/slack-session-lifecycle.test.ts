import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../src/db/database.js', () => ({
  getRepository: vi.fn(),
  getSlackThreadTs: vi.fn(),
  setSlackThreadTs: vi.fn(),
  getDb: vi.fn().mockReturnValue({
    prepare: vi.fn().mockReturnValue({ get: vi.fn().mockReturnValue(undefined) }),
  }),
}));

import { SlackNotifier } from '../../src/services/slack-notifier.js';
import { getSlackThreadTs, setSlackThreadTs } from '../../src/db/database.js';
import type { Session } from '../../src/models/index.js';

const baseSession: Session = {
  id: 'session-abc',
  repositoryId: null,
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
  reconciled: true,
  yoloMode: null,
};

const mockPostMessage = vi.fn();
const mockMonitor = { on: vi.fn(), off: vi.fn(), emit: vi.fn() } as any;

function makeNotifier() {
  const notifier = new SlackNotifier(
    { botToken: 'xoxb-test', channelId: 'C01234', enabled: true } as any,
    mockMonitor,
  );
  (notifier as any).client = { chat: { postMessage: mockPostMessage } };
  (notifier as any).disabled = false;
  return notifier;
}

describe('SlackNotifier - session lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    vi.mocked(getSlackThreadTs).mockReturnValue(null);
    mockPostMessage.mockResolvedValue({ ts: 'ts-123', message: { thread_ts: 'ts-123' } });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('full lifecycle: created -> updated -> ended', async () => {
    const notifier = makeNotifier();

    // Session start
    await notifier.postSessionStart(baseSession);
    await vi.advanceTimersByTimeAsync(0); // flush microtasks: sets thread anchor + setSlackThreadTs
    expect(mockPostMessage).toHaveBeenCalledTimes(1);

    // Set up for update: inject previous state so diff produces changes
    (notifier as any).prevSessions.set(baseSession.id, baseSession);
    const updatedSession = { ...baseSession, status: 'idle' as const };

    await notifier.postSessionUpdate(updatedSession);
    await vi.advanceTimersByTimeAsync(1200); // fire rate-limit timer and process update job
    expect(mockPostMessage).toHaveBeenCalledTimes(2);
    const updateCall = mockPostMessage.mock.calls[1][0];
    expect(updateCall.thread_ts).toBe('ts-123');

    // Session end
    await notifier.postSessionEnd({ ...baseSession, status: 'completed' as const });
    await vi.advanceTimersByTimeAsync(1200); // fire rate-limit timer and process end job
    expect(mockPostMessage).toHaveBeenCalledTimes(3);
    const endCall = mockPostMessage.mock.calls[2][0];
    expect(endCall.thread_ts).toBe('ts-123');
  });

  it('thread anchor is set after session start', async () => {
    const notifier = makeNotifier();

    await notifier.postSessionStart(baseSession);
    await vi.advanceTimersByTimeAsync(0); // flush: thread anchor set, setSlackThreadTs called

    expect(setSlackThreadTs).toHaveBeenCalledWith(baseSession.id, 'ts-123');
  });

  it('postSessionEnd clears thread anchor', async () => {
    const notifier = makeNotifier();

    await notifier.postSessionStart(baseSession);
    await vi.advanceTimersByTimeAsync(0); // flush: anchor = 'ts-123'

    await notifier.postSessionEnd({ ...baseSession, status: 'completed' as const });
    await vi.advanceTimersByTimeAsync(1200); // process end job: calls setSlackThreadTs(null)

    expect(setSlackThreadTs).toHaveBeenLastCalledWith(baseSession.id, null);
  });

  it('postSessionUpdate with no previous state is a no-op', async () => {
    const notifier = makeNotifier();

    // No postSessionStart, no prevSessions entry: diff is null
    await notifier.postSessionUpdate(baseSession);
    await vi.advanceTimersByTimeAsync(1200);

    expect(mockPostMessage).not.toHaveBeenCalled();
  });

  it('rate limiting: second message waits for timer', async () => {
    const notifier = makeNotifier();

    // First message is processed immediately
    await notifier.postSessionStart(baseSession);
    expect(mockPostMessage).toHaveBeenCalledTimes(1);

    // Second message is queued because isSending = true
    await notifier.postSessionStart(baseSession);
    expect(mockPostMessage).toHaveBeenCalledTimes(1); // still 1

    // Advance past rate limit: timer fires, second message is processed
    await vi.advanceTimersByTimeAsync(1200);
    expect(mockPostMessage).toHaveBeenCalledTimes(2);
  });
});
