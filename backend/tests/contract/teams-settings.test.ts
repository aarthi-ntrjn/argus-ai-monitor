import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import supertest from 'supertest';
import { buildServer } from '../../src/server.js';
import { closeDb } from '../../src/db/database.js';

describe('GET /api/v1/settings/teams', () => {
  let request: ReturnType<typeof supertest>;
  let app: Awaited<ReturnType<typeof buildServer>>['app'];

  const ENV_KEYS = [
    'TEAMS_ENABLED',
    'TEAMS_TEAM_ID',
    'TEAMS_CHANNEL_ID',
    'TEAMS_OWNER_AAD_OBJECT_ID',
    'CLIENT_ID',
    'CLIENT_SECRET',
  ] as const;

  let savedEnv: Record<string, string | undefined> = {};

  beforeAll(async () => {
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

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (savedEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = savedEnv[key];
      }
    }
  });

  it('returns connectionStatus: disconnected when TEAMS_ENABLED is not set', async () => {
    const res = await request.get('/api/v1/settings/teams');
    expect(res.status).toBe(200);
    expect(res.body.connectionStatus).toBe('disconnected');
  });

  it('returns connectionStatus: unconfigured when enabled but CLIENT_ID/CLIENT_SECRET missing', async () => {
    process.env.TEAMS_ENABLED = 'true';
    process.env.TEAMS_TEAM_ID = 'T-001';
    process.env.TEAMS_CHANNEL_ID = 'C-001';

    const res = await request.get('/api/v1/settings/teams');
    expect(res.status).toBe(200);
    expect(res.body.connectionStatus).toBe('unconfigured');
  });

  it('returns connectionStatus: connected when all required env vars are set', async () => {
    process.env.TEAMS_ENABLED = 'true';
    process.env.TEAMS_TEAM_ID = 'T-001';
    process.env.TEAMS_CHANNEL_ID = 'C-001';
    process.env.TEAMS_OWNER_AAD_OBJECT_ID = 'owner-id';
    process.env.CLIENT_ID = 'client-id';
    process.env.CLIENT_SECRET = 'client-secret';

    const res = await request.get('/api/v1/settings/teams');
    expect(res.status).toBe(200);
    expect(res.body.connectionStatus).toBe('connected');
  });

  it('response shape includes enabled, teamId, channelId, ownerAadObjectId, connectionStatus', async () => {
    process.env.TEAMS_ENABLED = 'true';
    process.env.TEAMS_TEAM_ID = 'T-001';
    process.env.TEAMS_CHANNEL_ID = 'C-001';
    process.env.TEAMS_OWNER_AAD_OBJECT_ID = 'owner-id';
    process.env.CLIENT_ID = 'client-id';
    process.env.CLIENT_SECRET = 'client-secret';

    const res = await request.get('/api/v1/settings/teams');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('enabled');
    expect(res.body).toHaveProperty('teamId');
    expect(res.body).toHaveProperty('channelId');
    expect(res.body).toHaveProperty('ownerAadObjectId');
    expect(res.body).toHaveProperty('connectionStatus');
  });

  it('returns 200 in all cases', async () => {
    const res1 = await request.get('/api/v1/settings/teams');
    expect(res1.status).toBe(200);

    process.env.TEAMS_ENABLED = 'true';
    const res2 = await request.get('/api/v1/settings/teams');
    expect(res2.status).toBe(200);
  });
});
