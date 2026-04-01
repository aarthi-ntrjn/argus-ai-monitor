import type { FastifyPluginAsync } from 'fastify';
import { getSessions } from '../../db/database.js';

const sessionsRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: { repositoryId?: string; status?: string; type?: string } }>(
    '/api/v1/sessions',
    async (req, reply) => {
      const { repositoryId, status, type } = req.query;
      const sessions = getSessions({ repositoryId, status, type });
      return reply.send(sessions);
    }
  );
};

export default sessionsRoutes;