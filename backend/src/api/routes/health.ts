import type { FastifyPluginAsync } from 'fastify';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { loadTeamsConfig } from '../../config/teams-config-loader.js';
import type { SlackNotifier } from '../../integration/slack/slack-notifier.js';
import type { SlackListener } from '../../integration/slack/slack-listener.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let slackNotifierRef: SlackNotifier | null = null;
let slackListenerRef: SlackListener | null = null;

export function setSlackServices(notifier: SlackNotifier, listener: SlackListener | null): void {
  slackNotifierRef = notifier;
  slackListenerRef = listener;
}

const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/health', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            version: { type: 'string' },
            uptime: { type: 'number' },
            teams: {
              type: 'object',
              properties: {
                enabled: { type: 'boolean' },
                status: { type: 'string' },
              },
            },
            slack: {
              type: 'object',
              properties: {
                notifier: { type: 'string' },
                listener: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, async (_req, reply) => {
    let version = '1.0.0';
    try {
      const require = createRequire(import.meta.url);
      const pkg = require(join(__dirname, '..', '..', '..', '..', 'package.json'));
      version = (pkg as { version?: string }).version ?? '1.0.0';
    } catch { /* use default */ }

    const teamsConfig = loadTeamsConfig();
    const teamsAuthenticated = teamsConfig.enabled && Boolean(process.env.CLIENT_ID && process.env.CLIENT_SECRET);
    const teams = {
      enabled: teamsConfig.enabled,
      status: teamsConfig.enabled ? (teamsAuthenticated ? 'authenticated' : 'configured') : 'unconfigured',
    };

    const slackStatus = slackNotifierRef
      ? {
          notifier: slackNotifierRef.isRunning ? 'connected' : 'disabled',
          listener: slackListenerRef ? 'connected' : 'disabled',
        }
      : undefined;

    return reply.send({ status: 'ok', version, uptime: process.uptime(), teams, ...(slackStatus ? { slack: slackStatus } : {}) });
  });
};

export default healthRoutes;

