import type { FastifyPluginAsync } from 'fastify';
import { loadConfig, saveConfig } from '../../config/config-loader.js';
import type { ArgusConfig } from '../../models/index.js';

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
};

export default settingsRoutes;

