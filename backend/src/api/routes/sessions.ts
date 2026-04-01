import type { FastifyPluginAsync } from 'fastify';
import { getSessions, getSession } from '../../db/database.js';
import { OutputStore } from '../../services/output-store.js';

const outputStore = new OutputStore();

const sessionsRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: { repositoryId?: string; status?: string; type?: string } }>(
    '/api/v1/sessions',
    async (req, reply) => {
      const { repositoryId, status, type } = req.query;
      const sessions = getSessions({ repositoryId, status, type });
      return reply.send(sessions);
    }
  );

  app.get<{ Params: { id: string } }>(
    '/api/v1/sessions/:id',
    async (req, reply) => {
      const session = getSession(req.params.id);
      if (!session) return reply.status(404).send({ error: 'NOT_FOUND', message: `Session ${req.params.id} not found` });
      return reply.send(session);
    }
  );

  app.get<{ Params: { id: string }; Querystring: { limit?: string; before?: string } }>(
    '/api/v1/sessions/:id/output',
    async (req, reply) => {
      const session = getSession(req.params.id);
      if (!session) return reply.status(404).send({ error: 'NOT_FOUND', message: `Session ${req.params.id} not found` });
      const limit = Math.min(parseInt(req.query.limit ?? '100', 10), 1000);
      const page = outputStore.getOutputPage(session.id, limit, req.query.before);
      return reply.send(page);
    }
  );
};

export default sessionsRoutes;