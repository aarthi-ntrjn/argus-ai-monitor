import type { FastifyPluginAsync } from 'fastify';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type { SlackNotifier } from '../../services/slack-notifier.js';
import type { SlackListener } from '../../services/slack-listener.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let slackNotifierRef: SlackNotifier | null = null;
let slackListenerRef: SlackListener | null = null;

export function setSlackServices(notifier: SlackNotifier, listener: SlackListener | null): void {
  slackNotifierRef = notifier;
  slackListenerRef = listener;
}

const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/health', async (_req, reply) => {
    let version = '1.0.0';
    try {
      const require = createRequire(import.meta.url);
      const pkg = require(join(__dirname, '..', '..', '..', 'package.json'));
      version = (pkg as { version?: string }).version ?? '1.0.0';
    } catch { /* use default */ }

    const slackStatus = slackNotifierRef
      ? {
          notifier: slackNotifierRef.isDisabled ? 'disabled' : 'connected',
          listener: slackListenerRef ? 'connected' : 'disabled',
        }
      : undefined;

    return reply.send({ status: 'ok', version, uptime: process.uptime(), ...(slackStatus ? { slack: slackStatus } : {}) });
  });
};

export default healthRoutes;

