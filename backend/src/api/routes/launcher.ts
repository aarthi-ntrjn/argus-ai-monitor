import { basename } from 'path';
import { randomUUID } from 'crypto';
import type { FastifyPluginAsync } from 'fastify';
import type { WebSocket } from 'ws';
import { ptyRegistry } from '../../services/pty-registry.js';
import {
  getSession,
  updateSessionStatus,
  getRepositoryByPath,
  insertRepository,
} from '../../db/database.js';
import { broadcast } from '../ws/event-dispatcher.js';
import type { Repository } from '../../models/index.js';
import type { SessionType } from '../../models/index.js';

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

function ensureRepository(cwd: string): Repository {
  const existing = getRepositoryByPath(cwd);
  if (existing) return existing;
  const id = randomUUID();
  const now = new Date().toISOString();
  const repo = { id, path: cwd, name: basename(cwd), source: 'ui' as const, addedAt: now, lastScannedAt: null, branch: null };
  insertRepository(repo);
  return repo;
}

const launcherRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/launcher', { websocket: true }, (socket: WebSocket) => {
    // tempId: the UUID launch.ts generated. Not a DB session ID.
    let tempId: string | null = null;
    let repoPath: string | null = null;

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
        tempId = msg.sessionId;
        repoPath = msg.cwd;

        // Ensure the repo exists so the detector can find it by path.
        ensureRepository(msg.cwd);

        // Hold the connection pending — we do NOT create a DB session here.
        // The session is created in ClaudeCodeDetector.handleHookPayload once
        // Claude fires its first hook and we learn the real session ID.
        ptyRegistry.registerPending(msg.sessionId, socket, msg.cwd, msg.pid);
        fastify.log.info({ tempId: msg.sessionId, pid: msg.pid, cwd: msg.cwd }, 'Launcher pending — waiting for Claude hook');
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
        // launch.ts sends its own temp UUID; translate to the claimed claude session ID.
        const claudeSessionId = tempId ? ptyRegistry.getClaimedId(tempId) : null;
        if (claudeSessionId) {
          const now = new Date().toISOString();
          updateSessionStatus(claudeSessionId, 'ended', now);
          const session = getSession(claudeSessionId);
          broadcast({
            type: 'session.ended',
            timestamp: now,
            data: (session ?? { id: claudeSessionId }) as unknown as Record<string, unknown>,
          });
          fastify.log.info({ claudeSessionId, exitCode: msg.exitCode }, 'Launcher session ended');
        }
      }
    });

    socket.on('close', () => {
      if (!tempId) return;

      const claudeSessionId = ptyRegistry.getClaimedId(tempId);
      if (claudeSessionId) {
        // Session was claimed — mark it ended and clean up.
        ptyRegistry.unregister(claudeSessionId);
        const session = getSession(claudeSessionId);
        if (session && session.status !== 'ended') {
          const now = new Date().toISOString();
          updateSessionStatus(claudeSessionId, 'ended', now);
          broadcast({
            type: 'session.ended',
            timestamp: now,
            data: { id: claudeSessionId } as Record<string, unknown>,
          });
          fastify.log.info({ claudeSessionId }, 'Launcher disconnected — session marked ended');
        }
      } else if (repoPath) {
        // Never claimed — claude never started or crashed before first hook.
        ptyRegistry.unregisterPending(repoPath, tempId);
        fastify.log.info({ tempId, repoPath }, 'Launcher disconnected before Claude hook — no session created');
      }
    });
  });
};

export default launcherRoutes;
