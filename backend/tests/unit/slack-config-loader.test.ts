import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return { ...actual, existsSync: vi.fn(), readFileSync: vi.fn() };
});

import { existsSync, readFileSync } from 'fs';
import { loadSlackConfig } from '../../src/config/slack-config-loader.js';

function mockFile(content: object | null) {
  if (content === null) {
    vi.mocked(existsSync).mockReturnValue(false);
  } else {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify(content) as any);
  }
}

describe('loadSlackConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when no config file exists', () => {
    mockFile(null);
    expect(loadSlackConfig()).toBeNull();
  });

  it('returns null when file exists but botToken and channelId are empty', () => {
    mockFile({ botToken: '', channelId: '' });
    expect(loadSlackConfig()).toBeNull();
  });

  it('returns null when file exists but has no token fields', () => {
    mockFile({ ownerUserId: 'U123' });
    expect(loadSlackConfig()).toBeNull();
  });

  it('returns config when botToken is set', () => {
    mockFile({ botToken: 'xoxb-test-token', channelId: '' });
    const config = loadSlackConfig();
    expect(config).not.toBeNull();
    expect(config!.botToken).toBe('xoxb-test-token');
  });

  it('returns config when channelId is set', () => {
    mockFile({ botToken: '', channelId: 'C01234ABCDE' });
    const config = loadSlackConfig();
    expect(config).not.toBeNull();
    expect(config!.channelId).toBe('C01234ABCDE');
  });

  it('reads all fields from the config file', () => {
    mockFile({ botToken: 'xoxb-bot', appToken: 'xapp-app', channelId: 'C99999' });
    const config = loadSlackConfig();
    expect(config).toMatchObject({
      botToken: 'xoxb-bot',
      appToken: 'xapp-app',
      channelId: 'C99999',
      enabled: true,
    });
  });

  it('appToken is undefined when not in config file', () => {
    mockFile({ botToken: 'xoxb-bot', channelId: 'C99999' });
    expect(loadSlackConfig()!.appToken).toBeUndefined();
  });

  it('always sets enabled: true when config is present', () => {
    mockFile({ botToken: 'xoxb-bot', channelId: 'C99999' });
    expect(loadSlackConfig()!.enabled).toBe(true);
  });

  it('returns null when file contains invalid JSON', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue('not-json' as any);
    expect(loadSlackConfig()).toBeNull();
  });
});
