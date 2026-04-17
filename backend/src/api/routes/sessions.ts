import type { FastifyPluginAsync } from 'fastify';
import { getSessions, getSession, updateSessionStatus } from '../../db/database.js';
import { OutputStore } from '../../services/output-store.js';
import { SessionController } from '../../services/session-controller.js';
import { ptyRegistry } from '../../services/pty-registry.js';

function withPtyConnected<T extends { id: string; launchMode?: string | null }>(session: T): T & { ptyConnected: boolean | null } {
  return { ...session, ptyConnected: session.launchMode === 'pty' ? ptyRegistry.has(session.id) : null };
}

const outputStore = new OutputStore();
const sessionController = new SessionController();

const sessionsRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: { repositoryId?: string; status?: string; type?: string } }>(
    '/api/v1/sessions',
    async (req, reply) => {
      const { repositoryId, status, type } = req.query;
      const sessions = getSessions({ repositoryId, status, type });
      return reply.send(sessions.map(withPtyConnected));
    }
  );

  app.get<{ Params: { id: string } }>(
    '/api/v1/sessions/:id',
    async (req, reply) => {
      const session = getSession(req.params.id);
      if (!session) return reply.status(404).send({ error: 'NOT_FOUND', message: `Session ${req.params.id} not found` });
      return reply.send(withPtyConnected(session));
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

  // Dismiss a session: mark it as ended without killing the process.
  // Used for read-only sessions or sessions whose process is already gone.
  app.post<{ Params: { id: string } }>(
    '/api/v1/sessions/:id/dismiss',
    async (req, reply) => {
      const session = getSession(req.params.id);
      if (!session) return reply.status(404).send({ error: 'NOT_FOUND', message: `Session ${req.params.id} not found` });
      if (session.status === 'ended' || session.status === 'completed') {
        return reply.status(409).send({ error: 'CONFLICT', message: 'Session already ended' });
      }
      const now = new Date().toISOString();
      updateSessionStatus(req.params.id, 'ended', now);
      const { broadcast: broadcastEvent } = await import('../ws/event-dispatcher.js');
      broadcastEvent({ type: 'session.ended', timestamp: now, data: { ...session, status: 'ended', endedAt: now } as unknown as Record<string, unknown> });
      return reply.send({ status: 'ended' });
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
