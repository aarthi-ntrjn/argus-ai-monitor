import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import { buildServer } from '../../src/server.js';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

describe('Hooks API', () => {
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

  describe('POST /hooks/claude — body size limit (FR-005)', () => {
    it('returns 413 for body exceeding 64 KB', async () => {
      const largeBody = JSON.stringify({ session_id: VALID_UUID, hook_event_name: 'PreToolUse', data: 'x'.repeat(70 * 1024) });
      const res = await request
        .post('/hooks/claude')
        .set('Content-Type', 'application/json')
        .send(largeBody);
      expect(res.status).toBe(413);
    });
  });

  describe('POST /hooks/claude — session_id UUID validation (FR-006)', () => {
    it('returns 400 for non-UUID session_id (path traversal)', async () => {
      const res = await request
        .post('/hooks/claude')
        .send({ session_id: '../../etc/passwd', hook_event_name: 'PreToolUse' });
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ error: 'INVALID_SESSION_ID' });
    });

    it('returns 400 for empty session_id', async () => {
      const res = await request
        .post('/hooks/claude')
        .send({ session_id: '', hook_event_name: 'PreToolUse' });
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ error: 'INVALID_SESSION_ID' });
    });

    it('returns 400 for numeric session_id', async () => {
      const res = await request
        .post('/hooks/claude')
        .send({ session_id: 12345, hook_event_name: 'PreToolUse' });
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ error: 'INVALID_SESSION_ID' });
    });

    it('returns 400 for missing session_id', async () => {
      const res = await request
        .post('/hooks/claude')
        .send({ hook_event_name: 'PreToolUse' });
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ error: 'INVALID_SESSION_ID' });
    });

    it('returns 200 for valid UUID session_id with unrecognized cwd (FR-007)', async () => {
      // cwd not in registry → silently discarded, 200 returned
      const res = await request
        .post('/hooks/claude')
        .send({ session_id: VALID_UUID, hook_event_name: 'PreToolUse', cwd: '/nonexistent/repo/path' });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ ok: true });
    });
  });

  describe('POST /hooks/claude — PID conflict guard (FR-004)', () => {
    it('returns 409 when payload pid conflicts with stored session pid', async () => {
      const { upsertSession, insertRepository } = await import('../../src/db/database.js');
      const sessionId = '660e8400-e29b-41d4-a716-446655440001';
      insertRepository({ id: 'hook-conflict-repo', path: '/tmp/hook-conflict', name: 'hook-conflict', source: 'ui', addedAt: new Date().toISOString(), lastScannedAt: null });
      upsertSession({
        id: sessionId,
        repositoryId: 'hook-conflict-repo',
        type: 'claude-code',
        pid: 1234,
        status: 'active',
        startedAt: new Date().toISOString(),
        endedAt: null,
        lastActivityAt: new Date().toISOString(),
        summary: null,
        expiresAt: null,
        model: null,
      });
      const res = await request
        .post('/hooks/claude')
        .send({ session_id: sessionId, hook_event_name: 'PreToolUse', pid: 9999 });
      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ error: 'SESSION_PID_CONFLICT' });
    });

    it('returns 200 when payload pid matches the stored session pid', async () => {
      const { upsertSession, insertRepository } = await import('../../src/db/database.js');
      const sessionId = '660e8400-e29b-41d4-a716-446655440002';
      insertRepository({ id: 'hook-match-repo', path: '/tmp/hook-match', name: 'hook-match', source: 'ui', addedAt: new Date().toISOString(), lastScannedAt: null });
      upsertSession({
        id: sessionId,
        repositoryId: 'hook-match-repo',
        type: 'claude-code',
        pid: 5678,
        status: 'active',
        startedAt: new Date().toISOString(),
        endedAt: null,
        lastActivityAt: new Date().toISOString(),
        summary: null,
        expiresAt: null,
        model: null,
      });
      const res = await request
        .post('/hooks/claude')
        .send({ session_id: sessionId, hook_event_name: 'PreToolUse', pid: 5678 });
      expect(res.status).toBe(200);
    });
  });
});
