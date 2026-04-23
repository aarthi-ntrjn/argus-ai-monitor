import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { TeamsConfig } from '../models/index.js';

export function getTeamsConfigPath(): string {
  return join(homedir(), '.argus', 'teams.config');
}

function getTeamsConfigDir(): string {
  return join(homedir(), '.argus');
}

export function loadTeamsConfig(): Partial<TeamsConfig> & { enabled: boolean } {
  const filePath = getTeamsConfigPath();
  if (existsSync(filePath)) {
    try {
      const parsed = JSON.parse(readFileSync(filePath, 'utf-8')) as Partial<TeamsConfig>;
      return {
        enabled: parsed.enabled ?? (Boolean(parsed.teamId && parsed.channelId)),
        teamId: parsed.teamId,
        channelId: parsed.channelId,
        ownerSenderId: parsed.ownerSenderId,
        clientId: parsed.clientId,
        clientSecret: parsed.clientSecret,
        tenantId: parsed.tenantId,
      };
    } catch { /* file unreadable, return unconfigured */ }
  }
  return { enabled: false };
}

export function saveTeamsConfig(config: Partial<TeamsConfig>): void {
  const filePath = getTeamsConfigPath();
  mkdirSync(getTeamsConfigDir(), { recursive: true });
  let existing: Partial<TeamsConfig> = {};
  if (existsSync(filePath)) {
    try { existing = JSON.parse(readFileSync(filePath, 'utf-8')); } catch { /* use empty */ }
  }
  writeFileSync(filePath, JSON.stringify({ ...existing, ...config }, null, 2), 'utf-8');
}

