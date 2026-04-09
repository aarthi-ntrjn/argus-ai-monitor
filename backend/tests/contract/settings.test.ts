import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import supertest from 'supertest';
import { buildServer } from '../../src/server.js';

describe('Settings API', () => {
  let request: ReturnType<typeof supertest>;
  let app: Awaited<ReturnType<typeof buildServer>>['app'];

  beforeAll(async () => {
    // Isolated config file per test run
    process.env.ARGUS_CONFIG_PATH = join(tmpdir(), `argus-settings-test-${randomUUID()}.json`);
    process.env.ARGUS_DB_PATH = join(tmpdir(), `argus-settings-db-${randomUUID()}.db`);
    const result = await buildServer();
    app = result.app;
    await app.ready();
    request = supertest(app.server);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1/settings', () => {
    it('returns 200 with all expected config fields', async () => {
      const res = await request.get('/api/v1/settings');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('port');
      expect(res.body).toHaveProperty('watchDirectories');
      expect(res.body).toHaveProperty('sessionRetentionHours');
      expect(res.body).toHaveProperty('outputRetentionMbPerSession');
      expect(res.body).toHaveProperty('autoRegisterRepos');
    });
  });

  describe('PATCH /api/v1/settings', () => {
    it('updates sessionRetentionHours and returns the updated config', async () => {
      const res = await request.patch('/api/v1/settings').send({ sessionRetentionHours: 48 });
      expect(res.status).toBe(200);
      expect(res.body.sessionRetentionHours).toBe(48);
    });

    it('persists the updated value across GET', async () => {
      await request.patch('/api/v1/settings').send({ sessionRetentionHours: 72 });
      const res = await request.get('/api/v1/settings');
      expect(res.body.sessionRetentionHours).toBe(72);
    });

    it('partial update — only supplied fields change', async () => {
      const before = (await request.get('/api/v1/settings')).body;
      await request.patch('/api/v1/settings').send({ sessionRetentionHours: 12 });
      const after = (await request.get('/api/v1/settings')).body;
      expect(after.port).toBe(before.port);
      expect(after.autoRegisterRepos).toBe(before.autoRegisterRepos);
      expect(after.sessionRetentionHours).toBe(12);
    });

    it('ignores unknown fields and does not persist them', async () => {
      const res = await request.patch('/api/v1/settings').send({ unknownField: true });
      expect(res.status).toBe(200);
      expect(res.body).not.toHaveProperty('unknownField');
    });
  });
});
