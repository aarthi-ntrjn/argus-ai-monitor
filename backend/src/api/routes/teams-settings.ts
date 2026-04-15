import type { FastifyPluginAsync } from 'fastify';
import { loadTeamsConfig, saveTeamsConfig } from '../../config/teams-config-loader.js';
import type { TeamsConfig } from '../../models/index.js';

const REQUIRED_WHEN_ENABLED: (keyof TeamsConfig)[] = ['teamId', 'channelId', 'ownerAadObjectId'];

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

  app.patch<{ Body: Partial<TeamsConfig> }>('/api/v1/settings/teams', async (req, reply) => {
    const patch = req.body ?? {};
    const current = loadTeamsConfig();
    const updated: Partial<TeamsConfig> = { ...current };

    for (const key of Object.keys(patch) as (keyof TeamsConfig)[]) {
      (updated as Record<string, unknown>)[key] = patch[key];
    }

    if (updated.enabled) {
      for (const field of REQUIRED_WHEN_ENABLED) {
        if (!updated[field]) {
          return reply.status(400).send({ error: 'TEAMS_CONFIG_INVALID', message: `${field} is required when enabling Teams integration.`, requestId: req.id });
        }
      }
    }

    saveTeamsConfig(updated);
    const connectionStatus = checkConnectionStatus(updated as Partial<TeamsConfig> & { enabled: boolean });
    return reply.send({ ...updated, connectionStatus });
  });
};

export default teamsSettingsRoutes;
