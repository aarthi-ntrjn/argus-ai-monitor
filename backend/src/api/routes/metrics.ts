import type { FastifyPluginAsync } from 'fastify';
import { getDb } from '../../db/database.js';

const metricsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/metrics', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            sessions_active: { type: 'number' },
            sessions_ended: { type: 'number' },
            output_records_written: { type: 'number' },
            control_actions_total: { type: 'number' },
          },
        },
      },
    },
  }, async (_req, reply) => {
    const db = getDb();
    const activeRow = db.prepare(
      "SELECT COUNT(*) as count FROM sessions WHERE status IN ('active','waiting')"
    ).get() as { count: number };
    const endedRow = db.prepare(
      "SELECT COUNT(*) as count FROM sessions WHERE status IN ('ended','completed')"
    ).get() as { count: number };
    const outputRow = db.prepare('SELECT COUNT(*) as count FROM session_output').get() as { count: number };
    const actionsRow = db.prepare('SELECT COUNT(*) as count FROM control_actions').get() as { count: number };

    return reply.send({
      sessions_active: activeRow.count,
      sessions_ended: endedRow.count,
      output_records_written: outputRow.count,
      control_actions_total: actionsRow.count,
    });
  });
};

export default metricsRoutes;

