import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import supertest from 'supertest';
import { buildServer } from '../../src/server.js';
import { closeDb } from '../../src/db/database.js';

describe('GET /api/v1/settings/slack', () => {
  let request: ReturnType<typeof supertest>;
  let app: Awaited<ReturnType<typeof buildServer>>['app'];

  const ENV_KEYS = ['SLACK_BOT_TOKEN', 'SLACK_APP_TOKEN', 'SLACK_CHANNEL_ID'] as const;

  let savedEnv: Record<string, string | undefined> = {};

  beforeAll(async () => {
    process.env.ARGUS_DB_PATH = ':memory:';
    closeDb();
    const result = await buildServer();
    app = result.app;
    await app.ready();
    request = supertest(app.server);
  });

  afterAll(async () => {
    await app.close();
    closeDb();
  });

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (savedEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = savedEnv[key];
      }
    }
  });

  it('returns 404 with NOT_CONFIGURED when env vars are not set', async () => {
    const res = await request.get('/api/v1/settings/slack');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NOT_CONFIGURED');
  });

  it('returns 200 with redacted config when SLACK_BOT_TOKEN and SLACK_CHANNEL_ID are set', async () => {
    process.env.SLACK_BOT_TOKEN = 'xoxb-real-token';
    process.env.SLACK_CHANNEL_ID = 'C99999';

    const res = await request.get('/api/v1/settings/slack');
    expect(res.status).toBe(200);
  });

  it('botToken is returned as the actual value', async () => {
    process.env.SLACK_BOT_TOKEN = 'xoxb-real-token';
    process.env.SLACK_CHANNEL_ID = 'C99999';

    const res = await request.get('/api/v1/settings/slack');
    expect(res.body.botToken).toBe('xoxb-real-token');
  });

  it('appToken is returned as the actual value when set', async () => {
    process.env.SLACK_BOT_TOKEN = 'xoxb-real-token';
    process.env.SLACK_CHANNEL_ID = 'C99999';
    process.env.SLACK_APP_TOKEN = 'xapp-real-token';

    const res = await request.get('/api/v1/settings/slack');
    expect(res.body.appToken).toBe('xapp-real-token');
  });

  it('appToken is absent when SLACK_APP_TOKEN is not set', async () => {
    process.env.SLACK_BOT_TOKEN = 'xoxb-real-token';
    process.env.SLACK_CHANNEL_ID = 'C99999';

    const res = await request.get('/api/v1/settings/slack');
    expect(res.body.appToken).toBeUndefined();
  });

  it('channelId is the actual channel ID (not redacted)', async () => {
    process.env.SLACK_BOT_TOKEN = 'xoxb-real-token';
    process.env.SLACK_CHANNEL_ID = 'C99999';

    const res = await request.get('/api/v1/settings/slack');
    expect(res.body.channelId).toBe('C99999');
  });

  it('enabled is true when config is present', async () => {
    process.env.SLACK_BOT_TOKEN = 'xoxb-real-token';
    process.env.SLACK_CHANNEL_ID = 'C99999';

    const res = await request.get('/api/v1/settings/slack');
    expect(res.body.enabled).toBe(true);
  });
});
