import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { TeamsConfig } from '../models/index.js';

function getTeamsConfigPath(): string {
  return process.env.ARGUS_TEAMS_CONFIG_PATH ?? join(homedir(), '.argus', 'teams-config.json');
}

function applyEnvOverrides(config: Partial<TeamsConfig> & { enabled: boolean }): Partial<TeamsConfig> & { enabled: boolean } {
  if (process.env.TEAMS_TEAM_ID)             config.teamId = process.env.TEAMS_TEAM_ID;
  if (process.env.TEAMS_CHANNEL_ID)          config.channelId = process.env.TEAMS_CHANNEL_ID;
  if (process.env.TEAMS_OWNER_AAD_OBJECT_ID) config.ownerAadObjectId = process.env.TEAMS_OWNER_AAD_OBJECT_ID;
  if (process.env.TEAMS_ENABLED !== undefined) config.enabled = process.env.TEAMS_ENABLED === 'true';
  return config;
}

export function loadTeamsConfig(): Partial<TeamsConfig> & { enabled: boolean } {
  const configPath = getTeamsConfigPath();
  let config: Partial<TeamsConfig> & { enabled: boolean } = { enabled: false };
  if (existsSync(configPath)) {
    try {
      config = JSON.parse(readFileSync(configPath, 'utf-8'));
    } catch {
      config = { enabled: false };
    }
  }
  return applyEnvOverrides(config);
}

export function saveTeamsConfig(config: Partial<TeamsConfig>): void {
  const configPath = getTeamsConfigPath();
  const dir = join(homedir(), '.argus');
  mkdirSync(dir, { recursive: true });
  writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

export function maskTeamsConfig(config: Partial<TeamsConfig>): Partial<TeamsConfig> {
  return config;
}
