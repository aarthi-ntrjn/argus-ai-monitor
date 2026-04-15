import 'dotenv/config';
import Fastify, { type FastifyError } from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { randomUUID } from 'crypto';
import { loadConfig } from './config/config-loader.js';
import * as logger from './utils/logger.js';
import { addClient, removeClient, broadcast } from './api/ws/event-dispatcher.js';
import repositoriesRoutes, { setMonitor } from './api/routes/repositories.js';
import sessionsRoutes from './api/routes/sessions.js';
import hooksRoutes, { setClaudeDetector } from './api/routes/hooks.js';
import healthRoutes from './api/routes/health.js';
import metricsRoutes from './api/routes/metrics.js';
import { fsRoutes } from './api/routes/fs.js';
import todosRoutes from './api/routes/todos.js';
import launcherRoutes from './api/routes/launcher.js';
import toolsRoutes from './api/routes/tools.js';
import settingsRoutes from './api/routes/settings.js';
import telemetryRoutes from './api/routes/telemetry.js';
import { telemetryService } from './services/telemetry-service.js';
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
      level: process.env.LOG_LEVEL ?? 'info',
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
    await app.register(fastifyStatic, { root: frontendDist });
    // SPA catch-all: serve index.html for any unmatched non-API route
    app.setNotFoundHandler((_request, reply) => {
      reply.sendFile('index.html');
    });
  } catch {
    app.log.warn('Frontend dist not found, skipping static file serving');
  }

  app.addHook('onSend', async (request, reply) => {
    reply.header('X-Request-Id', request.id);
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
  });

  app.setErrorHandler((error: FastifyError, request, reply) => {
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
  await app.register(fsRoutes);
  await app.register(todosRoutes);
  await app.register(launcherRoutes);
  await app.register(toolsRoutes);
  await app.register(settingsRoutes);
  await app.register(telemetryRoutes);

  app.register(async (fastify) => {
    fastify.get('/ws', { websocket: true }, (socket) => {
      addClient(socket);
      socket.on('close', () => removeClient(socket));
    });
  });

  return { app, config };
}

export async function startServer() {
  const { app, config } = await buildServer();

  monitor = new SessionMonitor();
  const claudeDetector = monitor.getClaudeCodeDetector();
  setClaudeDetector(claudeDetector);
  setMonitor(monitor);

  monitor.on('session.created', (session: Session) => {
    broadcast({ type: 'session.created', timestamp: new Date().toISOString(), data: session as unknown as Record<string, unknown> });
    telemetryService.sendEvent('session_started', { sessionType: session.type, sessionId: session.id, launchMode: session.launchMode === 'pty' ? 'connected' : 'readonly', yoloMode: session.yoloMode });
  });
  monitor.on('session.updated', (session: Session) => {
    broadcast({ type: 'session.updated', timestamp: new Date().toISOString(), data: session as unknown as Record<string, unknown> });
  });
  monitor.on('session.ended', (session: Session) => {
    broadcast({ type: 'session.ended', timestamp: new Date().toISOString(), data: session as unknown as Record<string, unknown> });
    telemetryService.sendEvent('session_ended', { sessionType: session.type, sessionId: session.id, yoloMode: session.yoloMode });
  });
  monitor.on('repository.added', (repo: Repository) => {
    broadcast({ type: 'repository.added', timestamp: new Date().toISOString(), data: repo as unknown as Record<string, unknown> });
  });

  await monitor.start();
  startPruningJob();

  process.on('SIGTERM', async () => { telemetryService.sendEvent('app_ended'); monitor?.stop(); await app.close(); process.exit(0); });
  process.on('SIGINT', async () => { telemetryService.sendEvent('app_ended'); monitor?.stop(); await app.close(); process.exit(0); });

  await app.listen({ port: config.port, host: '127.0.0.1' });
  app.log.info({ port: config.port }, 'Argus server started');
  telemetryService.sendEvent('app_started');
  return app;
}

// Only auto-start when run directly (not when imported by tests)
const isMain = process.argv[1]?.endsWith('server.ts') || process.argv[1]?.endsWith('server.js');
if (isMain) {
  startServer().catch((err) => {
    logger.error('Failed to start server:', err);
    process.exit(1);
  });
}

