import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import type { ArgusConfig, SlackConfig } from '../models/index.js';

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
  telemetryEnabled: true,
  telemetryPromptSeen: false,
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
  // Preserve any unknown keys (e.g. slack) already in the file
  let existing: Record<string, unknown> = {};
  try {
    existing = JSON.parse(readFileSync(configPath, 'utf-8'));
  } catch { /* use empty */ }
  writeFileSync(configPath, JSON.stringify({ ...existing, ...config }, null, 2), 'utf-8');
}

export function loadSlackConfig(): SlackConfig | null {
  let fileSack: Partial<SlackConfig> = {};
  const configPath = getConfigPath();
  try {
    const raw = JSON.parse(readFileSync(configPath, 'utf-8')) as Record<string, unknown>;
    fileSack = (raw.slack ?? {}) as Partial<SlackConfig>;
  } catch { /* fall through */ }

  const botToken = process.env.SLACK_BOT_TOKEN ?? fileSack.botToken ?? '';
  const appToken = process.env.SLACK_APP_TOKEN ?? fileSack.appToken;
  const channelId = process.env.SLACK_CHANNEL_ID ?? fileSack.channelId ?? '';

  if (!botToken && !channelId) return null;

  return {
    botToken,
    appToken,
    channelId,
    enabled: fileSack.enabled ?? true,
    enabledEventTypes: fileSack.enabledEventTypes,
  };
}

export function saveSlackConfig(partial: Partial<SlackConfig>): void {
  const configPath = getConfigPath();
  const configDir = getConfigDir();
  mkdirSync(configDir, { recursive: true });
  let existing: Record<string, unknown> = {};
  try {
    existing = JSON.parse(readFileSync(configPath, 'utf-8'));
  } catch { /* use empty */ }
  existing.slack = { ...(existing.slack as object ?? {}), ...partial };
  writeFileSync(configPath, JSON.stringify(existing, null, 2), 'utf-8');
}

