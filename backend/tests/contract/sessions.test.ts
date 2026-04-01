import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import { buildServer } from '../../src/server.js';

describe('Sessions API', () => {
  let request: ReturnType<typeof supertest>;
  let app: Awaited<ReturnType<typeof buildServer>>['app'];

  beforeAll(async () => {
    const result = await buildServer();
    app = result.app;
    await app.ready();
    request = supertest(app.server);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1/sessions', () => {
    it('returns 200 with array', async () => {
      const res = await request.get('/api/v1/sessions');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('accepts repositoryId filter', async () => {
      const res = await request.get('/api/v1/sessions?repositoryId=test-id');
      expect(res.status).toBe(200);
    });

    it('accepts status filter', async () => {
      const res = await request.get('/api/v1/sessions?status=active');
      expect(res.status).toBe(200);
    });

    it('accepts type filter', async () => {
      const res = await request.get('/api/v1/sessions?type=copilot-cli');
      expect(res.status).toBe(200);
    });
  });
});