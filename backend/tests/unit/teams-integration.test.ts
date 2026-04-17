import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/db/database.js', () => ({
  getTeamsThread: vi.fn(),
  upsertTeamsThread: vi.fn(),
  updateTeamsThreadOutputMessageId: vi.fn(),
  clearTeamsThreadOutputMessageId: vi.fn(),
  getRepository: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock('../../src/config/teams-config-loader.js', () => ({
  loadTeamsConfig: vi.fn(),
}));

import { TeamsIntegrationService } from '../../src/services/teams-integration.js';
import { TeamsMessageBuffer } from '../../src/services/teams-message-buffer.js';
import { getTeamsThread, upsertTeamsThread } from '../../src/db/database.js';
import { loadTeamsConfig } from '../../src/config/teams-config-loader.js';
import type { Session } from '../../src/models/index.js';

const mockActivitiesCreate = vi.fn();
const mockActivitiesUpdate = vi.fn();
const mockActivities = vi.fn().mockReturnValue({
  create: mockActivitiesCreate,
  update: mockActivitiesUpdate,
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

describe('TeamsIntegrationService', () => {
  let service: TeamsIntegrationService;
  let buffer: TeamsMessageBuffer;

  beforeEach(() => {
    vi.clearAllMocks();
    mockActivities.mockReturnValue({ create: mockActivitiesCreate, update: mockActivitiesUpdate });
    buffer = new TeamsMessageBuffer();
    service = new TeamsIntegrationService(mockTeamsApp as any, buffer, mockLogger);
  });

  describe('onSessionCreated', () => {
    it('creates thread and upserts TeamsThread when enabled', async () => {
      vi.mocked(loadTeamsConfig).mockReturnValue(enabledConfig);
      vi.mocked(getTeamsThread).mockReturnValue(null);
      mockTeamsApp.send.mockResolvedValue({ id: 'thread-1' });

      await service.onSessionCreated(baseSession);

      expect(mockTeamsApp.send).toHaveBeenCalledOnce();
      expect(upsertTeamsThread).toHaveBeenCalledOnce();
      service.stop();
    });

    it('skips when disabled', async () => {
      vi.mocked(loadTeamsConfig).mockReturnValue({ enabled: false });

      await service.onSessionCreated(baseSession);

      expect(mockTeamsApp.send).not.toHaveBeenCalled();
    });

    it('reuses existing thread without creating new one', async () => {
      vi.mocked(loadTeamsConfig).mockReturnValue(enabledConfig);
      vi.mocked(getTeamsThread).mockReturnValue({
        id: 'existing-id',
        sessionId: baseSession.id,
        teamsThreadId: 'existing-thread',
        teamsChannelId: 'channel-id',
        currentOutputMessageId: null,
        deltaLink: null,
        createdAt: '2024-01-01T00:00:00.000Z',
      });
      mockActivitiesCreate.mockResolvedValue({ id: 'notify-reply' });

      await service.onSessionCreated(baseSession);

      expect(mockTeamsApp.send).not.toHaveBeenCalled();
      service.stop();
    });
  });

  describe('onSessionOutput', () => {
    it('enqueues content to buffer when enabled', () => {
      vi.mocked(loadTeamsConfig).mockReturnValue(enabledConfig);
      const outputs = [
        { id: '1', sessionId: baseSession.id, timestamp: '', type: 'message' as const, content: 'hello', toolName: null, toolCallId: null, role: 'assistant' as const, sequenceNumber: 1 },
      ];

      service.onSessionOutput(baseSession.id, outputs);

      expect(buffer.size(baseSession.id)).toBe(1);
    });
  });

  describe('onSessionEnded', () => {
    it('calls activities.create with final status', async () => {
      vi.mocked(loadTeamsConfig).mockReturnValue(enabledConfig);
      vi.mocked(getTeamsThread).mockReturnValue({
        id: 'thread-id',
        sessionId: baseSession.id,
        teamsThreadId: 'teams-thread-id',
        teamsChannelId: 'channel-id',
        currentOutputMessageId: null,
        deltaLink: null,
        createdAt: '2024-01-01T00:00:00.000Z',
      });
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
      service.stop();
    });
  });

  describe('ended message format', () => {
    it('includes session status', async () => {
      vi.mocked(loadTeamsConfig).mockReturnValue(enabledConfig);
      vi.mocked(getTeamsThread).mockReturnValue({
        id: 'thread-id',
        sessionId: baseSession.id,
        teamsThreadId: 'teams-thread-id',
        teamsChannelId: 'channel-id',
        currentOutputMessageId: null,
        deltaLink: null,
        createdAt: '2024-01-01T00:00:00.000Z',
      });
      mockActivitiesCreate.mockResolvedValue({ id: 'end-msg' });

      await service.onSessionEnded({ ...baseSession, status: 'completed' });

      const callArg = mockActivitiesCreate.mock.calls[0][0] as { type: string; text: string };
      expect(callArg.text).toContain('completed');
    });
  });

  describe('initialize()', () => {
    it('returns false and logs when enabled is false', () => {
      vi.mocked(loadTeamsConfig).mockReturnValue({ enabled: false });

      const result = service.initialize();

      expect(result).toBe(false);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ enabled: false }),
        'teams: not configured, skipping event subscriptions',
      );
    });

    it('returns false when enabled but teamId/channelId/ownerAadObjectId are missing', () => {
      vi.mocked(loadTeamsConfig).mockReturnValue({
        enabled: true,
        teamId: undefined,
        channelId: undefined,
        ownerAadObjectId: undefined,
      });

      const result = service.initialize();

      expect(result).toBe(false);
    });

    it('returns true when fully configured', () => {
      vi.mocked(loadTeamsConfig).mockReturnValue(enabledConfig);

      const result = service.initialize();

      expect(result).toBe(true);
    });
  });

  describe('onSessionUpdated()', () => {
    const existingThread = {
      id: 'thread-id',
      sessionId: baseSession.id,
      teamsThreadId: 'teams-thread-id',
      teamsChannelId: 'channel-id',
      currentOutputMessageId: null,
      deltaLink: null,
      createdAt: '2024-01-01T00:00:00.000Z',
    };

    it('delegates to onSessionCreated when no thread exists', async () => {
      vi.mocked(loadTeamsConfig).mockReturnValue(enabledConfig);
      vi.mocked(getTeamsThread).mockReturnValue(null);
      mockTeamsApp.send.mockResolvedValue({ id: 'new-thread' });

      await service.onSessionUpdated(baseSession);

      expect(mockTeamsApp.send).toHaveBeenCalledOnce();
      service.stop();
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
