import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/db/database.js', () => ({
  getTeamsThread: vi.fn(),
  upsertTeamsThread: vi.fn(),
  deleteTeamsThread: vi.fn(),
  getRepository: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock('../../src/config/teams-config-loader.js', () => ({
  loadTeamsConfig: vi.fn(),
}));

import { TeamsNotifier } from '../../src/integration/teams/teams-notifier.js';
import { getTeamsThread, upsertTeamsThread } from '../../src/db/database.js';
import { loadTeamsConfig } from '../../src/config/teams-config-loader.js';
import type { Session } from '../../src/models/index.js';

const mockActivitiesCreate = vi.fn();
const mockActivities = vi.fn().mockReturnValue({
  create: mockActivitiesCreate,
});

const mockTeamsApp = {
  send: vi.fn(),
  api: {
    conversations: {
      activities: mockActivities,
    },
  },
};

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  teams: vi.fn(),
} as any;

const baseSession: Session = {
  id: 'test-session-id',
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
  reconciled: true,
  yoloMode: null,
};

const enabledConfig = {
  enabled: true,
  botAppId: 'bot-app-id',
  botAppSecret: 'bot-app-secret',
  tenantId: 'tenant-id',
  teamId: 'team-id',
  channelId: 'channel-id',
  ownerAadObjectId: 'owner-aad-object-id',
};

const existingThread = {
  id: 'thread-id',
  sessionId: baseSession.id,
  teamsThreadId: 'teams-thread-id',
  teamsChannelId: 'channel-id',
  tenantId: 'tenant-id',
  createdAt: '2024-01-01T00:00:00.000Z',
};

describe('TeamsNotifier', () => {
  let service: TeamsNotifier;

  beforeEach(() => {
    vi.clearAllMocks();
    mockActivities.mockReturnValue({ create: mockActivitiesCreate });
    service = new TeamsNotifier(mockTeamsApp as any, mockLogger);
    // Mark the service active so tests exercise the real guards (config, thread, etc.)
    // rather than short-circuiting at the !active early-return.
    (service as any).active = true;
  });

  describe('onSessionCreated', () => {
    it('creates thread and upserts TeamsThread when enabled', async () => {
      vi.mocked(loadTeamsConfig).mockReturnValue(enabledConfig);
      vi.mocked(getTeamsThread).mockReturnValue(null);
      mockTeamsApp.send.mockResolvedValue({ id: 'thread-1' });

      await service.onSessionCreated(baseSession);

      expect(mockTeamsApp.send).toHaveBeenCalledOnce();
      expect(upsertTeamsThread).toHaveBeenCalledOnce();
    });

    it('skips when disabled', async () => {
      vi.mocked(loadTeamsConfig).mockReturnValue({ enabled: false });

      await service.onSessionCreated(baseSession);

      expect(mockTeamsApp.send).not.toHaveBeenCalled();
    });

    it('reuses existing thread without creating new one', async () => {
      vi.mocked(loadTeamsConfig).mockReturnValue(enabledConfig);
      vi.mocked(getTeamsThread).mockReturnValue(existingThread);
      mockActivitiesCreate.mockResolvedValue({ id: 'notify-reply' });

      await service.onSessionCreated(baseSession);

      expect(mockTeamsApp.send).not.toHaveBeenCalled();
    });
  });

  describe('onSessionOutput', () => {
    it('posts assistant messages as a thread reply', async () => {
      vi.mocked(loadTeamsConfig).mockReturnValue(enabledConfig);
      vi.mocked(getTeamsThread).mockReturnValue(existingThread);
      mockActivitiesCreate.mockResolvedValue({ id: 'output-msg' });

      const outputs = [
        { id: '1', sessionId: baseSession.id, timestamp: '', type: 'message' as const, content: 'hello', toolName: null, toolCallId: null, role: 'assistant' as const, sequenceNumber: 1 },
      ];

      await service.onSessionOutput(baseSession.id, outputs);

      expect(mockActivitiesCreate).toHaveBeenCalledOnce();
      const callArg = mockActivitiesCreate.mock.calls[0][0] as { type: string; text: string };
      expect(callArg.text).toContain('hello');
    });

    it('skips non-assistant outputs', async () => {
      vi.mocked(loadTeamsConfig).mockReturnValue(enabledConfig);
      const outputs = [
        { id: '1', sessionId: baseSession.id, timestamp: '', type: 'message' as const, content: 'tool output', toolName: 'bash', toolCallId: null, role: 'tool' as const, sequenceNumber: 1 },
      ];

      await service.onSessionOutput(baseSession.id, outputs);

      expect(mockActivitiesCreate).not.toHaveBeenCalled();
    });

    it('skips when not enabled', async () => {
      vi.mocked(loadTeamsConfig).mockReturnValue({ enabled: false });
      const outputs = [
        { id: '1', sessionId: baseSession.id, timestamp: '', type: 'message' as const, content: 'hello', toolName: null, toolCallId: null, role: 'assistant' as const, sequenceNumber: 1 },
      ];

      await service.onSessionOutput(baseSession.id, outputs);

      expect(mockActivitiesCreate).not.toHaveBeenCalled();
    });
  });

  describe('onSessionEnded', () => {
    it('calls activities.create with final status', async () => {
      vi.mocked(loadTeamsConfig).mockReturnValue(enabledConfig);
      vi.mocked(getTeamsThread).mockReturnValue(existingThread);
      mockActivitiesCreate.mockResolvedValue({ id: 'end-msg' });

      await service.onSessionEnded({ ...baseSession, status: 'completed' });

      expect(mockActivitiesCreate).toHaveBeenCalled();
      const callArg = mockActivitiesCreate.mock.calls[0][0] as { type: string; text: string };
      expect(callArg.text).toContain('completed');
    });
  });

  describe('opening message format', () => {
    it('includes session ID, type, startedAt, ownerAadObjectId', async () => {
      vi.mocked(loadTeamsConfig).mockReturnValue(enabledConfig);
      vi.mocked(getTeamsThread).mockReturnValue(null);
      mockTeamsApp.send.mockResolvedValue({ id: 'thread-1' });

      await service.onSessionCreated(baseSession);

      const callArg = mockTeamsApp.send.mock.calls[0][1] as { type: string; text: string };
      expect(callArg.text).toContain(baseSession.id);
      expect(callArg.text).toContain(baseSession.type);
    });
  });

  describe('ended message format', () => {
    it('includes session status', async () => {
      vi.mocked(loadTeamsConfig).mockReturnValue(enabledConfig);
      vi.mocked(getTeamsThread).mockReturnValue(existingThread);
      mockActivitiesCreate.mockResolvedValue({ id: 'end-msg' });

      await service.onSessionEnded({ ...baseSession, status: 'completed' });

      const callArg = mockActivitiesCreate.mock.calls[0][0] as { type: string; text: string };
      expect(callArg.text).toContain('completed');
    });
  });

  describe('initialize()', () => {
    it('returns false and logs when enabled is false', async () => {
      vi.mocked(loadTeamsConfig).mockReturnValue({ enabled: false });

      const result = await service.initialize();

      expect(result).toBe(false);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ enabled: false }),
        'teams: not configured, skipping event subscriptions',
      );
    });

    it('returns false when enabled but teamId/channelId/ownerAadObjectId are missing', async () => {
      vi.mocked(loadTeamsConfig).mockReturnValue({
        enabled: true,
        teamId: undefined,
        channelId: undefined,
        ownerAadObjectId: undefined,
      });

      const result = await service.initialize();

      expect(result).toBe(false);
    });

    it('returns true when fully configured', async () => {
      vi.mocked(loadTeamsConfig).mockReturnValue(enabledConfig);

      const result = await service.initialize();

      expect(result).toBe(true);
    });
  });

  describe('onSessionUpdated()', () => {
    it('delegates to onSessionCreated when no thread exists', async () => {
      vi.mocked(loadTeamsConfig).mockReturnValue(enabledConfig);
      vi.mocked(getTeamsThread).mockReturnValue(null);
      mockTeamsApp.send.mockResolvedValue({ id: 'new-thread' });

      await service.onSessionUpdated(baseSession);

      expect(mockTeamsApp.send).toHaveBeenCalledOnce();
    });

    it('records baseline and skips posting when no previous state exists (server restart recovery)', async () => {
      vi.mocked(loadTeamsConfig).mockReturnValue(enabledConfig);
      vi.mocked(getTeamsThread).mockReturnValue(existingThread);
      // No lastPostedState set: simulates server restart mid-session

      await service.onSessionUpdated(baseSession);

      expect(mockActivitiesCreate).not.toHaveBeenCalled();
      // Baseline should now be recorded so future updates can diff against it
      expect((service as any).lastPostedState.has(baseSession.id)).toBe(true);
    });

    it('skips posting when only untracked fields changed (e.g. lastActivityAt)', async () => {
      vi.mocked(loadTeamsConfig).mockReturnValue(enabledConfig);
      vi.mocked(getTeamsThread).mockReturnValue(existingThread);
      (service as any).lastPostedState.set(baseSession.id, {
        status: baseSession.status,
        model: baseSession.model,
        yoloMode: baseSession.yoloMode,
        pid: baseSession.pid,
        launchMode: baseSession.launchMode,
        summary: baseSession.summary,
      });

      const updatedSession = { ...baseSession, lastActivityAt: '2024-06-01T00:00:00.000Z' };
      await service.onSessionUpdated(updatedSession);

      expect(mockActivitiesCreate).not.toHaveBeenCalled();
    });

    it('posts a reply with changed fields when status changes', async () => {
      vi.mocked(loadTeamsConfig).mockReturnValue(enabledConfig);
      vi.mocked(getTeamsThread).mockReturnValue(existingThread);
      (service as any).lastPostedState.set(baseSession.id, {
        status: 'active',
        model: null,
        yoloMode: null,
        pid: null,
        launchMode: null,
        summary: null,
      });
      mockActivitiesCreate.mockResolvedValue({ id: 'update-msg' });

      await service.onSessionUpdated({ ...baseSession, status: 'completed' });

      expect(mockActivitiesCreate).toHaveBeenCalledOnce();
      const callArg = mockActivitiesCreate.mock.calls[0][0] as { type: string; text: string };
      expect(callArg.text).toContain('Status');
      expect(callArg.text).toContain('completed');
    });

    it('skips when not configured', async () => {
      vi.mocked(loadTeamsConfig).mockReturnValue({ enabled: false });

      await service.onSessionUpdated(baseSession);

      expect(mockActivitiesCreate).not.toHaveBeenCalled();
      expect(mockTeamsApp.send).not.toHaveBeenCalled();
    });
  });
});
