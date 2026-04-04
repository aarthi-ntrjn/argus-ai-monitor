import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { ArgusConfig } from '../models/index.js';

const CONFIG_DIR = join(homedir(), '.argus');
const CONFIG_PATH = join(CONFIG_DIR, 'config.json');

const DEFAULTS: ArgusConfig = {
  port: 7411,
  watchDirectories: [],
  sessionRetentionHours: 24,
  outputRetentionMbPerSession: 10,
  autoRegisterRepos: false,
};

export function loadConfig(): ArgusConfig {
  let fileConfig: Partial<ArgusConfig> = {};
  if (!existsSync(CONFIG_PATH)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
    writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULTS, null, 2), 'utf-8');
  } else {
    try {
      fileConfig = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
    } catch {
      // fall through to defaults
    }
  }
  const config = { ...DEFAULTS, ...fileConfig };
  if (process.env.ARGUS_PORT) config.port = parseInt(process.env.ARGUS_PORT, 10);
  return config;
}

export function saveConfig(config: ArgusConfig): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}
