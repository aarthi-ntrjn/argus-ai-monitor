import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/db/database.js', () => ({
  getTeamsThread: vi.fn(),
  upsertTeamsThread: vi.fn(),
  updateTeamsThreadOutputMessageId: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock('../../src/config/teams-config-loader.js', () => ({
  loadTeamsConfig: vi.fn(),
}));

import { TeamsIntegrationService } from '../../src/services/teams-integration.js';
import { TeamsMessageBuffer } from '../../src/services/teams-message-buffer.js';
import { getTeamsThread, upsertTeamsThread, updateTeamsThreadOutputMessageId } from '../../src/db/database.js';
import { loadTeamsConfig } from '../../src/config/teams-config-loader.js';
import type { Session, SessionOutput } from '../../src/models/index.js';

const mockApiClient = {
  createThread: vi.fn(),
  updateMessage: vi.fn(),
  postReply: vi.fn(),
  getToken: vi.fn(),
  validateConnection: vi.fn(),
  clearTokenCache: vi.fn(),
};

const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as any;

const session: Session = {
  id: 'lifecycle-session',
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

const config = {
  enabled: true,
  botAppId: 'app-id',
  botAppPassword: 'secret',
  channelId: 'ch',
  serviceUrl: 'https://smba.trafficmanager.net',
  ownerTeamsUserId: 'owner',
};

describe('TeamsIntegrationService - session lifecycle', () => {
  let service: TeamsIntegrationService;
  let buffer: TeamsMessageBuffer;
  let storedThread: any;

  beforeEach(() => {
    vi.clearAllMocks();
    buffer = new TeamsMessageBuffer();
    service = new TeamsIntegrationService(mockApiClient as any, buffer, mockLogger);

    vi.mocked(loadTeamsConfig).mockReturnValue(config);
    storedThread = null;
    vi.mocked(getTeamsThread).mockImplementation(() => storedThread);
    vi.mocked(upsertTeamsThread).mockImplementation((t) => { storedThread = t; });
    vi.mocked(updateTeamsThreadOutputMessageId).mockImplementation((_, msgId) => {
      if (storedThread) storedThread.currentOutputMessageId = msgId;
    });
    mockApiClient.createThread.mockResolvedValue({ threadId: 'teams-thread', messageId: 'opening-msg' });
    mockApiClient.postReply.mockResolvedValue({ messageId: 'reply-msg' });
    mockApiClient.updateMessage.mockResolvedValue(undefined);
  });

  it('full lifecycle: created -> output -> flush -> ended', async () => {
    await service.onSessionCreated(session);
    expect(mockApiClient.createThread).toHaveBeenCalledOnce();
    expect(upsertTeamsThread).toHaveBeenCalledOnce();

    const outputs: SessionOutput[] = [
      { id: '1', sessionId: session.id, timestamp: '', type: 'message', content: 'output line 1', toolName: null, toolCallId: null, role: null, sequenceNumber: 1 },
      { id: '2', sessionId: session.id, timestamp: '', type: 'message', content: 'output line 2', toolName: null, toolCallId: null, role: null, sequenceNumber: 2 },
    ];
    service.onSessionOutput(session.id, outputs);
    expect(buffer.size(session.id)).toBe(2);

    // Manually flush
    await (service as any)._flush(session.id, config);
    expect(mockApiClient.postReply).toHaveBeenCalled();

    await service.onSessionEnded({ ...session, status: 'completed' });
    // postReply called again for ended message
    expect(mockApiClient.postReply).toHaveBeenCalledTimes(2);
    service.stop();
  });

  it('reconnect: second onSessionCreated reuses existing thread', async () => {
    await service.onSessionCreated(session);
    expect(mockApiClient.createThread).toHaveBeenCalledOnce();

    await service.onSessionCreated(session);
    expect(mockApiClient.createThread).toHaveBeenCalledOnce(); // still 1
    service.stop();
  });
});
