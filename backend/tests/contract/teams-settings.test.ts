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

  it('returns connectionStatus: disconnected when no config file exists', async () => {
    vi.mocked(loadTeamsConfig).mockReturnValue({ enabled: false });
    const res = await request.get('/api/v1/settings/teams');
    expect(res.status).toBe(200);
    expect(res.body.connectionStatus).toBe('disconnected');
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
      ownerAadObjectId: 'owner-id',
      clientId: 'client-id',
      clientSecret: 'client-secret',
    });
    const res = await request.get('/api/v1/settings/teams');
    expect(res.status).toBe(200);
    expect(res.body.connectionStatus).toBe('connected');
  });

  it('response shape includes enabled, teamId, channelId, ownerAadObjectId, connectionStatus', async () => {
    vi.mocked(loadTeamsConfig).mockReturnValue({
      enabled: true,
      teamId: 'T-001',
      channelId: 'C-001',
      ownerAadObjectId: 'owner-id',
      clientId: 'client-id',
      clientSecret: 'client-secret',
    });
    const res = await request.get('/api/v1/settings/teams');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('enabled');
    expect(res.body).toHaveProperty('teamId');
    expect(res.body).toHaveProperty('channelId');
    expect(res.body).toHaveProperty('ownerAadObjectId');
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
