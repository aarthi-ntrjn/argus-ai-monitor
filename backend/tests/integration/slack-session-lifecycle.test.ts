import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../src/db/database.js', () => ({
  getRepository: vi.fn(),
  getSlackThread: vi.fn(),
  getSlackThreadByTs: vi.fn(),
  upsertSlackThread: vi.fn(),
  deleteSlackThread: vi.fn(),
}));

import { SlackNotifier } from '../../src/integration/slack/slack-notifier.js';
import { getSlackThread, upsertSlackThread, deleteSlackThread } from '../../src/db/database.js';
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
  (notifier as any).active = true;
  return notifier;
}

describe('SlackNotifier - session lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    vi.mocked(getSlackThread).mockReturnValue(null);
    mockPostMessage.mockResolvedValue({ ts: 'ts-123', message: { thread_ts: 'ts-123' } });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('full lifecycle: created -> updated -> ended', async () => {
    const notifier = makeNotifier();

    // Session start
    await notifier.onSessionCreated(baseSession);
    await vi.advanceTimersByTimeAsync(0); // flush microtasks: sets thread anchor + upsertSlackThread
    expect(mockPostMessage).toHaveBeenCalledTimes(1);

    // Set up for update: seed baseline so diff produces changes
    (notifier as any).diffTracker.seed(baseSession);
    const updatedSession = { ...baseSession, status: 'idle' as const };

    await notifier.onSessionUpdated(updatedSession);
    await vi.advanceTimersByTimeAsync(1200); // fire rate-limit timer and process update job
    expect(mockPostMessage).toHaveBeenCalledTimes(2);
    const updateCall = mockPostMessage.mock.calls[1][0];
    expect(updateCall.thread_ts).toBe('ts-123');

    // Session end
    await notifier.onSessionEnded({ ...baseSession, status: 'completed' as const });
    await vi.advanceTimersByTimeAsync(1200); // fire rate-limit timer and process end job
    expect(mockPostMessage).toHaveBeenCalledTimes(3);
    const endCall = mockPostMessage.mock.calls[2][0];
    expect(endCall.thread_ts).toBe('ts-123');
  });

  it('thread anchor is upserted after session start', async () => {
    const notifier = makeNotifier();

    await notifier.onSessionCreated(baseSession);
    await vi.advanceTimersByTimeAsync(0);

    expect(upsertSlackThread).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: baseSession.id,
      slackThreadTs: 'ts-123',
    }));
  });

  it('postSessionEnd deletes slack thread', async () => {
    const notifier = makeNotifier();

    await notifier.onSessionCreated(baseSession);
    await vi.advanceTimersByTimeAsync(0);

    await notifier.onSessionEnded({ ...baseSession, status: 'completed' as const });
    await vi.advanceTimersByTimeAsync(1200);

    expect(deleteSlackThread).toHaveBeenCalledWith(baseSession.id);
  });

  it('postSessionUpdate with no previous state is a no-op', async () => {
    const notifier = makeNotifier();

    await notifier.onSessionUpdated(baseSession);
    await vi.advanceTimersByTimeAsync(1200);

    expect(mockPostMessage).not.toHaveBeenCalled();
  });

  it('rate limiting: second message waits for timer', async () => {
    const notifier = makeNotifier();

    await notifier.onSessionCreated(baseSession);
    expect(mockPostMessage).toHaveBeenCalledTimes(1);

    await notifier.onSessionCreated(baseSession);
    expect(mockPostMessage).toHaveBeenCalledTimes(1); // still 1

    await vi.advanceTimersByTimeAsync(1200);
    expect(mockPostMessage).toHaveBeenCalledTimes(2);
  });
});
