import type { FastifyPluginAsync } from 'fastify';
import { loadTeamsConfig, saveTeamsConfig } from '../../config/teams-config-loader.js';
import { TeamsGraphClient } from '../../services/teams-graph-client.js';
import { TeamsMsalService } from '../../services/teams-msal-service.js';

const graphClient = new TeamsGraphClient();
const msalService = new TeamsMsalService();

const teamsAuthRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Body: { clientId: string; tenantId: string } }>('/api/v1/settings/teams/auth/device-code', async (req, reply) => {
    const { clientId, tenantId } = req.body ?? {};
    if (!clientId || !tenantId) {
      return reply.status(400).send({ error: 'TEAMS_CONFIG_INVALID', message: 'clientId and tenantId are required.', requestId: req.id });
    }
    try {
      const info = await msalService.initiateDeviceCodeFlow(clientId, tenantId);
      return reply.send(info);
    } catch (err) {
      app.log.error({ err }, 'teams.auth.device-code.failed');
      return reply.status(500).send({ error: 'TEAMS_AUTH_FAILED', message: 'Failed to initiate device code flow.', requestId: req.id });
    }
  });

  app.post<{ Body: { clientId: string; tenantId: string } }>('/api/v1/settings/teams/auth/poll', async (req, reply) => {
    const { clientId, tenantId } = req.body ?? {};
    if (!clientId || !tenantId) {
      return reply.status(400).send({ error: 'TEAMS_CONFIG_INVALID', message: 'clientId and tenantId are required.', requestId: req.id });
    }
    const result = await msalService.pollDeviceCodeFlow(clientId, tenantId);
    if (result.status === 'completed') {
      try {
        const me = await graphClient.getMe(result.accessToken);
        const config = loadTeamsConfig();
        saveTeamsConfig({ ...config, clientId, tenantId, ownerUserId: me.id, refreshToken: result.refreshToken });
        return reply.send({ status: 'completed', ownerUserId: me.id, displayName: me.displayName });
      } catch (err) {
        app.log.error({ err }, 'teams.auth.poll.save.failed');
        return reply.status(500).send({ error: 'TEAMS_AUTH_SAVE_FAILED', message: 'Authentication completed but failed to save credentials.', requestId: req.id });
      }
    }
    return reply.send(result);
  });
};

export default teamsAuthRoutes;
