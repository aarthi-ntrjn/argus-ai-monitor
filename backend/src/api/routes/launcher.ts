import { randomUUID } from 'crypto';
import { basename } from 'path';
import type { FastifyPluginAsync } from 'fastify';
import type { WebSocket } from 'ws';
import { ptyRegistry } from '../../services/pty-registry.js';
import {
  getSession,
  upsertSession,
  updateSessionStatus,
  getRepositoryByPath,
  insertRepository,
} from '../../db/database.js';
import { broadcast } from '../ws/event-dispatcher.js';
import type { Session, SessionType } from '../../models/index.js';

interface RegisterMessage {
  type: 'register';
  sessionId: string;
  pid: number;
  sessionType: SessionType;
  cwd: string;
}

interface PromptDeliveredMessage {
  type: 'prompt_delivered';
  actionId: string;
}

interface PromptFailedMessage {
  type: 'prompt_failed';
  actionId: string;
  error: string;
}

interface SessionEndedMessage {
  type: 'session_ended';
  sessionId: string;
  exitCode: number | null;
}

type LauncherMessage =
  | RegisterMessage
  | PromptDeliveredMessage
  | PromptFailedMessage
  | SessionEndedMessage;

function ensureRepository(cwd: string): string {
  const existing = getRepositoryByPath(cwd);
  if (existing) return existing.id;
  const id = randomUUID();
  const now = new Date().toISOString();
  insertRepository({ id, path: cwd, name: basename(cwd), source: 'ui', addedAt: now, lastScannedAt: null, branch: null });
  return id;
}

const launcherRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/launcher', { websocket: true }, (socket: WebSocket) => {
    let registeredSessionId: string | null = null;

    socket.on('message', (raw: Buffer) => {
      let msg: LauncherMessage;
      try {
        msg = JSON.parse(raw.toString()) as LauncherMessage;
      } catch {
        fastify.log.warn('Launcher: received malformed JSON, closing connection');
        socket.close();
        return;
      }

      if (msg.type === 'register') {
        registeredSessionId = msg.sessionId;
        ptyRegistry.register(msg.sessionId, socket);

        const repositoryId = ensureRepository(msg.cwd);
        const now = new Date().toISOString();
        const existing = getSession(msg.sessionId);
        const session: Session = existing
          ? { ...existing, launchMode: 'pty', pid: msg.pid, status: 'active', lastActivityAt: now }
          : {
              id: msg.sessionId,
              repositoryId,
              type: msg.sessionType,
              launchMode: 'pty',
              pid: msg.pid,
              status: 'active',
              startedAt: now,
              endedAt: null,
              lastActivityAt: now,
              summary: null,
              expiresAt: null,
              model: null,
            };
        upsertSession(session);
        broadcast({
          type: 'session.updated',
          timestamp: now,
          data: session as unknown as Record<string, unknown>,
        });
        fastify.log.info({ sessionId: msg.sessionId, pid: msg.pid }, 'Launcher registered');
        return;
      }

      if (msg.type === 'prompt_delivered') {
        ptyRegistry.handleAck(msg.actionId, true);
        return;
      }

      if (msg.type === 'prompt_failed') {
        ptyRegistry.handleAck(msg.actionId, false, msg.error);
        return;
      }

      if (msg.type === 'session_ended') {
        const now = new Date().toISOString();
        updateSessionStatus(msg.sessionId, 'ended', now);
        const session = getSession(msg.sessionId);
        broadcast({
          type: 'session.ended',
          timestamp: now,
          data: (session ?? { id: msg.sessionId }) as unknown as Record<string, unknown>,
        });
        fastify.log.info({ sessionId: msg.sessionId, exitCode: msg.exitCode }, 'Launcher session ended');
      }
    });

    socket.on('close', () => {
      if (!registeredSessionId) return;
      ptyRegistry.unregister(registeredSessionId);
      const session = getSession(registeredSessionId);
      if (session && session.status !== 'ended') {
        const now = new Date().toISOString();
        updateSessionStatus(registeredSessionId, 'ended', now);
        broadcast({
          type: 'session.ended',
          timestamp: now,
          data: { id: registeredSessionId } as Record<string, unknown>,
        });
        fastify.log.info({ sessionId: registeredSessionId }, 'Launcher disconnected — session marked ended');
      }
    });
  });
};

export default launcherRoutes;
