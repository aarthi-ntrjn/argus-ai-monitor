import type { FastifyPluginAsync } from 'fastify';
import { loadTeamsConfig, saveTeamsConfig } from '../../config/teams-config-loader.js';
import type { TeamsConfig } from '../../models/index.js';

type ConnectionStatus = 'connected' | 'disconnected' | 'unconfigured';

function checkConnectionStatus(config: Partial<TeamsConfig> & { enabled: boolean }): ConnectionStatus {
  const hasAnyConfig = Boolean(config.teamId || config.channelId || config.clientId || config.clientSecret);
  if (!hasAnyConfig) return 'unconfigured';
  if (!config.enabled) return 'disconnected';
  const hasAuth = Boolean(config.clientId && config.clientSecret);
  if (!config.teamId || !config.channelId || !hasAuth) return 'unconfigured';
  return 'connected';
}

const EDITABLE_KEYS: (keyof TeamsConfig)[] = [
  'teamId', 'channelId', 'ownerAadObjectId', 'clientId', 'clientSecret', 'tenantId',
];

const teamsSettingsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/v1/settings/teams', async (_req, reply) => {
    const config = loadTeamsConfig();
    const connectionStatus = checkConnectionStatus(config);
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
    const connectionStatus = checkConnectionStatus(saved);
    return reply.send({ ...saved, connectionStatus });
  });
};

export default teamsSettingsRoutes;
