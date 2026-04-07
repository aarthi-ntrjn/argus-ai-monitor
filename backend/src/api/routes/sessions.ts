import type { FastifyPluginAsync } from 'fastify';
import { getSessions, getSession } from '../../db/database.js';
import { OutputStore } from '../../services/output-store.js';
import { SessionController } from '../../services/session-controller.js';

const outputStore = new OutputStore();
const sessionController = new SessionController();

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

  app.post<{ Params: { id: string } }>(
    '/api/v1/sessions/:id/stop',
    async (req, reply) => {
      try {
        const action = await sessionController.stopSession(req.params.id);
        return reply.status(202).send({ actionId: action.id, status: action.status });
      } catch (err: unknown) {
        const e = err as { code?: string; message?: string };
        if (e.code === 'NOT_FOUND') return reply.status(404).send({ error: 'NOT_FOUND', message: e.message, requestId: req.id });
        if (e.code === 'CONFLICT') return reply.status(409).send({ error: 'CONFLICT', message: e.message, requestId: req.id });
        if (e.code === 'PID_NOT_SET') return reply.status(422).send({ error: 'PID_NOT_SET', message: e.message, requestId: req.id });
        if (e.code === 'PID_NOT_FOUND') return reply.status(422).send({ error: 'PID_NOT_FOUND', message: e.message, requestId: req.id });
        if (e.code === 'PID_NOT_AI_TOOL') return reply.status(403).send({ error: 'PID_NOT_AI_TOOL', message: e.message, requestId: req.id });
        throw err;
      }
    }
  );

  app.post<{ Params: { id: string } }>(
    '/api/v1/sessions/:id/interrupt',
    async (req, reply) => {
      try {
        const action = await sessionController.interruptSession(req.params.id);
        return reply.status(202).send({ actionId: action.id, status: action.status });
      } catch (err: unknown) {
        const e = err as { code?: string; message?: string };
        if (e.code === 'NOT_FOUND') return reply.status(404).send({ error: 'NOT_FOUND', message: e.message, requestId: req.id });
        if (e.code === 'CONFLICT') return reply.status(409).send({ error: 'CONFLICT', message: e.message, requestId: req.id });
        if (e.code === 'PID_NOT_SET') return reply.status(422).send({ error: 'PID_NOT_SET', message: e.message, requestId: req.id });
        if (e.code === 'PID_NOT_FOUND') return reply.status(422).send({ error: 'PID_NOT_FOUND', message: e.message, requestId: req.id });
        if (e.code === 'PID_NOT_AI_TOOL') return reply.status(403).send({ error: 'PID_NOT_AI_TOOL', message: e.message, requestId: req.id });
        throw err;
      }
    }
  );


  app.post<{ Params: { id: string }; Body: { prompt?: string } }>(
    '/api/v1/sessions/:id/send',
    async (req, reply) => {
      const { prompt } = req.body ?? {};
      if (!prompt) return reply.status(400).send({ error: 'MISSING_PROMPT', message: 'prompt is required' });

      try {
        const session = getSession(req.params.id);
        if (!session) return reply.status(404).send({ error: 'NOT_FOUND', message: `Session ${req.params.id} not found` });

        const action = await sessionController.sendPrompt(req.params.id, prompt);
        return reply.status(202).send({ actionId: action.id, status: action.status });
      } catch (err: unknown) {
        const e = err as { code?: string; message?: string };
        if (e.code === 'NOT_FOUND') return reply.status(404).send({ error: 'NOT_FOUND', message: e.message });
        if (e.code === 'CONFLICT') return reply.status(409).send({ error: 'CONFLICT', message: e.message });
        throw err;
      }
    }
  );
};

export default sessionsRoutes;