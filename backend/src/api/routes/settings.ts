import type { FastifyPluginAsync } from 'fastify';
import { loadConfig, saveConfig } from '../../config/config-loader.js';
import { loadSlackConfig, saveSlackConfig } from '../../config/slack-config-loader.js';
import { getSlackConnectionStatus } from '../../services/integration-status.js';
import type { ArgusConfig, SlackConfig } from '../../models/index.js';

const ALLOWED_KEYS = new Set<keyof ArgusConfig>([
  'port', 'watchDirectories', 'sessionRetentionHours',
  'outputRetentionMbPerSession', 'autoRegisterRepos', 'yoloMode', 'restingThresholdMinutes',
  'telemetryEnabled', 'telemetryPromptSeen',
]);

const SLACK_EDITABLE_KEYS: (keyof SlackConfig)[] = [
  'botToken', 'appToken', 'channelId', 'ownerUserId',
];

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

  app.get('/api/v1/settings/slack', async (_req, reply) => {
    const config = loadSlackConfig();
    if (!config) return reply.status(404).send({ error: 'NOT_CONFIGURED', message: 'Slack integration is not configured' });
    return reply.send({ ...config, connectionStatus: getSlackConnectionStatus(config, false) });
  });

  app.patch<{ Body: Record<string, unknown> }>('/api/v1/settings/slack', async (req, reply) => {
    const body = req.body ?? {};
    const current = loadSlackConfig() ?? { botToken: '', channelId: '', enabled: true };
    const update: Partial<SlackConfig> = {};
    for (const key of SLACK_EDITABLE_KEYS) {
      if (key in body) (update as Record<string, unknown>)[key] = body[key];
    }
    const saved = { ...current, ...update };
    saveSlackConfig(saved);
    return reply.send({ ...saved, connectionStatus: getSlackConnectionStatus(saved, false) });
  });
};

export default settingsRoutes;

