import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { join } from 'path';
import { randomUUID } from 'crypto';
import supertest from 'supertest';

// Mock the webhook module - override _auth.validateToken via the mutable reference
vi.mock('../../src/api/routes/teams-webhook.js', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../src/api/routes/teams-webhook.js')>();
  const mockFn = vi.fn().mockResolvedValue(true);
  mod._auth.validateToken = mockFn;
  return {
    ...mod,
    validateBotFrameworkToken: mockFn,
  };
});

// Mock teams config
vi.mock('../../src/config/teams-config-loader.js', () => ({
  loadTeamsConfig: vi.fn().mockReturnValue({
    enabled: true,
    botAppId: 'app-id',
    botAppPassword: 'secret',
    channelId: 'ch',
    serviceUrl: 'https://smba.trafficmanager.net',
    ownerTeamsUserId: 'owner-user-id',
  }),
}));

// Mock teams api client postReply to avoid real network calls
vi.mock('../../src/services/teams-api-client.js', () => ({
  TeamsApiClient: vi.fn().mockImplementation(() => ({
    postReply: vi.fn().mockResolvedValue({ messageId: 'reply-id' }),
    getToken: vi.fn().mockResolvedValue('token'),
    createThread: vi.fn(),
    updateMessage: vi.fn(),
    validateConnection: vi.fn(),
    clearTokenCache: vi.fn(),
  })),
}));

import { buildServer } from '../../src/server.js';
import { validateBotFrameworkToken } from '../../src/api/routes/teams-webhook.js';

describe('Teams Webhook API', () => {
  let request: ReturnType<typeof supertest>;
  let app: Awaited<ReturnType<typeof buildServer>>['app'];

  beforeAll(async () => {
    process.env.ARGUS_DB_PATH = join(process.cwd(), `argus-webhook-test-${randomUUID()}.db`);
    process.env.ARGUS_TEAMS_CONFIG_PATH = join(process.cwd(), `teams-config-${randomUUID()}.json`);
    const result = await buildServer();
    app = result.app;
    await app.ready();
    request = supertest(app.server);
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 401 when JWT validation fails', async () => {
    vi.mocked(validateBotFrameworkToken).mockResolvedValueOnce(false);
    const res = await request.post('/api/botframework/messages').send({
      type: 'message',
      from: { id: 'user-1' },
      conversation: { id: 'thread-1' },
      text: 'hello',
    });
    expect(res.status).toBe(401);
  });

  it('returns 400 when missing from field', async () => {
    vi.mocked(validateBotFrameworkToken).mockResolvedValueOnce(true);
    const res = await request.post('/api/botframework/messages').send({
      type: 'message',
      conversation: { id: 'thread-1' },
      text: 'hello',
    });
    expect(res.status).toBe(400);
  });

  it('returns 200 no-op for unknown thread', async () => {
    vi.mocked(validateBotFrameworkToken).mockResolvedValueOnce(true);
    const res = await request.post('/api/botframework/messages').send({
      type: 'message',
      from: { id: 'owner-user-id' },
      conversation: { id: 'unknown-thread' },
      text: 'hello',
    });
    expect(res.status).toBe(200);
  });

  it('returns 200 no-op for non-message activity type', async () => {
    vi.mocked(validateBotFrameworkToken).mockResolvedValueOnce(true);
    const res = await request.post('/api/botframework/messages').send({
      type: 'typing',
      from: { id: 'owner-user-id' },
      conversation: { id: 'some-thread' },
    });
    expect(res.status).toBe(200);
  });
});


describe('Teams Webhook API', () => {
  let request: ReturnType<typeof supertest>;
  let app: Awaited<ReturnType<typeof buildServer>>['app'];

  beforeAll(async () => {
    process.env.ARGUS_DB_PATH = join(process.cwd(), `argus-webhook-test-${randomUUID()}.db`);
    process.env.ARGUS_TEAMS_CONFIG_PATH = join(process.cwd(), `teams-config-${randomUUID()}.json`);
    const result = await buildServer();
    app = result.app;
    await app.ready();
    request = supertest(app.server);
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 401 when JWT validation fails', async () => {
    vi.mocked(validateBotFrameworkToken).mockResolvedValueOnce(false);
    const res = await request.post('/api/botframework/messages').send({
      type: 'message',
      from: { id: 'user-1' },
      conversation: { id: 'thread-1' },
      text: 'hello',
    });
    expect(res.status).toBe(401);
  });

  it('returns 400 when missing from field', async () => {
    vi.mocked(validateBotFrameworkToken).mockResolvedValueOnce(true);
    const res = await request.post('/api/botframework/messages').send({
      type: 'message',
      conversation: { id: 'thread-1' },
      text: 'hello',
    });
    expect(res.status).toBe(400);
  });

  it('returns 200 no-op for unknown thread', async () => {
    vi.mocked(validateBotFrameworkToken).mockResolvedValueOnce(true);
    const res = await request.post('/api/botframework/messages').send({
      type: 'message',
      from: { id: 'owner-user-id' },
      conversation: { id: 'unknown-thread' },
      text: 'hello',
    });
    expect(res.status).toBe(200);
  });

  it('returns 200 no-op for non-message activity type', async () => {
    vi.mocked(validateBotFrameworkToken).mockResolvedValueOnce(true);
    const res = await request.post('/api/botframework/messages').send({
      type: 'typing',
      from: { id: 'owner-user-id' },
      conversation: { id: 'some-thread' },
    });
    expect(res.status).toBe(200);
  });
});
