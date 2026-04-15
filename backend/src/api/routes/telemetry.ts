import type { FastifyPluginAsync } from 'fastify';
import { loadConfig } from '../../config/config-loader.js';
import { telemetryService } from '../../services/telemetry-service.js';
import { TELEMETRY_EVENT_TYPES } from '../../models/index.js';
import type { TelemetryEventType } from '../../models/index.js';

interface EventBody {
  type: string;
  sessionType?: string;
}

const telemetryRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Body: EventBody }>('/api/v1/telemetry/event', async (req, reply) => {
    const config = loadConfig();
    if (!config.telemetryEnabled) {
      return reply.status(503).send({
        error: 'TELEMETRY_DISABLED',
        message: 'Telemetry is disabled',
        requestId: req.id,
      });
    }

    const { type, sessionType } = req.body ?? {};
    if (!type || !TELEMETRY_EVENT_TYPES.has(type as TelemetryEventType)) {
      return reply.status(400).send({
        error: 'INVALID_EVENT_TYPE',
        message: `Unknown event type: ${type}`,
        requestId: req.id,
      });
    }

    const extra = sessionType ? { sessionType } : undefined;
    telemetryService.sendEvent(type as TelemetryEventType, extra);
    return reply.status(204).send();
  });
};

export default telemetryRoutes;
