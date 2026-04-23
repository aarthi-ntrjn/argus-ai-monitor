import type { TeamsConfig, SlackConfig } from '../models/index.js';

export type ConnectionStatus = 'connected' | 'disconnected' | 'unconfigured';

/**
 * Required fields for each integration to be considered fully configured.
 * If any required field is missing, the status is 'unconfigured'.
 * If all are present but the notifier is not running, the status is 'disconnected'.
 */
const TEAMS_REQUIRED: (keyof TeamsConfig)[] = [
  'teamId', 'channelId', 'ownerAadObjectId', 'clientId', 'clientSecret', 'tenantId',
];

const SLACK_REQUIRED: (keyof SlackConfig)[] = [
  'botToken', 'channelId', 'ownerUserId',
];

export function getTeamsConnectionStatus(config: TeamsConfig, isRunning: boolean): ConnectionStatus {
  const hasAny = TEAMS_REQUIRED.some(k => Boolean(config[k]));
  if (!hasAny) return 'unconfigured';
  const complete = TEAMS_REQUIRED.every(k => Boolean(config[k]));
  if (!complete) return 'unconfigured';
  if (!isRunning) return 'disconnected';
  return 'connected';
}

export function getSlackConnectionStatus(config: SlackConfig | null, isRunning: boolean): ConnectionStatus {
  if (!config) return 'unconfigured';
  const complete = SLACK_REQUIRED.every(k => Boolean(config[k as keyof SlackConfig]));
  if (!complete) return 'unconfigured';
  if (!isRunning) return 'disconnected';
  return 'connected';
}
