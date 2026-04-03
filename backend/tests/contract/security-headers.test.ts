import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import { buildServer } from '../../src/server.js';

describe('Security headers (FR-011, FR-012)', () => {
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

  const requiredHeaders = [
    ['x-content-type-options', 'nosniff'],
    ['x-frame-options', 'DENY'],
  ] as const;

  const routes = [
    { method: 'get' as const, path: '/health' },
    { method: 'get' as const, path: '/api/v1/sessions' },
    { method: 'get' as const, path: '/api/v1/fs/browse' },
    { method: 'post' as const, path: '/hooks/claude', body: { session_id: '550e8400-e29b-41d4-a716-446655440000', hook_event_name: 'PreToolUse' } },
  ];

  for (const route of routes) {
    describe(`${route.method.toUpperCase()} ${route.path}`, () => {
      for (const [header, value] of requiredHeaders) {
        it(`includes ${header}: ${value}`, async () => {
          const req = route.body
            ? request[route.method](route.path).send(route.body)
            : request[route.method](route.path);
          const res = await req;
          expect(res.headers[header]).toBe(value);
        });
      }

      it('does not expose server version in headers (FR-012)', async () => {
        const req = route.body
          ? request[route.method](route.path).send(route.body)
          : request[route.method](route.path);
        const res = await req;
        // Fastify does not add a Server header by default
        expect(res.headers['server']).toBeUndefined();
        // Express-style powered-by header must not appear
        expect(res.headers['x-powered-by']).toBeUndefined();
      });
    });
  }
});
