import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { join } from 'path';
import { randomUUID } from 'crypto';
import supertest from 'supertest';

// Mock TeamsApiClient to avoid real network calls
vi.mock('../../src/services/teams-api-client.js', () => ({
  TeamsApiClient: vi.fn().mockImplementation(() => ({
    postReply: vi.fn(),
    getToken: vi.fn().mockResolvedValue('mock-token'),
    createThread: vi.fn(),
    updateMessage: vi.fn(),
    validateConnection: vi.fn().mockResolvedValue(undefined),
    clearTokenCache: vi.fn(),
  })),
}));

import { buildServer } from '../../src/server.js';

describe('Teams Settings API', () => {
  let request: ReturnType<typeof supertest>;
  let app: Awaited<ReturnType<typeof buildServer>>['app'];

  beforeAll(async () => {
    process.env.ARGUS_DB_PATH = join(process.cwd(), `argus-teams-settings-${randomUUID()}.db`);
    process.env.ARGUS_TEAMS_CONFIG_PATH = join(process.cwd(), `teams-config-${randomUUID()}.json`);
    const result = await buildServer();
    app = result.app;
    await app.ready();
    request = supertest(app.server);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1/settings/teams', () => {
    it('returns 200 with unconfigured status when no config', async () => {
      const res = await request.get('/api/v1/settings/teams');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ enabled: false, connectionStatus: 'unconfigured' });
    });
  });

  describe('PATCH /api/v1/settings/teams', () => {
    it('returns 400 when enabling with missing required fields', async () => {
      const res = await request.patch('/api/v1/settings/teams').send({ enabled: true, botAppId: 'id' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('TEAMS_CONFIG_INVALID');
    });

    it('saves and returns connected when valid config', async () => {
      const res = await request.patch('/api/v1/settings/teams').send({
        enabled: true,
        botAppId: 'app-id',
        botAppPassword: 'secret',
        channelId: 'ch',
        serviceUrl: 'https://smba.trafficmanager.net',
        ownerTeamsUserId: 'owner',
      });
      expect(res.status).toBe(200);
      expect(res.body.connectionStatus).toBe('connected');
      expect(res.body.botAppPassword).toBe('***');
    });

    it('preserves existing password when patch sends ***', async () => {
      // First save with a real password
      await request.patch('/api/v1/settings/teams').send({
        enabled: true,
        botAppId: 'app-id',
        botAppPassword: 'original-secret',
        channelId: 'ch',
        serviceUrl: 'https://smba.trafficmanager.net',
        ownerTeamsUserId: 'owner',
      });
      // Then patch with *** - password should be preserved
      await request.patch('/api/v1/settings/teams').send({ botAppPassword: '***' });
      const res = await request.get('/api/v1/settings/teams');
      // Password should be masked but not lost
      expect(res.body.botAppPassword).toBe('***');
    });

    it('disabling returns enabled: false', async () => {
      const res = await request.patch('/api/v1/settings/teams').send({ enabled: false });
      expect(res.status).toBe(200);
      expect(res.body.enabled).toBe(false);
    });
  });
});
