import { normalize } from 'path';
import WebSocket from 'ws';
import { createTaggedLogger } from '../utils/logger.js';

const log = createTaggedLogger('[PtyRegistry]', '\x1b[35m'); // magenta
import type { SessionType } from '../models/index.js';

function normalizePath(p: string): string {
  return normalize(p.trimEnd().replace(/[/\\]+$/, '')).toLowerCase();
}

interface PendingPrompt {
  resolve: () => void;
  reject: (err: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

interface PendingLauncher {
  ptyLaunchId: string;
  ws: WebSocket;
  hostPid: number;
  pid: number | null;
  sessionType: SessionType;
  repoPath: string;
}

export class PtyRegistry {
  // Claimed connections: claudeSessionId -> ws
  private connections = new Map<string, WebSocket>();

  // Pending connections waiting to be claimed, keyed by ptyLaunchId.
  // Multiple launchers for the same repo path can coexist here without overwriting each other.
  private pendingByLaunchId = new Map<string, PendingLauncher>();

  // Pre-resolved ptyLaunchId → sessionId mappings, set by linkToSession() when the tool PID
  // is matched against on-disk session files before the detector/hook fires.
  private preLinked = new Map<string, string>();

  // Reverse map so close handlers can look up the claimed session ID by ptyLaunchId
  private ptyLaunchToClaimedId = new Map<string, string>();

  // Stores the resolved tool PID for a claimed session even before the DB session exists.
  // Set by updateClaimedPid when update_pid arrives before the session row is inserted.
  private claimedPids = new Map<string, number>();

  private pending = new Map<string, PendingPrompt>();

  // Called when the launcher WebSocket connects and sends its register message.
  // We hold the connection here without creating a DB session — the DB session
  // is created once Claude fires its first hook and we learn the real session ID.
  // hostPid is the shell wrapper PID (powershell.exe on Windows, same as tool PID elsewhere).
  // pid is the initial tool PID: null on Windows (resolved later via update_pid),
  // or the same as hostPid on non-Windows (pty.pid is directly the tool process).
  registerPending(ptyLaunchId: string, ws: WebSocket, repoPath: string, hostPid: number, pid: number | null = null, sessionType: SessionType = 'claude-code'): void {
    log.info(` registerPending ptyLaunchId=${ptyLaunchId} hostPid=${hostPid} pid=${pid} sessionType=${sessionType} repoPath="${repoPath}"`);
    this.pendingByLaunchId.set(ptyLaunchId, { ptyLaunchId, ws, hostPid, pid, sessionType, repoPath });
  }

  // Update the real tool PID for a pending connection (before claim).
  // Called after the Windows process tree walk resolves the actual CLI exe PID.
  updatePendingPid(ptyLaunchId: string, pid: number): void {
    const pending = this.pendingByLaunchId.get(ptyLaunchId);
    if (pending) {
      log.info(` updatePendingPid ptyLaunchId=${ptyLaunchId} pid=${pid}`);
      pending.pid = pid;
    }
  }

  // Returns the sessionType of a still-pending launcher, or null if not found.
  getPendingSessionType(ptyLaunchId: string): SessionType | null {
    return this.pendingByLaunchId.get(ptyLaunchId)?.sessionType ?? null;
  }

  // Called by the launcher route when it resolves a PID → sessionId mapping via on-disk session
  // files (Claude: ~/.claude/sessions/*.json, Copilot: inuse.<pid>.lock + workspace.yaml).
  // Stores the mapping so claimForSession can do a direct O(1) lookup instead of scanning
  // all pending entries by repoPath.
  linkToSession(ptyLaunchId: string, sessionId: string): void {
    log.info(` linkToSession ptyLaunchId=${ptyLaunchId} sessionId=${sessionId}`);
    this.preLinked.set(ptyLaunchId, sessionId);
  }

  // Called by ClaudeCodeDetector or CopilotCliDetector when a session is matched.
  // Checks pre-linked entries first (O(1) via PID resolution done at update_pid time),
  // then falls back to a repoPath scan for cases where the session file wasn't written yet.
  claimForSession(sessionId: string, repoPath: string, sessionType: SessionType): { pid: number | null; hostPid: number; ptyLaunchId: string } | null {
    // Fast path: pre-linked via PID resolution
    for (const [id, preSessionId] of this.preLinked) {
      if (preSessionId !== sessionId) continue;
      const pending = this.pendingByLaunchId.get(id);
      if (!pending) { this.preLinked.delete(id); continue; }
      log.info(` claimForSession PRE-LINKED sessionId=${sessionId} ptyLaunchId=${id} hostPid=${pending.hostPid} pid=${pending.pid}`);
      this.connections.set(sessionId, pending.ws);
      this.ptyLaunchToClaimedId.set(id, sessionId);
      this.pendingByLaunchId.delete(id);
      this.preLinked.delete(id);
      return { pid: pending.pid, hostPid: pending.hostPid, ptyLaunchId: id };
    }

    // Fallback: repoPath scan (handles race where session file not yet written at link time)
    const key = normalizePath(repoPath);
    for (const [id, pending] of this.pendingByLaunchId) {
      if (normalizePath(pending.repoPath) !== key) continue;
      if (pending.sessionType !== sessionType) {
        log.info(` claimForSession TYPE MISMATCH ptyLaunchId=${id} sessionId=${sessionId} expected=${sessionType} got=${pending.sessionType} repoPath="${repoPath}", skipping`);
        continue;
      }
      log.info(` claimForSession OK sessionId=${sessionId} ptyLaunchId=${id} hostPid=${pending.hostPid} pid=${pending.pid} sessionType=${sessionType} repoPath="${repoPath}"`);
      this.connections.set(sessionId, pending.ws);
      this.ptyLaunchToClaimedId.set(id, sessionId);
      this.pendingByLaunchId.delete(id);
      return { pid: pending.pid, hostPid: pending.hostPid, ptyLaunchId: id };
    }
    log.info(` claimForSession MISS sessionId=${sessionId} expected=${sessionType} repoPath="${repoPath}"`);
    return null;
  }

  // Called during server-restart reconnect: the launcher has re-registered (registerPending)
  // and we already know its session ID from the DB. Promotes the pending entry directly
  // without a repoPath scan.
  promotePendingToSession(ptyLaunchId: string, sessionId: string): { pid: number | null; hostPid: number } | null {
    const pending = this.pendingByLaunchId.get(ptyLaunchId);
    if (!pending) {
      log.info(` promotePendingToSession MISS ptyLaunchId=${ptyLaunchId} sessionId=${sessionId}`);
      return null;
    }
    log.info(` promotePendingToSession ptyLaunchId=${ptyLaunchId} sessionId=${sessionId} hostPid=${pending.hostPid}`);
    this.connections.set(sessionId, pending.ws);
    this.ptyLaunchToClaimedId.set(ptyLaunchId, sessionId);
    this.pendingByLaunchId.delete(ptyLaunchId);
    return { pid: pending.pid, hostPid: pending.hostPid };
  }

  // Returns the claude session ID that was claimed for this ptyLaunchId,
  // or undefined if the launcher never had a hook come in.
  getClaimedId(ptyLaunchId: string): string | undefined {
    return this.ptyLaunchToClaimedId.get(ptyLaunchId);
  }

  // Returns the ptyLaunchId that claimed this session, or undefined if not found.
  getPtyLaunchIdForSession(sessionId: string): string | undefined {
    for (const [ptyLaunchId, claimedId] of this.ptyLaunchToClaimedId) {
      if (claimedId === sessionId) return ptyLaunchId;
    }
    return undefined;
  }

  // Stores the resolved tool PID for an already-claimed session.
  // Called when update_pid arrives but the DB session row doesn't exist yet.
  updateClaimedPid(sessionId: string, pid: number): void {
    log.info(` updateClaimedPid sessionId=${sessionId} pid=${pid}`);
    this.claimedPids.set(sessionId, pid);
  }

  // Returns the resolved tool PID stored by updateClaimedPid, or null if not yet available.
  getClaimedPid(sessionId: string): number | null {
    return this.claimedPids.get(sessionId) ?? null;
  }

  // Clean up a pending connection that never got claimed (e.g. claude crashed before first hook).
  unregisterPending(repoPath: string, ptyLaunchId: string): void {
    log.warn(` unregisterPending ptyLaunchId=${ptyLaunchId} repoPath="${repoPath}"`);
    this.pendingByLaunchId.delete(ptyLaunchId);
  }

  unregister(sessionId: string): void {
    log.warn(` unregister sessionId=${sessionId}`);
    this.connections.delete(sessionId);
    this.claimedPids.delete(sessionId);
  }

  has(sessionId: string): boolean {
    return this.connections.has(sessionId);
  }

  sendPrompt(sessionId: string, actionId: string, prompt: string, timeoutMs = 30_000, skipEnter = false): Promise<void> {
    const ws = this.connections.get(sessionId);
    log.info(`sendPrompt: sessionId=${sessionId} wsFound=${!!ws} wsState=${ws?.readyState}`);
    if (!ws) {
      return Promise.reject(new Error(`Session ${sessionId} launcher is not connected to Argus`));
    }

    if (ws.readyState !== WebSocket.OPEN) {
      // Stale entry — WS closed between the has() check and now. Clean up and reject.
      log.warn(` removing stale connection sessionId=${sessionId} wsState=${ws.readyState}`);
      this.connections.delete(sessionId);
      return Promise.reject(new Error(`Session ${sessionId} launcher is not connected to Argus`));
    }

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(actionId);
        log.info(`sendPrompt: TIMEOUT — no ack received within ${timeoutMs}ms actionId=${actionId} sessionId=${sessionId}`);
        reject(new Error(`Prompt delivery timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pending.set(actionId, { resolve, reject, timeout });
      const msg = JSON.stringify({ type: 'send_prompt', actionId, prompt, skipEnter });
      log.info(`sendPrompt: sending WS message actionId=${actionId} promptLen=${prompt.length}`);
      ws.send(msg);
    });
  }

  handleAck(actionId: string, success: boolean, error?: string): void {
    const entry = this.pending.get(actionId);
    log.info(`handleAck: actionId=${actionId} success=${success} found=${!!entry} error=${error ?? ''}`);
    if (!entry) return;

    clearTimeout(entry.timeout);
    this.pending.delete(actionId);

    if (success) {
      entry.resolve();
    } else {
      entry.reject(new Error(error ?? 'Prompt delivery failed'));
    }
  }
}

// Module-level singleton used by the server
export const ptyRegistry = new PtyRegistry();




