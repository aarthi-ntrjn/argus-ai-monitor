import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/db/database.js', () => ({
  getRepository: vi.fn(),
  getSlackThread: vi.fn(),
  getSlackThreadByTs: vi.fn(),
  upsertSlackThread: vi.fn(),
  deleteSlackThread: vi.fn(),
}));


import { SlackNotifier } from '../../src/services/slack-notifier.js';
import { getSlackThread, upsertSlackThread, deleteSlackThread } from '../../src/db/database.js';
import type { Session } from '../../src/models/index.js';

const baseConfig = {
  botToken: 'xoxb-test',
  channelId: 'C01234',
  enabled: true,
};

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

function makeNotifier(config = baseConfig) {
  const notifier = new SlackNotifier(config as any, mockMonitor);
  (notifier as any).client = { chat: { postMessage: mockPostMessage } };
  (notifier as any).disabled = false;
  return notifier;
}

describe('SlackNotifier', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSlackThread).mockReturnValue(null);
    mockPostMessage.mockResolvedValue({ ts: 'ts-123', message: { thread_ts: 'ts-123' } });
  });

  describe('initialize', () => {
    it('disables when botToken is missing', async () => {
      const notifier = new SlackNotifier({ botToken: '', channelId: 'C01234', enabled: true } as any, mockMonitor);
      await notifier.initialize();
      expect(notifier.isDisabled).toBe(true);
    });

    it('disables when channelId is missing', async () => {
      const notifier = new SlackNotifier({ botToken: 'xoxb-test', channelId: '', enabled: true } as any, mockMonitor);
      await notifier.initialize();
      expect(notifier.isDisabled).toBe(true);
    });

    it('disables when enabled is false', async () => {
      const notifier = new SlackNotifier({ ...baseConfig, enabled: false }, mockMonitor);
      await notifier.initialize();
      expect(notifier.isDisabled).toBe(true);
    });
  });

  describe('postSessionStart', () => {
    it('posts a message to the configured channel', async () => {
      const notifier = makeNotifier();
      await notifier.postSessionStart(baseSession);
      expect(mockPostMessage).toHaveBeenCalledOnce();
      const call = mockPostMessage.mock.calls[0][0];
      expect(call.channel).toBe('C01234');
    });

    it('upserts slack thread after first post', async () => {
      const notifier = makeNotifier();
      await notifier.postSessionStart(baseSession);
      expect(upsertSlackThread).toHaveBeenCalledWith(expect.objectContaining({
        sessionId: baseSession.id,
        slackThreadTs: 'ts-123',
        slackChannelId: 'C01234',
      }));
    });

    it('threads onto existing anchor when present', async () => {
      vi.mocked(getSlackThread).mockReturnValue({
        id: 'row-1',
        sessionId: baseSession.id,
        slackThreadTs: 'existing-ts',
        slackChannelId: 'C01234',
        createdAt: '2024-01-01T00:00:00.000Z',
      });
      const notifier = makeNotifier();
      await notifier.postSessionStart(baseSession);
      const call = mockPostMessage.mock.calls[0][0];
      expect(call.thread_ts).toBe('existing-ts');
    });

    it('does not post when disabled', async () => {
      const notifier = new SlackNotifier({ botToken: '', channelId: '', enabled: true } as any, mockMonitor);
      notifier.initialize();
      await notifier.postSessionStart(baseSession);
      expect(mockPostMessage).not.toHaveBeenCalled();
    });
  });

  describe('postSessionEnd', () => {
    it('posts an end message to the thread', async () => {
      const notifier = makeNotifier();
      (notifier as any).threadAnchors.set(baseSession.id, 'thread-ts');
      await notifier.postSessionEnd(baseSession);
      expect(mockPostMessage).toHaveBeenCalledOnce();
      const call = mockPostMessage.mock.calls[0][0];
      expect(call.thread_ts).toBe('thread-ts');
    });

    it('deletes slack thread after end', async () => {
      const notifier = makeNotifier();
      (notifier as any).threadAnchors.set(baseSession.id, 'thread-ts');
      await notifier.postSessionEnd(baseSession);
      expect(deleteSlackThread).toHaveBeenCalledWith(baseSession.id);
    });
  });

  describe('getSessionIdByThreadTs', () => {
    it('returns sessionId from in-memory anchor', () => {
      const notifier = makeNotifier();
      (notifier as any).threadAnchors.set('session-abc', 'ts-xxx');
      expect(notifier.getSessionIdByThreadTs('ts-xxx')).toBe('session-abc');
    });

    it('returns undefined for unknown thread ts', () => {
      const notifier = makeNotifier();
      expect(notifier.getSessionIdByThreadTs('unknown-ts')).toBeUndefined();
    });
  });

  describe('isEventEnabled', () => {
    it('allows all events when enabledEventTypes is not set', async () => {
      const notifier = makeNotifier();
      await notifier.postSessionStart(baseSession);
      expect(mockPostMessage).toHaveBeenCalled();
    });

    it('skips events not in enabledEventTypes', async () => {
      const notifier = new SlackNotifier(
        { ...baseConfig, enabledEventTypes: ['session.ended'] },
        mockMonitor,
      );
      (notifier as any).client = { chat: { postMessage: mockPostMessage } };
      (notifier as any).disabled = false;
      await notifier.postSessionStart(baseSession);
      expect(mockPostMessage).not.toHaveBeenCalled();
    });
  });
});
