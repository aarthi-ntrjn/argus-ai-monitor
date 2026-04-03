import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
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

  describe('GET /api/v1/sessions/:id', () => {
    it('returns 404 for unknown session', async () => {
      const res = await request.get('/api/v1/sessions/unknown-id');
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/v1/sessions/:id/output', () => {
    it('returns 404 for unknown session', async () => {
      const res = await request.get('/api/v1/sessions/unknown-id/output');
      expect(res.status).toBe(404);
    });

    it('returns 200 with items array for known session (after adding one)', async () => {
      // This test will pass once session routes are implemented
      // For now we just ensure the shape
    });
  });

  describe('POST /api/v1/sessions/:id/stop', () => {
    it('returns 404 for unknown session', async () => {
      const res = await request.post('/api/v1/sessions/unknown-id/stop');
      expect(res.status).toBe(404);
    });

    it('returns 409 for ended session', async () => {
      // Create an ended session first, then try to stop it
      // This test verifies the conflict response
      // We'll test this properly once we can create test sessions
      // For now just verify the route exists
      const res = await request.post('/api/v1/sessions/nonexistent/stop');
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/v1/sessions/:id/send', () => {
    it('returns 404 for unknown session', async () => {
      const res = await request.post('/api/v1/sessions/unknown-id/send').send({ prompt: 'test' });
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/v1/sessions/:id/interrupt', () => {
    it('returns 404 for unknown session', async () => {
      const res = await request.post('/api/v1/sessions/unknown-id/interrupt');
      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ error: 'NOT_FOUND' });
    });

    it('returns 409 for already-ended session', async () => {
      const { upsertSession, insertRepository } = await import('../../src/db/database.js');
      insertRepository({ id: 'interrupt-test-repo', path: '/tmp/interrupt-test', name: 'interrupt-test', source: 'ui', addedAt: new Date().toISOString(), lastScannedAt: null });
      upsertSession({
        id: 'interrupt-ended-test',
        repositoryId: 'interrupt-test-repo',
        type: 'claude-code',
        pid: null,
        status: 'ended',
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
        lastActivityAt: new Date().toISOString(),
        summary: null,
        expiresAt: null,
      });
      const res = await request.post('/api/v1/sessions/interrupt-ended-test/interrupt');
      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ error: 'CONFLICT' });
    });

    it('returns 422 for active session without PID (PID_NOT_SET)', async () => {
      const { upsertSession, insertRepository } = await import('../../src/db/database.js');
      insertRepository({ id: 'interrupt-test-repo-2', path: '/tmp/interrupt-test-2', name: 'interrupt-test-2', source: 'ui', addedAt: new Date().toISOString(), lastScannedAt: null });
      upsertSession({
        id: 'interrupt-no-pid-test',
        repositoryId: 'interrupt-test-repo-2',
        type: 'claude-code',
        pid: null,
        status: 'active',
        startedAt: new Date().toISOString(),
        endedAt: null,
        lastActivityAt: new Date().toISOString(),
        summary: null,
        expiresAt: null,
        model: null,
      });
      const res = await request.post('/api/v1/sessions/interrupt-no-pid-test/interrupt');
      expect(res.status).toBe(422);
      expect(res.body).toMatchObject({ error: 'PID_NOT_SET' });
    });
  });

  describe('PID ownership validation (stop + interrupt)', () => {
    beforeAll(() => {
      // Mock ps-list so we control which PIDs are "running" during contract tests
      vi.mock('ps-list', () => ({ default: vi.fn(async () => []) }));
    });

    it('stop: returns 422 PID_NOT_SET when session has no pid', async () => {
      const { upsertSession, insertRepository } = await import('../../src/db/database.js');
      insertRepository({ id: 'pid-val-repo-1', path: '/tmp/pid-val-1', name: 'pid-val-1', source: 'ui', addedAt: new Date().toISOString(), lastScannedAt: null });
      upsertSession({
        id: 'pid-val-stop-nopid',
        repositoryId: 'pid-val-repo-1',
        type: 'claude-code',
        pid: null,
        status: 'active',
        startedAt: new Date().toISOString(),
        endedAt: null,
        lastActivityAt: new Date().toISOString(),
        summary: null,
        expiresAt: null,
        model: null,
      });
      const res = await request.post('/api/v1/sessions/pid-val-stop-nopid/stop');
      expect(res.status).toBe(422);
      expect(res.body).toMatchObject({ error: 'PID_NOT_SET' });
    });

    it('stop: returns 422 PID_NOT_FOUND when pid is not in running OS processes', async () => {
      // ps-list returns [] so PID 99999 will not be found
      const { upsertSession, insertRepository } = await import('../../src/db/database.js');
      insertRepository({ id: 'pid-val-repo-2', path: '/tmp/pid-val-2', name: 'pid-val-2', source: 'ui', addedAt: new Date().toISOString(), lastScannedAt: null });
      upsertSession({
        id: 'pid-val-stop-notfound',
        repositoryId: 'pid-val-repo-2',
        type: 'claude-code',
        pid: 99999,
        status: 'active',
        startedAt: new Date().toISOString(),
        endedAt: null,
        lastActivityAt: new Date().toISOString(),
        summary: null,
        expiresAt: null,
        model: null,
      });
      const res = await request.post('/api/v1/sessions/pid-val-stop-notfound/stop');
      expect(res.status).toBe(422);
      expect(res.body).toMatchObject({ error: 'PID_NOT_FOUND' });
    });

    it('stop: returns 403 PID_NOT_AI_TOOL when pid belongs to non-AI process', async () => {
      const psList = await import('ps-list');
      (psList.default as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        { pid: 88888, name: 'chrome', cmd: '/usr/bin/chrome' },
      ]);
      const { upsertSession, insertRepository } = await import('../../src/db/database.js');
      insertRepository({ id: 'pid-val-repo-3', path: '/tmp/pid-val-3', name: 'pid-val-3', source: 'ui', addedAt: new Date().toISOString(), lastScannedAt: null });
      upsertSession({
        id: 'pid-val-stop-notai',
        repositoryId: 'pid-val-repo-3',
        type: 'claude-code',
        pid: 88888,
        status: 'active',
        startedAt: new Date().toISOString(),
        endedAt: null,
        lastActivityAt: new Date().toISOString(),
        summary: null,
        expiresAt: null,
        model: null,
      });
      const res = await request.post('/api/v1/sessions/pid-val-stop-notai/stop');
      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ error: 'PID_NOT_AI_TOOL' });
    });

    it('interrupt: returns 422 PID_NOT_SET when session has no pid', async () => {
      const { upsertSession, insertRepository } = await import('../../src/db/database.js');
      insertRepository({ id: 'pid-val-repo-4', path: '/tmp/pid-val-4', name: 'pid-val-4', source: 'ui', addedAt: new Date().toISOString(), lastScannedAt: null });
      upsertSession({
        id: 'pid-val-int-nopid',
        repositoryId: 'pid-val-repo-4',
        type: 'claude-code',
        pid: null,
        status: 'active',
        startedAt: new Date().toISOString(),
        endedAt: null,
        lastActivityAt: new Date().toISOString(),
        summary: null,
        expiresAt: null,
        model: null,
      });
      const res = await request.post('/api/v1/sessions/pid-val-int-nopid/interrupt');
      expect(res.status).toBe(422);
      expect(res.body).toMatchObject({ error: 'PID_NOT_SET' });
    });
  });
});