import Fastify from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { loadConfig } from './config/config-loader.js';
import { addClient, removeClient, broadcast } from './api/ws/event-dispatcher.js';
import repositoriesRoutes from './api/routes/repositories.js';
import sessionsRoutes from './api/routes/sessions.js';
import hooksRoutes, { setClaudeDetector } from './api/routes/hooks.js';
import healthRoutes from './api/routes/health.js';
import metricsRoutes from './api/routes/metrics.js';
import { SessionMonitor } from './services/session-monitor.js';
import { startPruningJob } from './services/pruning-job.js';
import type { Session, Repository } from './models/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let monitor: SessionMonitor | null = null;

export async function buildServer() {
  const config = loadConfig();

  const app = Fastify({
    logger: {
      level: 'info',
      transport: process.env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
    },
    genReqId: () => randomUUID(),
    requestIdHeader: 'x-request-id',
  });

  await app.register(fastifyWebsocket);

  await app.register(fastifySwagger, {
    openapi: {
      info: { title: 'Argus API', description: 'Argus Session Dashboard API', version: '1.0.0' },
      servers: [{ url: 'http://127.0.0.1:7411' }],
    },
  });

  await app.register(fastifySwaggerUi, {
    routePrefix: '/api/docs',
    uiConfig: { docExpansion: 'list', deepLinking: false },
  });

  const frontendDist = join(__dirname, '..', '..', 'frontend', 'dist');
  try {
    await app.register(fastifyStatic, { root: frontendDist, wildcard: false, decorateReply: false });
  } catch {
    app.log.warn('Frontend dist not found, skipping static file serving');
  }

  app.addHook('onSend', async (request, reply) => {
    reply.header('X-Request-Id', request.id);
  });

  app.setErrorHandler((error, request, reply) => {
    request.log.error({ err: error, requestId: request.id }, 'Request error');
    reply.status(error.statusCode ?? 500).send({
      error: error.code ?? 'INTERNAL_ERROR',
      message: error.message,
      requestId: request.id,
    });
  });

  await app.register(repositoriesRoutes);
  await app.register(sessionsRoutes);
  await app.register(hooksRoutes);
  await app.register(healthRoutes);
  await app.register(metricsRoutes);

  app.register(async (fastify) => {
    fastify.get('/ws', { websocket: true }, (connection) => {
      addClient(connection.socket);
      connection.on('close', () => removeClient(connection.socket));
    });
  });

  return { app, config };
}

export async function startServer() {
  const { app, config } = await buildServer();

  monitor = new SessionMonitor();
  const claudeDetector = monitor.getClaudeCodeDetector();
  setClaudeDetector(claudeDetector);

  monitor.on('session.created', (session: Session) => {
    broadcast({ type: 'session.created', timestamp: new Date().toISOString(), data: session as unknown as Record<string, unknown> });
  });
  monitor.on('session.updated', (session: Session) => {
    broadcast({ type: 'session.updated', timestamp: new Date().toISOString(), data: session as unknown as Record<string, unknown> });
  });
  monitor.on('session.ended', (session: Session) => {
    broadcast({ type: 'session.ended', timestamp: new Date().toISOString(), data: session as unknown as Record<string, unknown> });
  });
  monitor.on('repository.added', (repo: Repository) => {
    broadcast({ type: 'repository.added', timestamp: new Date().toISOString(), data: repo as unknown as Record<string, unknown> });
  });

  await monitor.start();
  startPruningJob();

  process.on('SIGTERM', async () => { monitor?.stop(); await app.close(); process.exit(0); });
  process.on('SIGINT', async () => { monitor?.stop(); await app.close(); process.exit(0); });

  await app.listen({ port: config.port, host: '127.0.0.1' });
  app.log.info({ port: config.port }, 'Argus server started');
  return app;
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});