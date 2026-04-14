import type { FastifyPluginAsync } from 'fastify';
import { loadTeamsConfig, saveTeamsConfig, maskTeamsConfig } from '../../config/teams-config-loader.js';
import { TeamsBotAuthService } from '../../services/teams-bot-auth-service.js';
import type { TeamsConfig } from '../../models/index.js';

const REQUIRED_WHEN_ENABLED: (keyof TeamsConfig)[] = ['botAppId', 'tenantId', 'teamId', 'channelId'];

export const _auth = { botAuthService: new TeamsBotAuthService() };

type ConnectionStatus = 'connected' | 'disconnected' | 'error' | 'unconfigured';

function hasAuthMethod(config: Partial<TeamsConfig>): boolean {
  return !!(config.botAppSecret || (config.botCertPath && config.botCertThumbprint));
}

async function checkConnectionStatus(config: Partial<TeamsConfig> & { enabled: boolean }): Promise<ConnectionStatus> {
  if (!config.enabled) return 'disconnected';
  if (!config.botAppId || !config.tenantId || !hasAuthMethod(config)) return 'unconfigured';
  try {
    await _auth.botAuthService.getAccessToken(config as TeamsConfig);
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
      if (key === 'botAppSecret' && patch[key] === '***') continue;
      (updated as any)[key] = patch[key];
    }

    if (updated.enabled) {
      for (const field of REQUIRED_WHEN_ENABLED) {
        if (!updated[field]) {
          return reply.status(400).send({ error: 'TEAMS_CONFIG_INVALID', message: `${field} is required when enabling Teams integration.`, requestId: req.id });
        }
      }
      if (!hasAuthMethod(updated)) {
        return reply.status(400).send({ error: 'TEAMS_CONFIG_INVALID', message: 'Provide either botAppSecret or both botCertPath and botCertThumbprint.', requestId: req.id });
      }
      try {
        await _auth.botAuthService.getAccessToken(updated as TeamsConfig);
      } catch {
        return reply.status(422).send({ error: 'TEAMS_BOT_AUTH_FAILED', message: 'Could not authenticate with the bot credentials. Check botAppId, credentials, and tenantId.', requestId: req.id });
      }
    }

    saveTeamsConfig(updated);
    const connectionStatus: ConnectionStatus = updated.enabled ? 'connected' : 'disconnected';
    if (!updated.botAppId) return reply.send({ enabled: false, connectionStatus: 'unconfigured' });
    return reply.send({ ...maskTeamsConfig(updated), connectionStatus });
  });
};

export default teamsSettingsRoutes;
