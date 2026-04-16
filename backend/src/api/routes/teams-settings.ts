import type { FastifyPluginAsync } from 'fastify';
import { loadTeamsConfig } from '../../config/teams-config-loader.js';
import type { TeamsConfig } from '../../models/index.js';

type ConnectionStatus = 'connected' | 'disconnected' | 'unconfigured';

function checkConnectionStatus(config: Partial<TeamsConfig> & { enabled: boolean }): ConnectionStatus {
  if (!config.enabled) return 'disconnected';
  const hasAuth = Boolean(process.env.CLIENT_ID && process.env.CLIENT_SECRET);
  if (!config.teamId || !config.channelId || !hasAuth) return 'unconfigured';
  return 'connected';
}

const teamsSettingsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/v1/settings/teams', async (_req, reply) => {
    const config = loadTeamsConfig();
    const connectionStatus = checkConnectionStatus(config);
    return reply.send({ ...config, connectionStatus });
  });

  app.patch<{ Body: Partial<TeamsConfig> }>('/api/v1/settings/teams', async (_req, reply) => {
    const config = loadTeamsConfig();
    const connectionStatus = checkConnectionStatus(config);
    return reply.send({ ...config, connectionStatus });
  });
};

export default teamsSettingsRoutes;
