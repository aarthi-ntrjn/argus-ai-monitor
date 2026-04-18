import type { FastifyPluginAsync } from 'fastify';
import type { SlackNotifier } from '../../integration/slack/slack-notifier.js';
import type { SlackListener } from '../../integration/slack/slack-listener.js';
import type { TeamsNotifier } from '../../integration/teams/teams-notifier.js';
import type { TeamsListener } from '../../integration/teams/teams-listener.js';

let slackNotifier: SlackNotifier | null = null;
let slackListener: SlackListener | null = null;
let teamsNotifier: TeamsNotifier | null = null;
let teamsListener: TeamsListener | null = null;

export function setIntegrationServices(
  sn: SlackNotifier | null,
  sl: SlackListener | null,
  tn: TeamsNotifier | null,
  tl: TeamsListener | null,
): void {
  slackNotifier = sn;
  slackListener = sl;
  teamsNotifier = tn;
  teamsListener = tl;
}

const integrationsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/v1/integrations', async (_request, reply) => {
    return reply.send({
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
    if (!slackNotifier) return reply.status(503).send({ error: 'Slack not configured' });
    const started = await slackNotifier.initialize();
    slackListener?.initialize();
    return reply.send({ started });
  });

  fastify.post('/api/v1/integrations/slack/stop', async (_request, reply) => {
    if (!slackNotifier) return reply.status(503).send({ error: 'Slack not configured' });
    slackListener?.shutdown();
    slackNotifier.shutdown();
    return reply.send({ stopped: true });
  });

  fastify.post('/api/v1/integrations/teams/start', async (_request, reply) => {
    if (!teamsNotifier) return reply.status(503).send({ error: 'Teams not configured' });
    const started = await teamsNotifier.initialize();
    teamsListener?.initialize();
    return reply.send({ started });
  });

  fastify.post('/api/v1/integrations/teams/stop', async (_request, reply) => {
    if (!teamsNotifier) return reply.status(503).send({ error: 'Teams not configured' });
    teamsListener?.shutdown();
    teamsNotifier.shutdown();
    return reply.send({ stopped: true });
  });
};

export default integrationsRoutes;
