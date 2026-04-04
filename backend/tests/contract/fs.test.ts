import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import supertest from 'supertest';
import { buildServer } from '../../src/server.js';

// A path that is definitely outside the home directory on both Windows and Linux
const OUTSIDE_HOME = process.platform === 'win32' ? 'C:\\Windows\\System32' : '/etc/passwd';

describe('POST /api/v1/fs/scan-folder', () => {
  let request: ReturnType<typeof supertest>;
  let app: Awaited<ReturnType<typeof buildServer>>['app'];
  let tmp: string;

  beforeAll(async () => {
    const result = await buildServer();
    app = result.app;
    await app.ready();
    request = supertest(app.server);
    // Use homedir() so the temp path is within the path sandbox boundary
    tmp = mkdtempSync(join(homedir(), 'argus-fs-test-'));
  });

  afterAll(async () => {
    await app.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  it('returns 400 with requestId when body is missing path', async () => {
    const res = await request.post('/api/v1/fs/scan-folder').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('MISSING_PATH');
    expect(res.body.requestId).toBeDefined();
  });

  it('returns 404 with requestId when path does not exist', async () => {
    const res = await request
      .post('/api/v1/fs/scan-folder')
      .send({ path: join(tmp, 'nonexistent-folder') });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('PATH_NOT_FOUND');
    expect(res.body.message).toBeTruthy();
    expect(res.body.requestId).toBeDefined();
  });

  it('returns 200 with empty repos array for folder with no git repos', async () => {
    const emptyDir = join(tmp, 'empty');
    mkdirSync(emptyDir);
    const res = await request.post('/api/v1/fs/scan-folder').send({ path: emptyDir });
    expect(res.status).toBe(200);
    expect(res.body.repos).toEqual([]);
  });

  it('returns found git repos with path and name', async () => {
    const parent = join(tmp, 'workspace');
    mkdirSync(join(parent, 'proj-a', '.git'), { recursive: true });
    mkdirSync(join(parent, 'proj-b', '.git'), { recursive: true });
    const res = await request.post('/api/v1/fs/scan-folder').send({ path: parent });
    expect(res.status).toBe(200);
    expect(res.body.repos).toHaveLength(2);
    const names = res.body.repos.map((r: { name: string }) => r.name).sort();
    expect(names).toEqual(['proj-a', 'proj-b']);
    expect(res.body.repos[0].path).toBeTruthy();
  });

  it('returns the folder itself if it is a git repo', async () => {
    const gitRepo = join(tmp, 'self-repo');
    mkdirSync(join(gitRepo, '.git'), { recursive: true });
    const res = await request.post('/api/v1/fs/scan-folder').send({ path: gitRepo });
    expect(res.status).toBe(200);
    expect(res.body.repos).toHaveLength(1);
    expect(res.body.repos[0].name).toBe('self-repo');
  });
});

describe('Filesystem path boundary enforcement (FR-008, FR-009)', () => {
  let request: ReturnType<typeof supertest>;
  let app: Awaited<ReturnType<typeof buildServer>>['app'];
  let tmp: string;

  beforeAll(async () => {
    const result = await buildServer();
    app = result.app;
    await app.ready();
    request = supertest(app.server);
    tmp = mkdtempSync(join(homedir(), 'argus-boundary-test-'));
  });

  afterAll(async () => {
    await app.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  describe('POST /api/v1/fs/scan-folder', () => {
    it('returns 403 for path outside home dir', async () => {
      const res = await request
        .post('/api/v1/fs/scan-folder')
        .send({ path: OUTSIDE_HOME });
      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ error: 'PATH_OUTSIDE_BOUNDARY' });
    });

    it('returns 403 for path with traversal sequences that escape home dir', async () => {
      const traversal = join(homedir(), '..', '..', 'etc');
      const res = await request
        .post('/api/v1/fs/scan-folder')
        .send({ path: traversal });
      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ error: 'PATH_OUTSIDE_BOUNDARY' });
    });

    it('returns 200 for a valid path within home dir (tmp is inside home or is home)', async () => {
      // tmp is a subdirectory of the OS temp dir, which may or may not be under home.
      // Use an actual subdir of homedir() to guarantee it passes.
      const safeDir = mkdtempSync(join(homedir(), 'argus-boundary-safe-'));
      try {
        const res = await request
          .post('/api/v1/fs/scan-folder')
          .send({ path: safeDir });
        expect(res.status).toBe(200);
      } finally {
        rmSync(safeDir, { recursive: true, force: true });
      }
    });
  });

  describe('GET /api/v1/fs/browse', () => {
    it('returns 403 for path outside home dir', async () => {
      const res = await request.get(`/api/v1/fs/browse?path=${encodeURIComponent(OUTSIDE_HOME)}`);
      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ error: 'PATH_OUTSIDE_BOUNDARY' });
    });

    it('returns 403 for traversal path escaping home dir', async () => {
      const traversal = encodeURIComponent(join(homedir(), '..', '..', 'etc'));
      const res = await request.get(`/api/v1/fs/browse?path=${traversal}`);
      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ error: 'PATH_OUTSIDE_BOUNDARY' });
    });

    it('returns 200 for a valid path within home dir', async () => {
      const res = await request.get(`/api/v1/fs/browse?path=${encodeURIComponent(homedir())}`);
      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/v1/fs/scan', () => {
    it('returns 403 for path outside home dir', async () => {
      const res = await request.get(`/api/v1/fs/scan?path=${encodeURIComponent(OUTSIDE_HOME)}`);
      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ error: 'PATH_OUTSIDE_BOUNDARY' });
    });

    it('returns 200 for a valid path within home dir', async () => {
      const res = await request.get(`/api/v1/fs/scan?path=${encodeURIComponent(homedir())}`);
      expect(res.status).toBe(200);
    });
  });
});
