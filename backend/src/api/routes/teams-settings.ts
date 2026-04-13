import type { FastifyPluginAsync } from 'fastify';
import { loadTeamsConfig, saveTeamsConfig, maskTeamsConfig } from '../../config/teams-config-loader.js';
import { TeamsApiClient } from '../../services/teams-api-client.js';
import type { TeamsConfig } from '../../models/index.js';

const REQUIRED_WHEN_ENABLED: (keyof TeamsConfig)[] = ['botAppId', 'botAppPassword', 'channelId', 'serviceUrl', 'ownerTeamsUserId'];
const teamsApiClient = new TeamsApiClient();

type ConnectionStatus = 'connected' | 'disconnected' | 'error' | 'unconfigured';

async function checkConnectionStatus(config: Partial<TeamsConfig>): Promise<ConnectionStatus> {
  if (!config.enabled) return 'disconnected';
  if (!config.botAppId || !config.botAppPassword) return 'unconfigured';
  try {
    await teamsApiClient.validateConnection(config as TeamsConfig);
    return 'connected';
  } catch {
    return 'error';
  }
}

const teamsSettingsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/v1/settings/teams', async (_req, reply) => {
    const config = loadTeamsConfig();
    if (!config.botAppId) {
      return reply.send({ enabled: config.enabled ?? false, connectionStatus: 'unconfigured' });
    }
    const connectionStatus = await checkConnectionStatus(config);
    return reply.send({ ...maskTeamsConfig(config), connectionStatus });
  });

  app.patch<{ Body: Partial<TeamsConfig> }>('/api/v1/settings/teams', async (req, reply) => {
    const patch = req.body ?? {};
    const current = loadTeamsConfig();
    const updated: Partial<TeamsConfig> = { ...current };

    for (const key of Object.keys(patch) as (keyof TeamsConfig)[]) {
      if (key === 'botAppPassword' && patch[key] === '***') continue;
      (updated as any)[key] = patch[key];
    }

    if (updated.enabled) {
      for (const field of REQUIRED_WHEN_ENABLED) {
        if (!updated[field]) {
          return reply.status(400).send({ error: 'TEAMS_CONFIG_INVALID', message: `${field} is required when enabling Teams integration.`, requestId: req.id });
        }
      }
      try {
        await teamsApiClient.validateConnection(updated as TeamsConfig);
        teamsApiClient.clearTokenCache();
      } catch {
        return reply.status(422).send({ error: 'TEAMS_CONNECTION_FAILED', message: 'Could not connect to Teams. Check your Bot App ID, password, and service URL.', requestId: req.id });
      }
    }

    saveTeamsConfig(updated);
    const connectionStatus: ConnectionStatus = updated.enabled ? 'connected' : 'disconnected';
    return reply.send({ ...maskTeamsConfig(updated), connectionStatus });
  });
};

export default teamsSettingsRoutes;
