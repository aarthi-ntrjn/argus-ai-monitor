import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { join } from 'path';
import { randomUUID } from 'crypto';
import supertest from 'supertest';

vi.mock('../../src/services/teams-bot-auth-service.js', () => ({
  TeamsBotAuthService: vi.fn().mockImplementation(() => ({
    getAccessToken: vi.fn().mockResolvedValue('mock-access-token'),
  })),
}));

vi.mock('../../src/api/routes/teams-settings.js', async (importOriginal) => {
  const actual = await importOriginal() as any;
  const { TeamsBotAuthService } = await import('../../src/services/teams-bot-auth-service.js');
  actual._auth.botAuthService = new TeamsBotAuthService();
  return actual;
});

vi.mock('../../src/services/teams-graph-client.js', () => ({
  TeamsGraphClient: vi.fn().mockImplementation(() => ({
    createThreadPost: vi.fn().mockResolvedValue({ messageId: 'thread-1' }),
    postReply: vi.fn().mockResolvedValue({ messageId: 'reply-1' }),
    updateReply: vi.fn(),
  })),
}));

import { buildServer } from '../../src/server.js';
import { closeDb } from '../../src/db/database.js';
import { _auth } from '../../src/api/routes/teams-settings.js';

describe('Teams Settings API (Bot + RSC)', () => {
  let request: ReturnType<typeof supertest>;
  let app: Awaited<ReturnType<typeof buildServer>>['app'];
  const configPath = join(process.cwd(), `teams-config-bot-${randomUUID()}.json`);

  beforeAll(async () => {
    process.env.ARGUS_DB_PATH = ':memory:';
    process.env.ARGUS_TEAMS_CONFIG_PATH = configPath;
    vi.mocked(_auth.botAuthService.getAccessToken).mockResolvedValue('mock-access-token');
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
      botAppId: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
      botAppSecret: 'my-secret-value',
      tenantId: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
      teamId: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
      channelId: '19:xxxxx@thread.tacv2',
      ownerAadObjectId: 'owner-aad-id',
    });
    expect(res.status).toBe(200);
    expect(res.body.connectionStatus).toBe('connected');
    expect(res.body.botAppSecret).toBe('***');
  });

  it('TC2: GET after configuration returns masked botAppSecret and connected', async () => {
    const res = await request.get('/api/v1/settings/teams');
    expect(res.status).toBe(200);
    expect(res.body.botAppSecret).toBe('***');
    expect(res.body.connectionStatus).toBe('connected');
  });

  it('TC5: PATCH with botAppSecret "***" preserves existing secret', async () => {
    const res = await request.patch('/api/v1/settings/teams').send({ botAppSecret: '***' });
    expect(res.status).toBe(200);
    const getRes = await request.get('/api/v1/settings/teams');
    expect(getRes.body.botAppSecret).toBe('***');
  });

  it('TC6: PATCH enable without botAppSecret returns 400', async () => {
    const freshPath = join(process.cwd(), `teams-config-fresh-${randomUUID()}.json`);
    process.env.ARGUS_TEAMS_CONFIG_PATH = freshPath;
    const res = await request.patch('/api/v1/settings/teams').send({
      enabled: true,
      botAppId: 'bid',
      tenantId: 'tid',
      teamId: 'team-id',
      channelId: 'chan-id',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('TEAMS_CONFIG_INVALID');
    process.env.ARGUS_TEAMS_CONFIG_PATH = configPath;
  });

  it('TC7: PATCH enable without botAppId returns 400', async () => {
    const freshPath7 = join(process.cwd(), `teams-config-fresh7-${randomUUID()}.json`);
    process.env.ARGUS_TEAMS_CONFIG_PATH = freshPath7;
    const res = await request.patch('/api/v1/settings/teams').send({
      enabled: true,
      botAppSecret: 'secret', tenantId: 'tid', teamId: 'team', channelId: 'chan',
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

  it('TC9: PATCH enable with auth failure returns 422', async () => {
    const freshPath9 = join(process.cwd(), `teams-config-fresh9-${randomUUID()}.json`);
    process.env.ARGUS_TEAMS_CONFIG_PATH = freshPath9;
    vi.mocked(_auth.botAuthService.getAccessToken).mockRejectedValueOnce(new Error('auth failed'));
    const res = await request.patch('/api/v1/settings/teams').send({
      enabled: true,
      botAppId: 'bad-id',
      botAppSecret: 'bad-secret',
      tenantId: 'tid',
      teamId: 'team',
      channelId: 'chan',
    });
    process.env.ARGUS_TEAMS_CONFIG_PATH = configPath;
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('TEAMS_BOT_AUTH_FAILED');
  });
});

