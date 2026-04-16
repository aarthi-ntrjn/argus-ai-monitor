import type { FastifyPluginAsync } from 'fastify';
import { loadConfig, saveConfig, loadSlackConfig, saveSlackConfig } from '../../config/config-loader.js';
import type { ArgusConfig, SlackConfig } from '../../models/index.js';
import type { SlackNotifier } from '../../services/slack-notifier.js';

let slackNotifierRef: SlackNotifier | null = null;
export function setSlackNotifier(n: SlackNotifier): void {
  slackNotifierRef = n;
}

const ALLOWED_KEYS = new Set<keyof ArgusConfig>([
  'port', 'watchDirectories', 'sessionRetentionHours',
  'outputRetentionMbPerSession', 'autoRegisterRepos', 'yoloMode', 'restingThresholdMinutes',
  'telemetryEnabled', 'telemetryPromptSeen',
]);

const settingsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/v1/settings', async (_req, reply) => {
    return reply.send(loadConfig());
  });

  app.patch<{ Body: Record<string, unknown> }>('/api/v1/settings', async (req, reply) => {
    const body = req.body ?? {};

    const current = loadConfig();
    // Apply only recognised keys from the patch body
    const updated: ArgusConfig = { ...current };
    for (const key of ALLOWED_KEYS) {
      if (key in body) {
        (updated as unknown as Record<string, unknown>)[key] = body[key];
      }
    }
    saveConfig(updated);
    return reply.send(updated);
  });
  // T016: GET /api/v1/settings/slack
  app.get('/api/v1/settings/slack', async (_req, reply) => {
    const config = loadSlackConfig();
    if (!config) return reply.status(404).send({ error: 'NOT_CONFIGURED', message: 'Slack integration is not configured' });
    return reply.send(redactSlackConfig(config));
  });

  // T017: PATCH /api/v1/settings/slack
  app.patch<{ Body: Record<string, unknown> }>('/api/v1/settings/slack', async (req, reply) => {
    const body = req.body ?? {};
    const partial: Partial<Pick<SlackConfig, 'channelId' | 'enabledEventTypes' | 'enabled'>> = {};

    if (typeof body.channelId === 'string') partial.channelId = body.channelId;
    if (Array.isArray(body.enabledEventTypes)) {
      partial.enabledEventTypes = (body.enabledEventTypes as unknown[]).filter((v): v is string => typeof v === 'string');
    }
    if (typeof body.enabled === 'boolean') partial.enabled = body.enabled;

    saveSlackConfig(partial);
    slackNotifierRef?.reconfigure(partial);

    const updated = loadSlackConfig();
    return reply.send(updated ? redactSlackConfig(updated) : {});
  });
};

function redactSlackConfig(config: SlackConfig): Record<string, unknown> {
  return {
    botToken: config.botToken ? '***' : '',
    appToken: config.appToken ? '***' : undefined,
    channelId: config.channelId,
    enabled: config.enabled,
    enabledEventTypes: config.enabledEventTypes,
  };
}

export default settingsRoutes;

