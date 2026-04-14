import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../src/db/database.js', () => ({
  getSessions: vi.fn(),
  getTeamsThread: vi.fn(),
  getSession: vi.fn(),
  insertControlAction: vi.fn(),
  updateTeamsThreadDeltaLink: vi.fn(),
}));

vi.mock('../../src/config/teams-config-loader.js', () => ({
  loadTeamsConfig: vi.fn(),
}));

import { TeamsPollingService } from '../../src/services/teams-polling-service.js';
import type { TeamsGraphClient } from '../../src/services/teams-graph-client.js';
import type { TeamsMsalService } from '../../src/services/teams-msal-service.js';
import { getSessions, getTeamsThread, getSession, insertControlAction, updateTeamsThreadDeltaLink } from '../../src/db/database.js';
import { loadTeamsConfig } from '../../src/config/teams-config-loader.js';

const mockGraphClient = {
  pollReplies: vi.fn(),
  postReply: vi.fn().mockResolvedValue({ messageId: 'notice-id' }),
} as unknown as TeamsGraphClient;

const mockMsalService = {
  getAccessToken: vi.fn().mockResolvedValue('access-token'),
} as unknown as TeamsMsalService;

const mockLogger = {
  info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
} as any;

const enabledConfig = {
  enabled: true,
  clientId: 'cid', tenantId: 'tid', teamId: 'team-1',
  channelId: 'chan-1', ownerUserId: 'owner-aad-id', refreshToken: 'rt',
};

describe('TeamsPollingService', () => {
  let service: TeamsPollingService;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadTeamsConfig).mockReturnValue(enabledConfig);
    vi.mocked(mockMsalService.getAccessToken).mockResolvedValue('access-token');
    service = new TeamsPollingService(mockGraphClient, mockMsalService, mockLogger);
  });

  afterEach(() => service.stop());

  it('inserts ControlAction with source="Teams" for owner reply', async () => {
    vi.mocked(getSessions).mockReturnValue([{ id: 'sess-1', status: 'active' }] as any);
    vi.mocked(getTeamsThread).mockReturnValue({ teamsThreadId: 'thread-1', teamsChannelId: 'chan-1', deltaLink: null } as any);
    vi.mocked(getSession).mockReturnValue({ id: 'sess-1', status: 'active' } as any);
    (mockGraphClient.pollReplies as any) = vi.fn().mockResolvedValue({
      replies: [{ id: 'r1', from: { user: { id: 'owner-aad-id', displayName: 'Owner' } }, body: { content: 'run tests' }, createdDateTime: '2024-01-01T00:00:00Z' }],
      nextDeltaLink: 'https://delta-link-2',
    });

    await service.runOneCycle();

    expect(insertControlAction).toHaveBeenCalledOnce();
    const action = vi.mocked(insertControlAction).mock.calls[0][0];
    expect(action.type).toBe('send_prompt');
    expect(action.source).toBe('Teams');
    expect(action.payload).toMatchObject({ text: 'run tests' });
    expect(updateTeamsThreadDeltaLink).toHaveBeenCalledWith('sess-1', 'https://delta-link-2');
  });

  it('posts notice and does NOT insert ControlAction for non-owner reply', async () => {
    vi.mocked(getSessions).mockReturnValue([{ id: 'sess-1', status: 'active' }] as any);
    vi.mocked(getTeamsThread).mockReturnValue({ teamsThreadId: 'thread-1', teamsChannelId: 'chan-1', deltaLink: null } as any);
    vi.mocked(getSession).mockReturnValue({ id: 'sess-1', status: 'active' } as any);
    (mockGraphClient.pollReplies as any) = vi.fn().mockResolvedValue({
      replies: [{ id: 'r2', from: { user: { id: 'other-user', displayName: 'Other' } }, body: { content: 'hack' }, createdDateTime: '2024-01-01T00:00:00Z' }],
      nextDeltaLink: 'https://delta-2',
    });
    (mockGraphClient.postReply as any) = vi.fn().mockResolvedValue({ messageId: 'notice-id' });

    await service.runOneCycle();

    expect(insertControlAction).not.toHaveBeenCalled();
    expect(mockGraphClient.postReply).toHaveBeenCalled();
  });

  it('posts ended notice for reply to ended session', async () => {
    vi.mocked(getSessions).mockReturnValue([{ id: 'sess-1', status: 'active' }] as any);
    vi.mocked(getTeamsThread).mockReturnValue({ teamsThreadId: 'thread-1', teamsChannelId: 'chan-1', deltaLink: null } as any);
    vi.mocked(getSession).mockReturnValue({ id: 'sess-1', status: 'completed' } as any);
    (mockGraphClient.pollReplies as any) = vi.fn().mockResolvedValue({
      replies: [{ id: 'r3', from: { user: { id: 'owner-aad-id', displayName: 'Owner' } }, body: { content: 'cmd' }, createdDateTime: '2024-01-01T00:00:00Z' }],
      nextDeltaLink: 'https://delta-3',
    });
    (mockGraphClient.postReply as any) = vi.fn().mockResolvedValue({ messageId: 'notice-id' });

    await service.runOneCycle();

    expect(insertControlAction).not.toHaveBeenCalled();
    expect(mockGraphClient.postReply).toHaveBeenCalled();
    const noticeText = (mockGraphClient.postReply as any).mock.calls[0][4];
    expect(noticeText).toContain('ended');
  });

  it('skips sessions with no TeamsThread', async () => {
    vi.mocked(getSessions).mockReturnValue([{ id: 'sess-no-thread', status: 'active' }] as any);
    vi.mocked(getTeamsThread).mockReturnValue(null);

    await service.runOneCycle();

    expect(mockGraphClient.pollReplies).not.toHaveBeenCalled();
  });

  it('catches and logs errors without crashing', async () => {
    vi.mocked(getSessions).mockReturnValue([{ id: 'sess-err', status: 'active' }] as any);
    vi.mocked(getTeamsThread).mockReturnValue({ teamsThreadId: 'thread-1', teamsChannelId: 'chan-1', deltaLink: null } as any);
    (mockGraphClient.pollReplies as any) = vi.fn().mockRejectedValue(new Error('Network error'));

    await expect(service.runOneCycle()).resolves.not.toThrow();
    expect(mockLogger.warn).toHaveBeenCalled();
  });
});
