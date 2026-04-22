import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import { buildServer } from '../../src/server.js';
import { closeDb } from '../../src/db/database.js';

vi.mock('../../src/config/slack-config-loader.js', () => ({
  loadSlackConfig: vi.fn(),
  saveSlackConfig: vi.fn(),
  getSlackConfigPath: vi.fn().mockReturnValue('/mock/.argus/slack.config'),
}));

import { loadSlackConfig } from '../../src/config/slack-config-loader.js';

describe('GET /api/v1/settings/slack', () => {
  let request: ReturnType<typeof supertest>;
  let app: Awaited<ReturnType<typeof buildServer>>['app'];

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

  it('returns 404 with NOT_CONFIGURED when no config file exists', async () => {
    vi.mocked(loadSlackConfig).mockReturnValue(null);
    const res = await request.get('/api/v1/settings/slack');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NOT_CONFIGURED');
  });

  it('returns 200 when config has botToken and channelId', async () => {
    vi.mocked(loadSlackConfig).mockReturnValue({ botToken: 'xoxb-real-token', channelId: 'C99999', enabled: true });
    const res = await request.get('/api/v1/settings/slack');
    expect(res.status).toBe(200);
  });

  it('botToken is returned as the actual value', async () => {
    vi.mocked(loadSlackConfig).mockReturnValue({ botToken: 'xoxb-real-token', channelId: 'C99999', enabled: true });
    const res = await request.get('/api/v1/settings/slack');
    expect(res.body.botToken).toBe('xoxb-real-token');
  });

  it('appToken is returned as the actual value when set', async () => {
    vi.mocked(loadSlackConfig).mockReturnValue({ botToken: 'xoxb-real-token', appToken: 'xapp-real-token', channelId: 'C99999', enabled: true });
    const res = await request.get('/api/v1/settings/slack');
    expect(res.body.appToken).toBe('xapp-real-token');
  });

  it('appToken is absent when not in config', async () => {
    vi.mocked(loadSlackConfig).mockReturnValue({ botToken: 'xoxb-real-token', channelId: 'C99999', enabled: true });
    const res = await request.get('/api/v1/settings/slack');
    expect(res.body.appToken).toBeUndefined();
  });

  it('channelId is the actual channel ID', async () => {
    vi.mocked(loadSlackConfig).mockReturnValue({ botToken: 'xoxb-real-token', channelId: 'C99999', enabled: true });
    const res = await request.get('/api/v1/settings/slack');
    expect(res.body.channelId).toBe('C99999');
  });

  it('enabled is true when config is present', async () => {
    vi.mocked(loadSlackConfig).mockReturnValue({ botToken: 'xoxb-real-token', channelId: 'C99999', enabled: true });
    const res = await request.get('/api/v1/settings/slack');
    expect(res.body.enabled).toBe(true);
  });
});
