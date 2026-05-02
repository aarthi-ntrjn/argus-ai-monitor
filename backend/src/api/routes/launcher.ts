import { basename } from 'path';
import { randomUUID } from 'crypto';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';import type { WebSocket } from 'ws';
import { ptyRegistry } from '../../services/pty-registry.js';
import { resolveSessionIdByPid } from '../../services/session-pid-resolver.js';
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
import { telemetryService } from '../../services/telemetry-service.js';

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

function tryLinkByPid(ptyLaunchId: string, pid: number, sessionType: SessionType): string | null {
  const sessionId = resolveSessionIdByPid(pid, sessionType);
  if (sessionId) ptyRegistry.linkToSession(ptyLaunchId, sessionId);
  return sessionId ?? null;
}

const launcherRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Querystring: { id: string } }>(
    '/launcher',
    { websocket: true },
    (socket: WebSocket, request: FastifyRequest<{ Querystring: { id: string } }>) => {
    const ptyLaunchId = request.query.id;
    let repoPath: string | null = null;

    if (!ptyLaunchId) {
      fastify.log.warn('[Launcher] WebSocket opened without ptyLaunchId, closing');
      socket.close();
      return;
    }

    fastify.log.info({ ptyLaunchId }, '[Launcher] WebSocket opened');
    socket.send(JSON.stringify({ type: 'connected' }));

    socket.on('message', (raw: Buffer) => {
      let msg: LauncherMessage;
      try {
        msg = JSON.parse(raw.toString()) as LauncherMessage;
      } catch {
        fastify.log.warn('[Launcher] received malformed JSON, closing connection');
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
        fastify.log.info({ ptyLaunchId, hostPid: msg.hostPid, pid: msg.pid, cwd: msg.cwd }, '[Launcher] pending');

        // Non-Windows: pid is known at register time — resolve sessionId immediately.
        if (msg.pid !== null) {
          const linkedId = tryLinkByPid(ptyLaunchId, msg.pid, msg.sessionType);
          if (linkedId) {
            fastify.log.info({ ptyLaunchId, pid: msg.pid, sessionType: msg.sessionType, sessionId: linkedId }, `[Launcher] ${msg.sessionType === 'claude-code' ? 'Claude Code' : 'Copilot CLI'}: PID resolved at register — pre-linked to sessionId`);
          } else {
            fastify.log.info({ ptyLaunchId, pid: msg.pid, sessionType: msg.sessionType }, `[Launcher] ${msg.sessionType === 'claude-code' ? 'Claude Code' : 'Copilot CLI'}: PID resolved at register — session file not yet written, will retry at claim time`);
          }
        }

        // Server-restart reconnect: if a session with this ptyLaunchId already exists in DB
        // and its process is still alive, immediately re-establish the WS connection for both
        // claude-code and copilot-cli — no need to wait for the next scan cycle.
        const existingSession = getSessionByPtyLaunchId(ptyLaunchId);
        if (existingSession) {
          const livePid = existingSession.hostPid ?? existingSession.pid;
          if (livePid !== null && isPidRunning(livePid)) {
            ptyRegistry.promotePendingToSession(ptyLaunchId, existingSession.id);
            fastify.log.info({ ptyLaunchId, sessionId: existingSession.id, priorStatus: existingSession.status }, '[Launcher] reconnected to existing session via ptyLaunchId');
            const now = new Date().toISOString();
            if (existingSession.status === 'ended') {
              const restored = { ...existingSession, status: 'active' as const, endedAt: null, lastActivityAt: now };
              upsertSession(restored);
              broadcast({ type: 'session.updated', timestamp: now, data: { ...restored, ptyConnected: true } });
              fastify.log.info({ ptyLaunchId, sessionId: existingSession.id }, '[Launcher] restored session to active after server restart');
            } else {
              broadcast({ type: 'session.updated', timestamp: now, data: { ...existingSession, ptyConnected: true } });
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
        fastify.log.info({ actionId: msg.actionId, detail: msg.detail }, '[Launcher] diagnostic');
        return;
      }

      if (msg.type === 'update_pid') {
        // The launcher resolved the real tool PID (e.g. claude.exe) from the
        // powershell.exe wrapper process tree. Update the pending registry entry
        // and, if already claimed, update the DB session.
        if (ptyLaunchId) {
          ptyRegistry.updatePendingPid(ptyLaunchId, msg.pid);
          // Windows: PID resolved now from process tree — look up sessionId from on-disk session files.
          const sessionType = ptyRegistry.getPendingSessionType(ptyLaunchId);
          if (sessionType) {
            const linkedId = tryLinkByPid(ptyLaunchId, msg.pid, sessionType);
            if (linkedId) {
              fastify.log.info({ ptyLaunchId, pid: msg.pid, sessionType, sessionId: linkedId }, `[Launcher] ${sessionType === 'claude-code' ? 'Claude Code' : 'Copilot CLI'}: update_pid resolved — pre-linked to sessionId`);
            } else {
              fastify.log.info({ ptyLaunchId, pid: msg.pid, sessionType }, `[Launcher] ${sessionType === 'claude-code' ? 'Claude Code' : 'Copilot CLI'}: update_pid resolved — session file not yet written, repoPath fallback will apply`);
            }
          }
        }
        const claudeSessionId = ptyLaunchId ? ptyRegistry.getClaimedId(ptyLaunchId) : null;
        if (claudeSessionId) {
          const session = getSession(claudeSessionId);
          if (session) {
            const yoloMode = session.yoloMode || detectYoloModeFromPids(msg.pid, session.hostPid ?? null, session.type);
            const updated = { ...session, pid: msg.pid, yoloMode };
            upsertSession(updated);
            broadcast({ type: 'session.updated', timestamp: new Date().toISOString(), data: updated });
            fastify.log.info({ claudeSessionId, pid: msg.pid, yoloMode }, '[Launcher] updated session with resolved tool PID');
          } else {
            // Session row not yet inserted (update_pid raced ahead of the first scan).
            // Park the pid in the registry so resolvePtyLinkage can pick it up on first scan.
            ptyRegistry.updateClaimedPid(claudeSessionId, msg.pid);
            fastify.log.info({ claudeSessionId, pid: msg.pid }, '[Launcher] parked resolved pid, session not yet in DB');
          }
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
          if (session) {
            broadcast({
              type: 'session.ended',
              timestamp: now,
              data: session,
            });
            telemetryService.sendEvent('session_ended', {
              sessionType: session.type,
              sessionId: session.id,
              launchMode: session.launchMode === 'pty' ? 'connected' : 'readonly',
              yoloMode: session.yoloMode,
            });
          }
          fastify.log.info({ claudeSessionId, exitCode: msg.exitCode }, '[Launcher] session ended');
        }
      }
    });

    socket.on('close', (code: number, reason: Buffer) => {
      const reasonStr = reason.length > 0 ? reason.toString() : undefined;
      fastify.log.info({ ptyLaunchId, code, reason: reasonStr }, '[Launcher] WebSocket closed');

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
            broadcast({ type: 'session.updated', timestamp: now, data: { ...session, ptyConnected: false } });
            fastify.log.info({ claudeSessionId, code }, '[Launcher] disconnected but process alive, marked connecting');
          } else {
            updateSessionStatus(claudeSessionId, 'ended', now);
            const endedSession = { ...session, status: 'ended' as const, endedAt: now };
            broadcast({
              type: 'session.ended',
              timestamp: now,
              data: endedSession,
            });
            telemetryService.sendEvent('session_ended', {
              sessionType: session.type,
              sessionId: session.id,
              launchMode: session.launchMode === 'pty' ? 'connected' : 'readonly',
              yoloMode: session.yoloMode,
            });
            fastify.log.info({ claudeSessionId, code }, '[Launcher] disconnected, session marked ended');
          }
        } else {
          fastify.log.info({ claudeSessionId, status: session?.status, code }, '[Launcher] disconnected, session already ended, no status change');
        }
      } else if (repoPath) {
        // Never claimed — claude never started or crashed before first hook.
        ptyRegistry.unregisterPending(repoPath, ptyLaunchId);
        fastify.log.info({ ptyLaunchId, repoPath, code }, '[Launcher] disconnected before Claude hook, no session created');
      }
    });
  });
};

export default launcherRoutes;

