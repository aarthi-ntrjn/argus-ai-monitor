import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import { buildServer } from '../../src/server.js';
import { closeDb, insertRepository, upsertSession } from '../../src/db/database.js';

describe('POST /api/v1/sessions/:id/focus', () => {
  let request: ReturnType<typeof supertest>;
  let app: Awaited<ReturnType<typeof buildServer>>['app'];

  beforeAll(async () => {
    process.env.ARGUS_DB_PATH = ':memory:';
    closeDb();
    const result = await buildServer();
    app = result.app;
    await app.ready();
    request = supertest(app.server);

    insertRepository({
      id: 'focus-test-repo',
      path: '/tmp/focus-test',
      name: 'focus-test',
      source: 'ui',
      addedAt: new Date().toISOString(),
      lastScannedAt: null,
      branch: null,
      remoteUrl: null,
    });
  });

  afterAll(async () => {
    await app.close();
    closeDb();
  });

  it('returns 404 for unknown session', async () => {
    const res = await request.post('/api/v1/sessions/nonexistent-id/focus');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: 'NOT_FOUND' });
  });

  it('returns 409 for already-ended session', async () => {
    upsertSession({
      id: 'focus-ended-session',
      repositoryId: 'focus-test-repo',
      type: 'claude-code',
      launchMode: null,
      pid: null,
      hostPid: null,
      pidSource: null,
      status: 'ended',
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      summary: null,
      expiresAt: null,
      model: null,
      reconciled: true,
      yoloMode: null,
    });
    const res = await request.post('/api/v1/sessions/focus-ended-session/focus');
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ error: 'CONFLICT' });
  });

  it('returns 422 PID_NOT_SET for active session with no PID', async () => {
    upsertSession({
      id: 'focus-no-pid-session',
      repositoryId: 'focus-test-repo',
      type: 'claude-code',
      launchMode: null,
      pid: null,
      hostPid: null,
      pidSource: null,
      status: 'active',
      startedAt: new Date().toISOString(),
      endedAt: null,
      lastActivityAt: new Date().toISOString(),
      summary: null,
      expiresAt: null,
      model: null,
      reconciled: true,
      yoloMode: null,
    });
    const res = await request.post('/api/v1/sessions/focus-no-pid-session/focus');
    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({ error: 'PID_NOT_SET' });
  });
});
