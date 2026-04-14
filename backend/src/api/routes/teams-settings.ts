import type { FastifyPluginAsync } from 'fastify';
import { loadTeamsConfig, saveTeamsConfig, maskTeamsConfig } from '../../config/teams-config-loader.js';
import { TeamsMsalService } from '../../services/teams-msal-service.js';
import type { TeamsConfig } from '../../models/index.js';

const REQUIRED_WHEN_ENABLED: (keyof TeamsConfig)[] = ['clientId', 'tenantId', 'teamId', 'channelId', 'refreshToken'];
const msalService = new TeamsMsalService();

type ConnectionStatus = 'connected' | 'disconnected' | 'error' | 'unconfigured';

async function checkConnectionStatus(config: Partial<TeamsConfig> & { enabled: boolean }): Promise<ConnectionStatus> {
  if (!config.enabled) return 'disconnected';
  if (!config.clientId || !config.refreshToken) return 'unconfigured';
  try {
    await msalService.getAccessToken(config as TeamsConfig);
    return 'connected';
  } catch {
    return 'error';
  }
}

const teamsSettingsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/v1/settings/teams', async (_req, reply) => {
    const config = loadTeamsConfig();
    if (!config.clientId) {
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
      if (key === 'refreshToken' && patch[key] === '***') continue;
      (updated as any)[key] = patch[key];
    }

    if ((patch.clientId && current.clientId && patch.clientId !== current.clientId) ||
        (patch.tenantId && current.tenantId && patch.tenantId !== current.tenantId)) {
      delete updated.refreshToken;
      delete updated.ownerUserId;
    }

    if (updated.enabled) {
      const CONFIG_FIELDS: (keyof TeamsConfig)[] = ['clientId', 'tenantId', 'teamId', 'channelId'];
      for (const field of CONFIG_FIELDS) {
        if (!updated[field]) {
          return reply.status(400).send({ error: 'TEAMS_CONFIG_INVALID', message: `${field} is required when enabling Teams integration.`, requestId: req.id });
        }
      }
      if (!updated.refreshToken) {
        return reply.status(422).send({ error: 'TEAMS_NOT_AUTHENTICATED', message: 'Teams authentication is required. Use Device Code Flow to authenticate before enabling.', requestId: req.id });
      }
      try {
        await msalService.getAccessToken(updated as TeamsConfig);
      } catch {
        return reply.status(422).send({ error: 'TEAMS_NOT_AUTHENTICATED', message: 'Teams authentication is required. Use Device Code Flow to authenticate before enabling.', requestId: req.id });
      }
    }

    saveTeamsConfig(updated);
    const connectionStatus: ConnectionStatus = updated.enabled ? 'connected' : 'disconnected';
    if (!updated.clientId) return reply.send({ enabled: false, connectionStatus: 'unconfigured' });
    return reply.send({ ...maskTeamsConfig(updated), connectionStatus });
  });
};

export default teamsSettingsRoutes;
