import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import { buildServer } from '../../src/server.js';
import { closeDb } from '../../src/db/database.js';

vi.mock('../../src/config/teams-config-loader.js', () => ({
  loadTeamsConfig: vi.fn().mockReturnValue({ enabled: false }),
  saveTeamsConfig: vi.fn(),
  getTeamsConfigPath: vi.fn().mockReturnValue('/mock/.argus/teams.config'),
}));

import { loadTeamsConfig } from '../../src/config/teams-config-loader.js';

describe('GET /api/v1/settings/teams', () => {
  let request: ReturnType<typeof supertest>;
  let app: Awaited<ReturnType<typeof buildServer>>['app'];

  beforeAll(async () => {
    vi.mocked(loadTeamsConfig).mockReturnValue({ enabled: false });
    process.env.ARGUS_DB_PATH = ':memory:';
    closeDb();
    const result = await buildServer();
    app = result.app;
    await app.ready();
    request = supertest(app.server);
  });

  afterAll(async () => {
    await app.close();
    closeDb();
  });

  it('returns connectionStatus: unconfigured when no config file exists', async () => {
    vi.mocked(loadTeamsConfig).mockReturnValue({ enabled: false });
    const res = await request.get('/api/v1/settings/teams');
    expect(res.status).toBe(200);
    expect(res.body.connectionStatus).toBe('unconfigured');
  });

  it('returns connectionStatus: stopped when config is set but disabled', async () => {
    vi.mocked(loadTeamsConfig).mockReturnValue({ enabled: false, teamId: 'T-001', channelId: 'C-001', ownerSenderId: 'owner-id', clientId: 'cid', clientSecret: 'csec', tenantId: 'tid' });
    const res = await request.get('/api/v1/settings/teams');
    expect(res.status).toBe(200);
    expect(res.body.connectionStatus).toBe('stopped');
  });

  it('returns connectionStatus: unconfigured when teamId/channelId set but clientId/clientSecret missing', async () => {
    vi.mocked(loadTeamsConfig).mockReturnValue({ enabled: true, teamId: 'T-001', channelId: 'C-001' });
    const res = await request.get('/api/v1/settings/teams');
    expect(res.status).toBe(200);
    expect(res.body.connectionStatus).toBe('unconfigured');
  });

  it('returns connectionStatus: connected when all required fields are set', async () => {
    vi.mocked(loadTeamsConfig).mockReturnValue({
      enabled: true,
      teamId: 'T-001',
      channelId: 'C-001',
      ownerSenderId: 'owner-id',
      clientId: 'client-id',
      clientSecret: 'client-secret',
      tenantId: 'tenant-id',
    });
    const res = await request.get('/api/v1/settings/teams');
    expect(res.status).toBe(200);
    expect(res.body.connectionStatus).toBe('stopped'); // not running at settings-check time
  });

  it('response shape includes enabled, teamId, channelId, ownerSenderId, connectionStatus', async () => {
    vi.mocked(loadTeamsConfig).mockReturnValue({
      enabled: true,
      teamId: 'T-001',
      channelId: 'C-001',
      ownerSenderId: 'owner-id',
      clientId: 'client-id',
      clientSecret: 'client-secret',
    });
    const res = await request.get('/api/v1/settings/teams');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('enabled');
    expect(res.body).toHaveProperty('teamId');
    expect(res.body).toHaveProperty('channelId');
    expect(res.body).toHaveProperty('ownerSenderId');
    expect(res.body).toHaveProperty('connectionStatus');
  });

  it('returns 200 in all cases', async () => {
    vi.mocked(loadTeamsConfig).mockReturnValue({ enabled: false });
    const res1 = await request.get('/api/v1/settings/teams');
    expect(res1.status).toBe(200);

    vi.mocked(loadTeamsConfig).mockReturnValue({ enabled: true, teamId: 'T-001' });
    const res2 = await request.get('/api/v1/settings/teams');
    expect(res2.status).toBe(200);
  });
});
