import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { TeamsConfig } from '../models/index.js';

function getTeamsConfigPath(): string {
  return process.env.ARGUS_TEAMS_CONFIG_PATH ?? join(homedir(), '.argus', 'teams-config.json');
}

export function loadTeamsConfig(): Partial<TeamsConfig> & { enabled: boolean } {
  const configPath = getTeamsConfigPath();
  if (!existsSync(configPath)) return { enabled: false };
  try {
    return JSON.parse(readFileSync(configPath, 'utf-8'));
  } catch {
    return { enabled: false };
  }
}

export function saveTeamsConfig(config: Partial<TeamsConfig>): void {
  const configPath = getTeamsConfigPath();
  const dir = join(homedir(), '.argus');
  mkdirSync(dir, { recursive: true });
  writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

export function maskTeamsConfig(config: Partial<TeamsConfig>): Partial<TeamsConfig> {
  if (!config.refreshToken) return config;
  return { ...config, refreshToken: '***' };
}
