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
        ownerAadObjectId: parsed.ownerAadObjectId,
        clientId: parsed.clientId,
        clientSecret: parsed.clientSecret,
        tenantId: parsed.tenantId,
      };
    } catch { /* fall through to env fallback */ }
  }
  // Env var fallback for backward compat
  return {
    enabled: process.env.TEAMS_ENABLED === 'true',
    teamId: process.env.TEAMS_TEAM_ID,
    channelId: process.env.TEAMS_CHANNEL_ID,
    ownerAadObjectId: process.env.TEAMS_OWNER_AAD_OBJECT_ID,
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    tenantId: process.env.TENANT_ID,
  };
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

