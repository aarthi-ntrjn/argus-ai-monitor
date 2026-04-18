import type { SlackConfig } from '../models/index.js';

export function loadSlackConfig(): SlackConfig | null {
  const botToken = process.env.SLACK_BOT_TOKEN ?? '';
  const appToken = process.env.SLACK_APP_TOKEN;
  const channelId = process.env.SLACK_CHANNEL_ID ?? '';
  const ownerUserId = process.env.SLACK_OWNER_USER_ID;

  if (!botToken && !channelId) return null;

  return { botToken, appToken, channelId, enabled: true, ownerUserId };
}
