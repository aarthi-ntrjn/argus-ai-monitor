import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { SlackConfig } from '../models/index.js';

export function getSlackConfigPath(): string {
  return join(homedir(), '.argus', 'slack.config');
}

function getSlackConfigDir(): string {
  return join(homedir(), '.argus');
}

export function loadSlackConfig(): SlackConfig | null {
  const filePath = getSlackConfigPath();
  if (existsSync(filePath)) {
    try {
      const parsed = JSON.parse(readFileSync(filePath, 'utf-8')) as Partial<SlackConfig>;
      const botToken = parsed.botToken ?? '';
      const channelId = parsed.channelId ?? '';
      if (!botToken && !channelId) return null;
      return {
        botToken,
        appToken: parsed.appToken,
        channelId,
        enabled: true,
        ownerUserId: parsed.ownerUserId,
        enabledEventTypes: parsed.enabledEventTypes,
      };
    } catch { /* fall through to env fallback */ }
  }
  // Env var fallback for backward compat
  const botToken = process.env.SLACK_BOT_TOKEN ?? '';
  const channelId = process.env.SLACK_CHANNEL_ID ?? '';
  if (!botToken && !channelId) return null;
  return {
    botToken,
    appToken: process.env.SLACK_APP_TOKEN,
    channelId,
    enabled: true,
    ownerUserId: process.env.SLACK_OWNER_USER_ID,
  };
}

export function saveSlackConfig(config: Partial<SlackConfig>): void {
  const filePath = getSlackConfigPath();
  mkdirSync(getSlackConfigDir(), { recursive: true });
  let existing: Partial<SlackConfig> = {};
  if (existsSync(filePath)) {
    try { existing = JSON.parse(readFileSync(filePath, 'utf-8')); } catch { /* use empty */ }
  }
  writeFileSync(filePath, JSON.stringify({ ...existing, ...config }, null, 2), 'utf-8');
}

