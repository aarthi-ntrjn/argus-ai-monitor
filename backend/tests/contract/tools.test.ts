import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import supertest from 'supertest';
import { buildServer } from '../../src/server.js';

describe('Tools API — yolo mode flag injection', () => {
  let request: ReturnType<typeof supertest>;
  let app: Awaited<ReturnType<typeof buildServer>>['app'];

  beforeAll(async () => {
    process.env.ARGUS_CONFIG_PATH = join(tmpdir(), `argus-tools-test-${randomUUID()}.json`);
    process.env.ARGUS_DB_PATH = join(tmpdir(), `argus-tools-db-${randomUUID()}.db`);
    const result = await buildServer();
    app = result.app;
    await app.ready();
    request = supertest(app.server);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1/tools — claudeCmd and copilotCmd', () => {
    it('does not include yolo flags when yoloMode is false (default)', async () => {
      const res = await request.get('/api/v1/tools');
      expect(res.status).toBe(200);
      if (res.body.claudeCmd) {
        expect(res.body.claudeCmd).not.toContain('--dangerously-skip-permissions');
      }
      if (res.body.copilotCmd) {
        expect(res.body.copilotCmd).not.toContain('--allow-all');
      }
    });

    it('includes --dangerously-skip-permissions in claudeCmd when yoloMode is true', async () => {
      await request.patch('/api/v1/settings').send({ yoloMode: true });
      const res = await request.get('/api/v1/tools');
      expect(res.status).toBe(200);
      if (res.body.claudeCmd) {
        expect(res.body.claudeCmd).toContain('--dangerously-skip-permissions');
      }
    });

    it('includes --allow-all in copilotCmd when yoloMode is true', async () => {
      await request.patch('/api/v1/settings').send({ yoloMode: true });
      const res = await request.get('/api/v1/tools');
      expect(res.status).toBe(200);
      if (res.body.copilotCmd) {
        expect(res.body.copilotCmd).toContain('--allow-all');
      }
    });

    it('removes yolo flags from claudeCmd after yoloMode is disabled', async () => {
      await request.patch('/api/v1/settings').send({ yoloMode: true });
      await request.patch('/api/v1/settings').send({ yoloMode: false });
      const res = await request.get('/api/v1/tools');
      expect(res.status).toBe(200);
      if (res.body.claudeCmd) {
        expect(res.body.claudeCmd).not.toContain('--dangerously-skip-permissions');
      }
    });

    it('removes yolo flags from copilotCmd after yoloMode is disabled', async () => {
      await request.patch('/api/v1/settings').send({ yoloMode: true });
      await request.patch('/api/v1/settings').send({ yoloMode: false });
      const res = await request.get('/api/v1/tools');
      expect(res.status).toBe(200);
      if (res.body.copilotCmd) {
        expect(res.body.copilotCmd).not.toContain('--allow-all');
      }
    });
  });
});
