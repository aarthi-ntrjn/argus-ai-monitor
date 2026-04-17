import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import supertest from 'supertest';
import { buildServer } from '../../src/server.js';

describe('Repositories API', () => {
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

  describe('GET /api/v1/repositories', () => {
    it('returns 200 with array', async () => {
      const res = await request.get('/api/v1/repositories');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('POST /api/v1/repositories', () => {
    it('returns 400 for missing path', async () => {
      const res = await request.post('/api/v1/repositories').send({});
      expect(res.status).toBe(400);
    });

    it('returns 400 for path without .git', async () => {
      const res = await request.post('/api/v1/repositories').send({ path: 'C:\\nonexistent\\path' });
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/v1/repositories/:id', () => {
    it('returns 404 for unknown id', async () => {
      const res = await request.delete('/api/v1/repositories/unknown-id');
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/v1/repositories/rescan-remotes', () => {
    it('returns 200 with updated and total counts', async () => {
      const res = await request.post('/api/v1/repositories/rescan-remotes');
      expect(res.status).toBe(200);
      expect(typeof res.body.updated).toBe('number');
      expect(typeof res.body.total).toBe('number');
      expect(res.body.total).toBeGreaterThanOrEqual(res.body.updated);
    });
  });
});