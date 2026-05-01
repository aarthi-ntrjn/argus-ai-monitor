import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import supertest from 'supertest';
import { buildServer } from '../../src/server.js';

// Prevent real outbound HTTP calls from the telemetry service during tests
vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 200 }));

describe('Telemetry relay API', () => {
  let request: ReturnType<typeof supertest>;
  let app: Awaited<ReturnType<typeof buildServer>>['app'];

  beforeAll(async () => {
    process.env.ARGUS_CONFIG_PATH = join(tmpdir(), `argus-telemetry-contract-${randomUUID()}.json`);
    process.env.ARGUS_DB_PATH = join(tmpdir(), `argus-telemetry-db-${randomUUID()}.db`);
    process.env.TELEMETRY_URL = 'http://localhost:19999/capture/';
    const result = await buildServer();
    app = result.app;
    await app.ready();
    request = supertest(app.server);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/v1/telemetry/event', () => {
    it('returns 204 for a valid event type', async () => {
      const res = await request.post('/api/v1/telemetry/event').send({ type: 'app_started' });
      expect(res.status).toBe(204);
    });

    it('event payload does not contain $geoip_disable', async () => {
      let capturedBody: string | undefined;
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((_url, init) => {
        capturedBody = init?.body as string;
        return Promise.resolve(new Response(null, { status: 200 }));
      });
      await request.post('/api/v1/telemetry/event').send({ type: 'app_started' });
      if (capturedBody) {
        const payload = JSON.parse(capturedBody);
        expect(payload.properties).not.toHaveProperty('$geoip_disable');
      }
      fetchSpy.mockRestore();
    });

    it('event payload does not contain $ip', async () => {
      let capturedBody: string | undefined;
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((_url, init) => {
        capturedBody = init?.body as string;
        return Promise.resolve(new Response(null, { status: 200 }));
      });
      await request.post('/api/v1/telemetry/event').send({ type: 'app_started' });
      if (capturedBody) {
        const payload = JSON.parse(capturedBody);
        expect(payload.properties).not.toHaveProperty('$ip');
      }
      fetchSpy.mockRestore();
    });

    it('returns 204 for session_started with sessionType', async () => {
      const res = await request
        .post('/api/v1/telemetry/event')
        .send({ type: 'session_started', sessionType: 'claude-code' });
      expect(res.status).toBe(204);
    });

    it('returns 400 with INVALID_EVENT_TYPE for an unknown type', async () => {
      const res = await request.post('/api/v1/telemetry/event').send({ type: 'unknown_event' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('INVALID_EVENT_TYPE');
      expect(res.body).toHaveProperty('message');
      expect(res.body).toHaveProperty('requestId');
    });

    it('returns 400 when type is missing', async () => {
      const res = await request.post('/api/v1/telemetry/event').send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('INVALID_EVENT_TYPE');
    });

    it('returns 503 with TELEMETRY_DISABLED when telemetryEnabled is false', async () => {
      await request.patch('/api/v1/settings').send({ telemetryEnabled: false });
      const res = await request.post('/api/v1/telemetry/event').send({ type: 'app_started' });
      expect(res.status).toBe(503);
      expect(res.body.error).toBe('TELEMETRY_DISABLED');
      expect(res.body).toHaveProperty('message');
      expect(res.body).toHaveProperty('requestId');
      // Re-enable for subsequent tests
      await request.patch('/api/v1/settings').send({ telemetryEnabled: true });
    });
  });

  describe('GET /api/v1/settings — telemetry fields', () => {
    it('returns telemetryEnabled: true by default', async () => {
      const res = await request.get('/api/v1/settings');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('telemetryEnabled', true);
    });

    it('returns telemetryPromptSeen: false by default', async () => {
      const res = await request.get('/api/v1/settings');
      expect(res.body).toHaveProperty('telemetryPromptSeen', false);
    });
  });

  describe('PATCH /api/v1/settings — telemetry fields', () => {
    it('persists telemetryEnabled: false', async () => {
      await request.patch('/api/v1/settings').send({ telemetryEnabled: false });
      const res = await request.get('/api/v1/settings');
      expect(res.body.telemetryEnabled).toBe(false);
      await request.patch('/api/v1/settings').send({ telemetryEnabled: true });
    });

    it('persists telemetryPromptSeen: true', async () => {
      await request.patch('/api/v1/settings').send({ telemetryPromptSeen: true });
      const res = await request.get('/api/v1/settings');
      expect(res.body.telemetryPromptSeen).toBe(true);
    });
  });
});
