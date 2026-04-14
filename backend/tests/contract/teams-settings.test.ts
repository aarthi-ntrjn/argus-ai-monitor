import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { join } from 'path';
import { randomUUID } from 'crypto';
import supertest from 'supertest';

vi.mock('../../src/services/teams-msal-service.js', () => ({
  TeamsMsalService: vi.fn().mockImplementation(() => ({
    initiateDeviceCodeFlow: vi.fn().mockResolvedValue({
      userCode: 'ABCD-1234',
      verificationUrl: 'https://microsoft.com/devicelogin',
      expiresIn: 900,
      message: 'Enter code ABCD-1234',
    }),
    pollDeviceCodeFlow: vi.fn().mockResolvedValue({ status: 'pending' }),
    getAccessToken: vi.fn().mockResolvedValue('mock-access-token'),
  })),
}));

vi.mock('../../src/services/teams-graph-client.js', () => ({
  TeamsGraphClient: vi.fn().mockImplementation(() => ({
    createThreadPost: vi.fn().mockResolvedValue({ messageId: 'thread-1' }),
    postReply: vi.fn().mockResolvedValue({ messageId: 'reply-1' }),
    updateReply: vi.fn(),
    pollReplies: vi.fn().mockResolvedValue({ replies: [], nextDeltaLink: 'https://delta' }),
    getMe: vi.fn().mockResolvedValue({ id: 'owner-id', displayName: 'Ada Lovelace' }),
  })),
}));

import { buildServer } from '../../src/server.js';
import { closeDb } from '../../src/db/database.js';

describe('Teams Settings API (Graph API)', () => {
  let request: ReturnType<typeof supertest>;
  let app: Awaited<ReturnType<typeof buildServer>>['app'];
  const configPath = join(process.cwd(), `teams-config-graph-${randomUUID()}.json`);

  beforeAll(async () => {
    process.env.ARGUS_DB_PATH = ':memory:';
    process.env.ARGUS_TEAMS_CONFIG_PATH = configPath;
    const result = await buildServer();
    app = result.app;
    await app.ready();
    request = supertest(app.server);
  });

  afterAll(async () => {
    await app.close();
    closeDb();
  });

  it('TC1: GET returns unconfigured when no config', async () => {
    const res = await request.get('/api/v1/settings/teams');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ enabled: false, connectionStatus: 'unconfigured' });
  });

  it('TC4: PATCH enable with all required fields saves and returns connected', async () => {
    const res = await request.patch('/api/v1/settings/teams').send({
      enabled: true,
      clientId: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
      tenantId: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
      teamId: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
      channelId: '19:xxxxx@thread.tacv2',
      refreshToken: 'refresh-token-value',
      ownerUserId: 'owner-id',
    });
    expect(res.status).toBe(200);
    expect(res.body.connectionStatus).toBe('connected');
    expect(res.body.refreshToken).toBe('***');
  });

  it('TC2: GET after configuration returns masked refreshToken and connected', async () => {
    const res = await request.get('/api/v1/settings/teams');
    expect(res.status).toBe(200);
    expect(res.body.refreshToken).toBe('***');
    expect(res.body.connectionStatus).toBe('connected');
  });

  it('TC5: PATCH with refreshToken "***" preserves existing token', async () => {
    const res = await request.patch('/api/v1/settings/teams').send({ refreshToken: '***' });
    expect(res.status).toBe(200);
    const getRes = await request.get('/api/v1/settings/teams');
    expect(getRes.body.refreshToken).toBe('***');
  });

  it('TC6: PATCH enable without refreshToken returns 422', async () => {
    const freshPath = join(process.cwd(), `teams-config-fresh-${randomUUID()}.json`);
    process.env.ARGUS_TEAMS_CONFIG_PATH = freshPath;
    const res = await request.patch('/api/v1/settings/teams').send({
      enabled: true,
      clientId: 'cid',
      tenantId: 'tid',
      teamId: 'team-id',
      channelId: 'chan-id',
    });
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('TEAMS_NOT_AUTHENTICATED');
    process.env.ARGUS_TEAMS_CONFIG_PATH = configPath;
  });

  it('TC7: PATCH enable without clientId returns 400', async () => {
    const freshPath7 = join(process.cwd(), `teams-config-fresh7-${randomUUID()}.json`);
    process.env.ARGUS_TEAMS_CONFIG_PATH = freshPath7;
    const res = await request.patch('/api/v1/settings/teams').send({
      enabled: true,
      tenantId: 'tid', teamId: 'team', channelId: 'chan', refreshToken: 'rt',
    });
    process.env.ARGUS_TEAMS_CONFIG_PATH = configPath;
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('TEAMS_CONFIG_INVALID');
  });

  it('TC8: PATCH enabled: false returns disconnected', async () => {
    const res = await request.patch('/api/v1/settings/teams').send({ enabled: false });
    expect(res.status).toBe(200);
    expect(res.body.enabled).toBe(false);
  });

  it('TC10: POST /auth/device-code returns userCode and verificationUrl', async () => {
    const res = await request.post('/api/v1/settings/teams/auth/device-code').send({
      clientId: 'client-id', tenantId: 'tenant-id',
    });
    expect(res.status).toBe(200);
    expect(res.body.userCode).toBeDefined();
    expect(res.body.verificationUrl).toBeDefined();
  });

  it('TC11: POST /auth/device-code without clientId returns 400', async () => {
    const res = await request.post('/api/v1/settings/teams/auth/device-code').send({ tenantId: 'tid' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('TEAMS_CONFIG_INVALID');
  });

  it('TC12: POST /auth/poll returns pending', async () => {
    const res = await request.post('/api/v1/settings/teams/auth/poll').send({
      clientId: 'client-id', tenantId: 'tenant-id',
    });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('pending');
  });
});
