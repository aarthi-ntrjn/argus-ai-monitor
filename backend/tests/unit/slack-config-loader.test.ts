import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadSlackConfig } from '../../src/config/slack-config-loader.js';

describe('loadSlackConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.SLACK_BOT_TOKEN;
    delete process.env.SLACK_APP_TOKEN;
    delete process.env.SLACK_CHANNEL_ID;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns null when no env vars are set', () => {
    expect(loadSlackConfig()).toBeNull();
  });

  it('returns null when only unrelated env vars exist', () => {
    process.env.SLACK_APP_TOKEN = 'xapp-1-something';
    expect(loadSlackConfig()).toBeNull();
  });

  it('returns config when SLACK_BOT_TOKEN is set', () => {
    process.env.SLACK_BOT_TOKEN = 'xoxb-test-token';
    const config = loadSlackConfig();
    expect(config).not.toBeNull();
    expect(config!.botToken).toBe('xoxb-test-token');
  });

  it('returns config when SLACK_CHANNEL_ID is set', () => {
    process.env.SLACK_CHANNEL_ID = 'C01234ABCDE';
    const config = loadSlackConfig();
    expect(config).not.toBeNull();
    expect(config!.channelId).toBe('C01234ABCDE');
  });

  it('reads all three env vars', () => {
    process.env.SLACK_BOT_TOKEN = 'xoxb-bot';
    process.env.SLACK_APP_TOKEN = 'xapp-app';
    process.env.SLACK_CHANNEL_ID = 'C99999';
    const config = loadSlackConfig();
    expect(config).toMatchObject({
      botToken: 'xoxb-bot',
      appToken: 'xapp-app',
      channelId: 'C99999',
      enabled: true,
    });
  });

  it('appToken is undefined when SLACK_APP_TOKEN is not set', () => {
    process.env.SLACK_BOT_TOKEN = 'xoxb-bot';
    const config = loadSlackConfig();
    expect(config!.appToken).toBeUndefined();
  });

  it('always sets enabled: true', () => {
    process.env.SLACK_BOT_TOKEN = 'xoxb-bot';
    expect(loadSlackConfig()!.enabled).toBe(true);
  });
});
