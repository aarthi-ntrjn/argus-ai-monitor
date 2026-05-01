import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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
import type { Session, SessionOutput } from '../../src/models/index.js';

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

const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), teams: vi.fn() } as any;

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
  botAppId: 'bot-app-id',
  botAppSecret: 'bot-app-secret',
  tenantId: 'tenant-id',
  teamId: 'team-id',
  channelId: 'channel-id',
  ownerSenderId: 'owner-aad-object-id',
};

describe('TeamsNotifier - session lifecycle', () => {
  let service: TeamsNotifier;
  let storedThread: any;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockActivities.mockReturnValue({ create: mockActivitiesCreate });
    service = new TeamsNotifier(mockTeamsApp as any, mockLogger);
    (service as any).active = true;

    vi.mocked(loadTeamsConfig).mockReturnValue(config);
    storedThread = null;
    vi.mocked(getTeamsThread).mockImplementation(() => storedThread);
    vi.mocked(upsertTeamsThread).mockImplementation((t) => { storedThread = { ...t }; });
    mockTeamsApp.send.mockResolvedValue({ id: 'teams-thread' });
    mockActivitiesCreate.mockResolvedValue({ id: 'reply-msg' });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('full lifecycle: created -> output -> ended', async () => {
    await service.onSessionCreated(session);
    await vi.advanceTimersByTimeAsync(0); // flush microtasks: upsertTeamsThread + lastPostedState
    expect(mockTeamsApp.send).toHaveBeenCalledOnce();
    expect(upsertTeamsThread).toHaveBeenCalledOnce();

    await vi.advanceTimersByTimeAsync(1200); // clear rate-limit timer after session.created

    const outputs: SessionOutput[] = [
      { id: '1', sessionId: session.id, timestamp: '', type: 'message', content: 'output line 1', toolName: null, toolCallId: null, role: 'assistant', sequenceNumber: 1 },
      { id: '2', sessionId: session.id, timestamp: '', type: 'message', content: 'output line 2', toolName: null, toolCallId: null, role: 'assistant', sequenceNumber: 2 },
    ];
    await service.onSessionOutput(session.id, outputs);
    await vi.advanceTimersByTimeAsync(1200); // fire rate-limit timer and process output job
    expect(mockActivitiesCreate).toHaveBeenCalledOnce();

    await service.onSessionEnded({ ...session, status: 'completed' });
    await vi.advanceTimersByTimeAsync(1200); // fire rate-limit timer and process ended job
    expect(mockActivitiesCreate).toHaveBeenCalledTimes(2);
  });

  it('reconnect: second onSessionCreated reuses existing thread', async () => {
    await service.onSessionCreated(session);
    await vi.advanceTimersByTimeAsync(0); // flush microtasks so upsertTeamsThread runs and storedThread is set
    expect(mockTeamsApp.send).toHaveBeenCalledOnce();

    await vi.advanceTimersByTimeAsync(1200); // clear rate-limit timer
    await service.onSessionCreated(session);
    await vi.advanceTimersByTimeAsync(1200); // process reconnect notification job
    expect(mockTeamsApp.send).toHaveBeenCalledOnce(); // still 1 — reused thread, no new top-level send
    expect(mockActivitiesCreate).toHaveBeenCalledOnce(); // reconnect notification posted as reply
  });
});
