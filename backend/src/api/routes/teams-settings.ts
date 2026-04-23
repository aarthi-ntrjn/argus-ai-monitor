import type { FastifyPluginAsync } from 'fastify';
import { loadTeamsConfig, saveTeamsConfig } from '../../config/teams-config-loader.js';
import { getTeamsConnectionStatus } from '../../services/integration-status.js';
import type { TeamsConfig } from '../../models/index.js';

const EDITABLE_KEYS: (keyof TeamsConfig)[] = [
  'teamId', 'channelId', 'ownerAadObjectId', 'clientId', 'clientSecret', 'tenantId',
];

const teamsSettingsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/v1/settings/teams', async (_req, reply) => {
    const config = loadTeamsConfig();
    const connectionStatus = getTeamsConnectionStatus(config, false);
    return reply.send({ ...config, connectionStatus });
  });

  app.patch<{ Body: Record<string, unknown> }>('/api/v1/settings/teams', async (req, reply) => {
    const body = req.body ?? {};
    const current = loadTeamsConfig();
    const update: Partial<TeamsConfig> = {};
    for (const key of EDITABLE_KEYS) {
      if (key in body) (update as Record<string, unknown>)[key] = body[key];
    }
    const saved = { ...current, ...update };
    saveTeamsConfig(saved);
    const connectionStatus = getTeamsConnectionStatus(saved, false);
    return reply.send({ ...saved, connectionStatus });
  });
};

export default teamsSettingsRoutes;
