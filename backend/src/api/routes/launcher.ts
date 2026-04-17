import { basename } from 'path';
import { randomUUID } from 'crypto';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';import type { WebSocket } from 'ws';
import { ptyRegistry } from '../../services/pty-registry.js';
import {
  getSession,
  getSessionByPtyLaunchId,
  upsertSession,
  updateSessionStatus,
  getRepositoryByPath,
  insertRepository,
} from '../../db/database.js';
import { broadcast } from '../ws/event-dispatcher.js';
import { detectYoloModeFromPids, isPidRunning } from '../../services/process-utils.js';
import type { Repository } from '../../models/index.js';
import type { SessionType } from '../../models/index.js';

interface RegisterMessage {
  type: 'register';
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
  const repo = { id, path: cwd, name: basename(cwd), source: 'ui' as const, addedAt: now, lastScannedAt: null, branch: null, remoteUrl: null };
  insertRepository(repo);
  return repo;
}

const launcherRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Querystring: { id: string } }>(
    '/launcher',
    { websocket: true },
    (socket: WebSocket, request: FastifyRequest<{ Querystring: { id: string } }>) => {
    const ptyLaunchId = request.query.id;
    let repoPath: string | null = null;

    if (!ptyLaunchId) {
      fastify.log.warn('Launcher WebSocket opened without ptyLaunchId, closing');
      socket.close();
      return;
    }

    fastify.log.info({ ptyLaunchId }, 'Launcher WebSocket opened');
    socket.send(JSON.stringify({ type: 'connected' }));

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
        repoPath = msg.cwd;

        // Ensure the repo exists so the detector can find it by path.
        ensureRepository(msg.cwd);

        // Hold the connection pending — we do NOT create a DB session here.
        // The session is created in ClaudeCodeDetector.handleHookPayload once
        // Claude fires its first hook and we learn the real session ID.
        ptyRegistry.registerPending(ptyLaunchId, socket, msg.cwd, msg.hostPid, msg.pid, msg.sessionType);
        fastify.log.info({ ptyLaunchId, hostPid: msg.hostPid, pid: msg.pid, cwd: msg.cwd }, 'Launcher pending');

        // Server-restart reconnect: if a session with this ptyLaunchId already exists in DB
        // and its process is still alive, immediately re-establish the WS connection for both
        // claude-code and copilot-cli — no need to wait for the next scan cycle.
        const existingSession = getSessionByPtyLaunchId(ptyLaunchId);
        if (existingSession) {
          const livePid = existingSession.hostPid ?? existingSession.pid;
          if (livePid !== null && isPidRunning(livePid)) {
            ptyRegistry.claimByPtyLaunchId(ptyLaunchId, existingSession.id);
            fastify.log.info({ ptyLaunchId, sessionId: existingSession.id, priorStatus: existingSession.status }, 'Launcher reconnected to existing session via ptyLaunchId');
            const now = new Date().toISOString();
            if (existingSession.status === 'ended') {
              const restored = { ...existingSession, status: 'active' as const, endedAt: null, lastActivityAt: now };
              upsertSession(restored);
              broadcast({ type: 'session.updated', timestamp: now, data: { ...restored, ptyConnected: true } as unknown as Record<string, unknown> });
              fastify.log.info({ ptyLaunchId, sessionId: existingSession.id }, 'Launcher: restored session to active after server restart');
            } else {
              broadcast({ type: 'session.updated', timestamp: now, data: { ...existingSession, ptyConnected: true } as unknown as Record<string, unknown> });
            }
          }
        }
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
        const claudeSessionId = ptyLaunchId ? ptyRegistry.getClaimedId(ptyLaunchId) : null;
        if (claudeSessionId) {
          const session = getSession(claudeSessionId);
          if (session) {
            const yoloMode = session.yoloMode || detectYoloModeFromPids(msg.pid, session.hostPid ?? null, session.type);
            const updated = { ...session, pid: msg.pid, yoloMode };
            upsertSession(updated);
            broadcast({ type: 'session.updated', timestamp: new Date().toISOString(), data: updated as unknown as Record<string, unknown> });
            fastify.log.info({ claudeSessionId, pid: msg.pid, yoloMode }, 'Updated session with resolved tool PID');
          } else {
            // Session row not yet inserted (update_pid raced ahead of the first scan).
            // Park the pid in the registry so resolvePtyLinkage can pick it up on first scan.
            ptyRegistry.updateClaimedPid(claudeSessionId, msg.pid);
            fastify.log.info({ claudeSessionId, pid: msg.pid }, 'Parked resolved pid — session not yet in DB');
          }
        }
        return;
      }

      if (msg.type === 'workspace_id') {
        // launch.ts found the copilot workspace.yaml and is telling us the real session ID.
        // Claim the pending connection by ptyLaunchId directly — no repoPath matching needed.
        if (!ptyLaunchId) return;
        fastify.log.info({ ptyLaunchId, workspaceSessionId: msg.sessionId }, 'Launcher: workspace_id received');
        const claimed = ptyRegistry.claimByPtyLaunchId(ptyLaunchId, msg.sessionId);
        if (claimed) {
          // Eagerly upgrade the DB session if a scan already created it with launchMode:null
          const session = getSession(msg.sessionId);
          if (session) {
            const needsUpgrade = session.launchMode !== 'pty';
            const needsRestore = session.status === 'ended' && isPidRunning(claimed.hostPid);
            if (needsUpgrade || needsRestore) {
              const now = new Date().toISOString();
              const updated = {
                ...session,
                launchMode: 'pty' as const,
                pid: needsUpgrade ? claimed.pid : session.pid,
                hostPid: needsUpgrade ? claimed.hostPid : session.hostPid,
                pidSource: needsUpgrade ? 'pty_registry' as const : session.pidSource,
                status: needsRestore ? 'active' as const : session.status,
                endedAt: needsRestore ? null : session.endedAt,
                lastActivityAt: needsRestore ? now : session.lastActivityAt,
                ptyLaunchId,
              };
              upsertSession(updated);
              broadcast({ type: 'session.updated', timestamp: now, data: { ...updated, ptyConnected: true } as unknown as Record<string, unknown> });
              if (needsRestore) {
                fastify.log.info({ claudeSessionId: msg.sessionId, ptyLaunchId }, 'Launcher: restored copilot session to active after server restart');
              } else {
                fastify.log.info({ claudeSessionId: msg.sessionId }, 'Launcher: upgrading existing session to launchMode=pty');
              }
            } else if (!session.ptyLaunchId) {
              // Persist ptyLaunchId if not yet stored (first-time claim)
              upsertSession({ ...session, ptyLaunchId });
            }
          }
          fastify.log.info({ claudeSessionId: msg.sessionId, hostPid: claimed.hostPid, pid: claimed.pid }, 'Copilot session claimed via workspace_id');
        } else {
          fastify.log.warn({ ptyLaunchId, workspaceSessionId: msg.sessionId }, 'Launcher: workspace_id claim failed — no pending entry for ptyLaunchId');
        }
        return;
      }

      if (msg.type === 'session_ended') {
        // launch.ts sends its own temp UUID; translate to the claimed claude session ID.
        const claudeSessionId = ptyLaunchId ? ptyRegistry.getClaimedId(ptyLaunchId) : null;
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

    socket.on('close', (code: number, reason: Buffer) => {
      const reasonStr = reason.length > 0 ? reason.toString() : undefined;
      fastify.log.info({ ptyLaunchId, code, reason: reasonStr }, 'Launcher WebSocket closed');

      if (!ptyLaunchId) return;

      const claudeSessionId = ptyRegistry.getClaimedId(ptyLaunchId);
      if (claudeSessionId) {
        ptyRegistry.unregister(claudeSessionId);
        const session = getSession(claudeSessionId);
        if (session && session.status !== 'ended') {
          const now = new Date().toISOString();
          const livePid = session.hostPid ?? session.pid;
          if (livePid !== null && isPidRunning(livePid)) {
            // Process is still alive — launcher is reconnecting. Mark as connecting, not ended.
            broadcast({ type: 'session.updated', timestamp: now, data: { ...session, ptyConnected: false } as unknown as Record<string, unknown> });
            fastify.log.info({ claudeSessionId, code }, 'Launcher disconnected but process alive — marked connecting');
          } else {
            updateSessionStatus(claudeSessionId, 'ended', now);
            broadcast({
              type: 'session.ended',
              timestamp: now,
              data: { ...session, status: 'ended', endedAt: now } as unknown as Record<string, unknown>,
            });
            fastify.log.info({ claudeSessionId, code }, 'Launcher disconnected — session marked ended');
          }
        } else {
          fastify.log.info({ claudeSessionId, status: session?.status, code }, 'Launcher disconnected — session already ended, no status change');
        }
      } else if (repoPath) {
        // Never claimed — claude never started or crashed before first hook.
        ptyRegistry.unregisterPending(repoPath, ptyLaunchId);
        fastify.log.info({ ptyLaunchId, repoPath, code }, 'Launcher disconnected before Claude hook — no session created');
      }
    });
  });
};

export default launcherRoutes;

