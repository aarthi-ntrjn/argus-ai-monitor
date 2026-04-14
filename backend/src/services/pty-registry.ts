import { normalize } from 'path';
import WebSocket from 'ws';

function normalizePath(p: string): string {
  return normalize(p.trimEnd().replace(/[/\\]+$/, '')).toLowerCase();
}

interface PendingPrompt {
  resolve: () => void;
  reject: (err: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

interface PendingLauncher {
  tempId: string;
  ws: WebSocket;
  hostPid: number;
  pid: number | null;
}

export class PtyRegistry {
  // Claimed connections: claudeSessionId -> ws
  private connections = new Map<string, WebSocket>();

  // Pending connections waiting for Claude's session ID: repoPath -> launcher info
  private pendingByRepoPath = new Map<string, PendingLauncher>();

  // Reverse map so close handlers can look up the claimed session ID by temp UUID
  private tempToClaimedId = new Map<string, string>();

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
  registerPending(tempId: string, ws: WebSocket, repoPath: string, hostPid: number, pid: number | null = null): void {
    const key = normalizePath(repoPath);
    console.log(`[PtyRegistry] registerPending tempId=${tempId} hostPid=${hostPid} pid=${pid} repoPath="${repoPath}" key="${key}"`);
    this.pendingByRepoPath.set(key, { tempId, ws, hostPid, pid });
  }

  // Update the real tool PID for a pending connection (before claim).
  // Called after the Windows process tree walk resolves the actual CLI exe PID.
  updatePendingPid(repoPath: string, pid: number): void {
    const pending = this.pendingByRepoPath.get(normalizePath(repoPath));
    if (pending) {
      console.log(`[PtyRegistry] updatePendingPid tempId=${pending.tempId} pid=${pid} repoPath="${repoPath}"`);
      pending.pid = pid;
    }
  }

  // Called by the launcher WS handler when launch.ts sends a workspace_id message
  // after discovering the copilot workspace.yaml. Promotes the pending connection to
  // a claimed connection keyed by sessionId, bypassing repoPath matching entirely.
  claimByTempId(tempId: string, sessionId: string): { pid: number | null; hostPid: number } | null {
    for (const [key, pending] of this.pendingByRepoPath) {
      if (pending.tempId === tempId) {
        console.log(`[PtyRegistry] claimByTempId tempId=${tempId} sessionId=${sessionId} hostPid=${pending.hostPid} pid=${pending.pid} key="${key}"`);
        this.connections.set(sessionId, pending.ws);
        this.tempToClaimedId.set(tempId, sessionId);
        this.pendingByRepoPath.delete(key);
        return { pid: pending.pid, hostPid: pending.hostPid };
      }
    }
    console.log(`[PtyRegistry] claimByTempId MISS tempId=${tempId} sessionId=${sessionId} — no pending entry found`);
    return null;
  }

  // Called by ClaudeCodeDetector or CopilotCliDetector when a session is matched by repoPath.
  // Promotes the pending connection to a claimed connection keyed by claudeSessionId.
  // Returns pid (may be null if update_pid hasn't arrived yet) and hostPid (always set),
  // or null if no launcher is waiting for this repo.
  claimForSession(claudeSessionId: string, repoPath: string): { pid: number | null; hostPid: number } | null {
    const key = normalizePath(repoPath);
    const pending = this.pendingByRepoPath.get(key);
    if (!pending) {
      console.log(`[PtyRegistry] claimForSession MISS sessionId=${claudeSessionId} repoPath="${repoPath}" key="${key}"`);
      return null;
    }
    console.log(`[PtyRegistry] claimForSession OK sessionId=${claudeSessionId} hostPid=${pending.hostPid} pid=${pending.pid} repoPath="${repoPath}"`);
    this.connections.set(claudeSessionId, pending.ws);
    this.tempToClaimedId.set(pending.tempId, claudeSessionId);
    this.pendingByRepoPath.delete(key);
    return { pid: pending.pid, hostPid: pending.hostPid };
  }

  // Returns the claude session ID that was claimed for this temp launcher UUID,
  // or undefined if the launcher never had a hook come in.
  getClaimedId(tempId: string): string | undefined {
    return this.tempToClaimedId.get(tempId);
  }

  // Stores the resolved tool PID for an already-claimed session.
  // Called when update_pid arrives but the DB session row doesn't exist yet.
  updateClaimedPid(sessionId: string, pid: number): void {
    console.log(`[PtyRegistry] updateClaimedPid sessionId=${sessionId} pid=${pid}`);
    this.claimedPids.set(sessionId, pid);
  }

  // Returns the resolved tool PID stored by updateClaimedPid, or null if not yet available.
  getClaimedPid(sessionId: string): number | null {
    return this.claimedPids.get(sessionId) ?? null;
  }

  // Clean up a pending connection that never got claimed (e.g. claude crashed before first hook).
  unregisterPending(repoPath: string, tempId: string): void {
    console.log(`[PtyRegistry] unregisterPending tempId=${tempId} repoPath="${repoPath}"`);
    this.pendingByRepoPath.delete(normalizePath(repoPath));
    this.tempToClaimedId.delete(tempId);
  }

  unregister(sessionId: string): void {
    console.log(`[PtyRegistry] unregister sessionId=${sessionId}`);
    this.connections.delete(sessionId);
    this.claimedPids.delete(sessionId);
  }

  has(sessionId: string): boolean {
    return this.connections.has(sessionId);
  }

  // timeoutMs exposed for testing; defaults to 30s in production
  // (copilot-cli adds a 500ms initial delay + 50ms per character, so longer prompts need more time)
  sendPrompt(sessionId: string, actionId: string, prompt: string, timeoutMs = 30_000): Promise<void> {
    const ws = this.connections.get(sessionId);
    console.log(`[PtyRegistry.sendPrompt] sessionId=${sessionId} wsFound=${!!ws} wsState=${ws?.readyState}`);
    if (!ws) {
      return Promise.reject(new Error(`Session ${sessionId} launcher is not connected to Argus`));
    }

    if (ws.readyState !== WebSocket.OPEN) {
      // Stale entry — WS closed between the has() check and now. Clean up and reject.
      this.connections.delete(sessionId);
      return Promise.reject(new Error(`Session ${sessionId} launcher is not connected to Argus`));
    }

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(actionId);
        console.log(`[PtyRegistry.sendPrompt] TIMEOUT — no ack received within ${timeoutMs}ms actionId=${actionId} sessionId=${sessionId}`);
        reject(new Error(`Prompt delivery timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pending.set(actionId, { resolve, reject, timeout });
      const msg = JSON.stringify({ type: 'send_prompt', actionId, prompt });
      console.log(`[PtyRegistry.sendPrompt] sending WS message actionId=${actionId} promptLen=${prompt.length}`);
      ws.send(msg);
    });
  }

  handleAck(actionId: string, success: boolean, error?: string): void {
    const entry = this.pending.get(actionId);
    console.log(`[PtyRegistry.handleAck] actionId=${actionId} success=${success} found=${!!entry} error=${error ?? ''}`);
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
