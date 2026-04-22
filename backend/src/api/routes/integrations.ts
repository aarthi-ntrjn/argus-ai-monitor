import type { FastifyPluginAsync } from 'fastify';
import type { SlackNotifier } from '../../integration/slack/slack-notifier.js';
import { SlackListener } from '../../integration/slack/slack-listener.js';
import type { TeamsNotifier } from '../../integration/teams/teams-notifier.js';
import type { TeamsListener } from '../../integration/teams/teams-listener.js';
import { setIntegrationEnabled } from '../../db/database.js';
import { telemetryService } from '../../services/telemetry-service.js';
import { loadSlackConfig } from '../../config/slack-config-loader.js';
import { setSlackServices } from './health.js';
import type { SessionMonitor } from '../../services/session-monitor.js';

let slackNotifier: SlackNotifier | null = null;
let slackListener: SlackListener | null = null;
let teamsNotifier: TeamsNotifier | null = null;
let teamsListener: TeamsListener | null = null;
let integrationsEnabled = false;
let sessionMonitor: SessionMonitor | null = null;

export function setIntegrationServices(
  sn: SlackNotifier | null,
  sl: SlackListener | null,
  tn: TeamsNotifier | null,
  tl: TeamsListener | null,
  enabled: boolean,
  monitor: SessionMonitor,
): void {
  slackNotifier = sn;
  slackListener = sl;
  teamsNotifier = tn;
  teamsListener = tl;
  integrationsEnabled = enabled;
  sessionMonitor = monitor;
}

const integrationsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/v1/integrations', async (_request, reply) => {
    return reply.send({
      integrationsEnabled,
      slack: {
        notifier: slackNotifier ? { running: slackNotifier.isRunning } : null,
        listener: slackListener ? { running: slackListener.isRunning } : null,
      },
      teams: {
        notifier: teamsNotifier ? { running: teamsNotifier.isRunning } : null,
        listener: teamsListener ? { running: teamsListener.isRunning } : null,
      },
    });
  });

  fastify.post('/api/v1/integrations/slack/start', async (_request, reply) => {
    if (!slackNotifier) return reply.status(503).send({ error: 'Slack integration not available. Enable integrations in settings.' });
    const started = await slackNotifier.initialize();
    // Create listener on demand if not yet created and notifier is now connected
    if (started && !slackListener && slackNotifier.webClient) {
      const config = loadSlackConfig();
      if (config) {
        slackListener = new SlackListener(config, slackNotifier.webClient, slackNotifier);
        setSlackServices(slackNotifier, slackListener);
      }
    }
    if (slackListener) await slackListener.initialize();
    setIntegrationEnabled('slack', true);
    telemetryService.sendEvent('integration_started', { platform: 'slack' });
    return reply.send({ started });
  });

  fastify.post('/api/v1/integrations/slack/stop', async (_request, reply) => {
    if (!slackNotifier) return reply.status(503).send({ error: 'Slack not configured' });
    slackListener?.shutdown();
    slackNotifier.shutdown();
    setIntegrationEnabled('slack', false);
    telemetryService.sendEvent('integration_stopped', { platform: 'slack' });
    return reply.send({ stopped: true });
  });

  fastify.post('/api/v1/integrations/teams/start', async (_request, reply) => {
    if (!teamsNotifier) return reply.status(503).send({ error: 'Teams not configured' });
    const started = await teamsNotifier.initialize();
    teamsListener?.initialize();
    setIntegrationEnabled('teams', true);
    telemetryService.sendEvent('integration_started', { platform: 'teams' });
    return reply.send({ started });
  });

  fastify.post('/api/v1/integrations/teams/stop', async (_request, reply) => {
    if (!teamsNotifier) return reply.status(503).send({ error: 'Teams not configured' });
    teamsListener?.shutdown();
    teamsNotifier.shutdown();
    setIntegrationEnabled('teams', false);
    telemetryService.sendEvent('integration_stopped', { platform: 'teams' });
    return reply.send({ stopped: true });
  });
};

export default integrationsRoutes;
