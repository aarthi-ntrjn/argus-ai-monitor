import { basename } from 'path';
import { randomUUID } from 'crypto';
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
import type { Repository } from '../../models/index.js';
import type { SessionType } from '../../models/index.js';

interface RegisterMessage {
  type: 'register';
  sessionId: string;
  hostPid: number;
  pid: number | null;
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

interface UpdatePidMessage {
  type: 'update_pid';
  pid: number;
}

interface SessionEndedMessage {
  type: 'session_ended';
  sessionId: string;
  exitCode: number | null;
}

interface WorkspaceIdMessage {
  type: 'workspace_id';
  sessionId: string;
}

interface DiagnosticMessage {
  type: 'diagnostic';
  actionId: string;
  detail: string;
}

type LauncherMessage =
  | RegisterMessage
  | PromptDeliveredMessage
  | PromptFailedMessage
  | UpdatePidMessage
  | SessionEndedMessage
  | WorkspaceIdMessage
  | DiagnosticMessage;

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
        ptyRegistry.registerPending(msg.sessionId, socket, msg.cwd, msg.hostPid, msg.pid);
        fastify.log.info({ tempId: msg.sessionId, hostPid: msg.hostPid, pid: msg.pid, cwd: msg.cwd }, 'Launcher pending waiting for Claude hook');
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

      if (msg.type === 'diagnostic') {
        fastify.log.info({ actionId: msg.actionId, detail: msg.detail }, 'Launcher diagnostic');
        return;
      }

      if (msg.type === 'update_pid') {
        // The launcher resolved the real tool PID (e.g. claude.exe) from the
        // powershell.exe wrapper process tree. Update the pending registry entry
        // and, if already claimed, update the DB session.
        if (repoPath) {
          ptyRegistry.updatePendingPid(repoPath, msg.pid);
        }
        const claudeSessionId = tempId ? ptyRegistry.getClaimedId(tempId) : null;
        if (claudeSessionId) {
          const session = getSession(claudeSessionId);
          if (session) {
            const updated = { ...session, pid: msg.pid };
            upsertSession(updated);
            broadcast({ type: 'session.updated', timestamp: new Date().toISOString(), data: updated as unknown as Record<string, unknown> });
            fastify.log.info({ claudeSessionId, pid: msg.pid }, 'Updated session with resolved tool PID');
          }
        }
        return;
      }

      if (msg.type === 'workspace_id') {
        // launch.ts found the copilot workspace.yaml and is telling us the real session ID.
        // Claim the pending connection by tempId directly — no repoPath matching needed.
        if (!tempId) return;
        fastify.log.info({ tempId, workspaceSessionId: msg.sessionId }, 'Launcher: workspace_id received');
        const claimed = ptyRegistry.claimByTempId(tempId, msg.sessionId);
        if (claimed) {
          // Eagerly upgrade the DB session if a scan already created it with launchMode:null
          const session = getSession(msg.sessionId);
          if (session && session.launchMode !== 'pty') {
            fastify.log.info({ claudeSessionId: msg.sessionId }, 'Launcher: upgrading existing session to launchMode=pty');
            const updated = { ...session, launchMode: 'pty' as const, pid: claimed.pid, hostPid: claimed.hostPid, pidSource: 'pty_registry' as const };
            upsertSession(updated);
            broadcast({ type: 'session.updated', timestamp: new Date().toISOString(), data: updated as unknown as Record<string, unknown> });
          }
          fastify.log.info({ claudeSessionId: msg.sessionId, hostPid: claimed.hostPid, pid: claimed.pid }, 'Copilot session claimed via workspace_id');
        } else {
          fastify.log.warn({ tempId, workspaceSessionId: msg.sessionId }, 'Launcher: workspace_id claim failed — no pending entry for tempId');
        }
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
        } else {
          fastify.log.info({ claudeSessionId, status: session?.status }, 'Launcher disconnected — session already ended, no status change');
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
