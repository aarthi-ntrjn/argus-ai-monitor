import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { join } from 'path';
import { randomUUID } from 'crypto';
import supertest from 'supertest';

vi.mock('../../src/services/teams-bot-auth-service.js', () => ({
  TeamsBotAuthService: vi.fn().mockImplementation(() => ({
    getAccessToken: vi.fn().mockResolvedValue('mock-access-token'),
  })),
}));

vi.mock('../../src/services/teams-graph-client.js', () => ({
  TeamsGraphClient: vi.fn().mockImplementation(() => ({
    createThreadPost: vi.fn().mockResolvedValue({ messageId: 'thread-1' }),
    postReply: vi.fn().mockResolvedValue({ messageId: 'reply-1' }),
    updateReply: vi.fn(),
  })),
}));

import { buildServer } from '../../src/server.js';
import { closeDb, upsertSession, upsertTeamsThread, insertRepository, getControlActions } from '../../src/db/database.js';
import { saveTeamsConfig } from '../../src/config/teams-config-loader.js';

const BOT_APP_ID = 'test-bot-app-id-12345';
const OWNER_AAD_ID = 'owner-aad-12345';
const SESSION_ID = `session-${randomUUID()}`;
const TEAMS_THREAD_ID = `teams-thread-${randomUUID()}`;

function makeBotToken(appId: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ appid: appId, aud: 'https://api.botframework.com' })).toString('base64url');
  return `${header}.${payload}.fakesig`;
}

describe('Teams Webhook API', () => {
  let request: ReturnType<typeof supertest>;
  let app: Awaited<ReturnType<typeof buildServer>>['app'];
  const configPath = join(process.cwd(), `teams-config-webhook-${randomUUID()}.json`);

  beforeAll(async () => {
    process.env.ARGUS_DB_PATH = ':memory:';
    process.env.ARGUS_TEAMS_CONFIG_PATH = configPath;

    saveTeamsConfig({
      enabled: true,
      botAppId: BOT_APP_ID,
      botAppSecret: 'secret',
      tenantId: 'tenant-id',
      teamId: 'team-id',
      channelId: 'channel-id',
      ownerAadObjectId: OWNER_AAD_ID,
    });

    const result = await buildServer();
    app = result.app;
    await app.ready();
    request = supertest(app.server);

    insertRepository({ id: 'repo-1', name: 'test-repo', path: '/tmp/test', remoteUrl: null, source: 'config', addedAt: new Date().toISOString(), lastScannedAt: null, branch: null });
    upsertSession({
      id: SESSION_ID, repositoryId: 'repo-1', type: 'claude-code', launchMode: null, pid: null,
      hostPid: null, pidSource: null, status: 'active',
      startedAt: new Date().toISOString(), endedAt: null, lastActivityAt: new Date().toISOString(),
      summary: null, expiresAt: null, model: null, reconciled: true, yoloMode: null,
    });
    upsertTeamsThread({
      id: randomUUID(), sessionId: SESSION_ID, teamsThreadId: TEAMS_THREAD_ID,
      teamsChannelId: 'channel-id', currentOutputMessageId: null, deltaLink: null,
      createdAt: new Date().toISOString(),
    });
  });

  afterAll(async () => {
    await app.close();
    closeDb();
  });

  it('TC1: returns 200 and inserts control action for valid owner message', async () => {
    const res = await request
      .post('/api/v1/teams/webhook')
      .set('Authorization', `Bearer ${makeBotToken(BOT_APP_ID)}`)
      .send({
        type: 'message',
        text: 'run tests',
        from: { id: 'mri-owner', aadObjectId: OWNER_AAD_ID },
        conversation: { id: `19:channel@thread.tacv2;messageid=${TEAMS_THREAD_ID}` },
      });

    expect(res.status).toBe(200);

    const actions = getControlActions(SESSION_ID);
    const action = actions.find(a => a.type === 'send_prompt');
    expect(action).toBeDefined();
    expect((action?.payload as any)?.text).toBe('run tests');
  });

  it('TC2: returns 401 when Authorization header is missing', async () => {
    const res = await request.post('/api/v1/teams/webhook').send({ type: 'message', text: 'hi' });
    expect(res.status).toBe(401);
  });

  it('TC3: returns 401 when token has wrong appid', async () => {
    const res = await request
      .post('/api/v1/teams/webhook')
      .set('Authorization', `Bearer ${makeBotToken('wrong-app-id')}`)
      .send({ type: 'message', text: 'hi', from: { aadObjectId: OWNER_AAD_ID } });
    expect(res.status).toBe(401);
  });

  it('TC4: returns 200 silently when sender is not the owner (no control action inserted)', async () => {
    const countBefore = getControlActions(SESSION_ID).length;

    const res = await request
      .post('/api/v1/teams/webhook')
      .set('Authorization', `Bearer ${makeBotToken(BOT_APP_ID)}`)
      .send({
        type: 'message',
        text: 'hi from stranger',
        from: { id: 'mri-other', aadObjectId: 'some-other-aad-id' },
        conversation: { id: `19:channel@thread.tacv2;messageid=${TEAMS_THREAD_ID}` },
      });

    expect(res.status).toBe(200);
    expect(getControlActions(SESSION_ID).length).toBe(countBefore);
  });

  it('TC5: returns 200 for non-message activity types (no control action inserted)', async () => {
    const countBefore = getControlActions(SESSION_ID).length;

    const res = await request
      .post('/api/v1/teams/webhook')
      .set('Authorization', `Bearer ${makeBotToken(BOT_APP_ID)}`)
      .send({ type: 'conversationUpdate', from: { aadObjectId: OWNER_AAD_ID } });

    expect(res.status).toBe(200);
    expect(getControlActions(SESSION_ID).length).toBe(countBefore);
  });

  it('TC6: returns 200 silently when thread is unknown (no control action inserted)', async () => {
    const countBefore = getControlActions(SESSION_ID).length;

    const res = await request
      .post('/api/v1/teams/webhook')
      .set('Authorization', `Bearer ${makeBotToken(BOT_APP_ID)}`)
      .send({
        type: 'message',
        text: 'hello',
        from: { id: 'mri-owner', aadObjectId: OWNER_AAD_ID },
        conversation: { id: '19:channel@thread.tacv2;messageid=unknown-thread-xyz' },
      });

    expect(res.status).toBe(200);
    expect(getControlActions(SESSION_ID).length).toBe(countBefore);
  });
});

