import type { TeamsConfig } from '../models/index.js';

export function loadTeamsConfig(): Partial<TeamsConfig> & { enabled: boolean } {
  return {
    enabled: process.env.TEAMS_ENABLED === 'true',
    teamId: process.env.TEAMS_TEAM_ID,
    channelId: process.env.TEAMS_CHANNEL_ID,
    ownerAadObjectId: process.env.TEAMS_OWNER_AAD_OBJECT_ID,
  };
}
