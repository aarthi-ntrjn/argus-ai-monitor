import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import type { ArgusConfig } from '../models/index.js';

function getConfigPath(): string {
  return process.env.ARGUS_CONFIG_PATH ?? join(homedir(), '.argus', 'config.json');
}

function getConfigDir(): string {
  const path = getConfigPath();
  return process.env.ARGUS_CONFIG_PATH ? dirname(path) : join(homedir(), '.argus');
}

const DEFAULTS: ArgusConfig = {
  port: 7411,
  watchDirectories: [],
  sessionRetentionHours: 24,
  outputRetentionMbPerSession: 10,
  autoRegisterRepos: false,
  yoloMode: false,
  restingThresholdMinutes: 20,
};

export function loadConfig(): ArgusConfig {
  const configPath = getConfigPath();
  const configDir = getConfigDir();
  let fileConfig: Partial<ArgusConfig> = {};
  if (!existsSync(configPath)) {
    mkdirSync(configDir, { recursive: true });
    writeFileSync(configPath, JSON.stringify(DEFAULTS, null, 2), 'utf-8');
  } else {
    try {
      fileConfig = JSON.parse(readFileSync(configPath, 'utf-8'));
    } catch {
      // fall through to defaults
    }
  }
  const config = { ...DEFAULTS, ...fileConfig };
  if (process.env.ARGUS_PORT) config.port = parseInt(process.env.ARGUS_PORT, 10);
  return config;
}

export function saveConfig(config: ArgusConfig): void {
  const configPath = getConfigPath();
  const configDir = getConfigDir();
  mkdirSync(configDir, { recursive: true });
  writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
}
