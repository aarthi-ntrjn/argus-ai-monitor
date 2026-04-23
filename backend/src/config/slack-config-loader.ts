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
      const ownerSenderId = parsed.ownerSenderId ?? '';
      if (!botToken && !channelId) return null;
      return {
        botToken,
        appToken: parsed.appToken,
        channelId,
        enabled: true,
        ownerSenderId,
        enabledEventTypes: parsed.enabledEventTypes,
      };
    } catch { /* file unreadable */ }
  }
  return null;
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

