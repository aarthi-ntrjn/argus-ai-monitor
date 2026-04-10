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
  pid: number;
}

export class PtyRegistry {
  // Claimed connections: claudeSessionId -> ws
  private connections = new Map<string, WebSocket>();

  // Pending connections waiting for Claude's session ID: repoPath -> launcher info
  private pendingByRepoPath = new Map<string, PendingLauncher>();

  // Reverse map so close handlers can look up the claimed session ID by temp UUID
  private tempToClaimedId = new Map<string, string>();

  private pending = new Map<string, PendingPrompt>();

  // Called when the launcher WebSocket connects and sends its register message.
  // We hold the connection here without creating a DB session — the DB session
  // is created once Claude fires its first hook and we learn the real session ID.
  registerPending(tempId: string, ws: WebSocket, repoPath: string, pid: number): void {
    const key = normalizePath(repoPath);
    console.log(`[PtyRegistry] registerPending tempId=${tempId} pid=${pid} repoPath="${repoPath}" key="${key}"`);
    this.pendingByRepoPath.set(key, { tempId, ws, pid });
  }

  // Update the PID for a pending connection (before claim).
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
  claimByTempId(tempId: string, sessionId: string): { pid: number } | null {
    for (const [key, pending] of this.pendingByRepoPath) {
      if (pending.tempId === tempId) {
        console.log(`[PtyRegistry] claimByTempId tempId=${tempId} sessionId=${sessionId} pid=${pending.pid} key="${key}"`);
        this.connections.set(sessionId, pending.ws);
        this.tempToClaimedId.set(tempId, sessionId);
        this.pendingByRepoPath.delete(key);
        return { pid: pending.pid };
      }
    }
    console.log(`[PtyRegistry] claimByTempId MISS tempId=${tempId} sessionId=${sessionId} — no pending entry found`);
    return null;
  }

  // Called by ClaudeCodeDetector when a hook fires for a session in repoPath.
  // Promotes the pending connection to a claimed connection keyed by claudeSessionId.
  // Returns the launcher pid so the detector can store it on the session, or null
  // if no launcher is waiting for this repo.
  claimForSession(claudeSessionId: string, repoPath: string): { pid: number } | null {
    const key = normalizePath(repoPath);
    const pending = this.pendingByRepoPath.get(key);
    if (!pending) {
      console.log(`[PtyRegistry] claimForSession MISS sessionId=${claudeSessionId} repoPath="${repoPath}" key="${key}"`);
      return null;
    }
    console.log(`[PtyRegistry] claimForSession OK sessionId=${claudeSessionId} pid=${pending.pid} repoPath="${repoPath}"`);
    this.connections.set(claudeSessionId, pending.ws);
    this.tempToClaimedId.set(pending.tempId, claudeSessionId);
    this.pendingByRepoPath.delete(key);
    return { pid: pending.pid };
  }

  // Returns the claude session ID that was claimed for this temp launcher UUID,
  // or undefined if the launcher never had a hook come in.
  getClaimedId(tempId: string): string | undefined {
    return this.tempToClaimedId.get(tempId);
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
  }

  has(sessionId: string): boolean {
    return this.connections.has(sessionId);
  }

  // timeoutMs exposed for testing; defaults to 10s in production
  sendPrompt(sessionId: string, actionId: string, prompt: string, timeoutMs = 10_000): Promise<void> {
    const ws = this.connections.get(sessionId);
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
        reject(new Error(`Prompt delivery timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pending.set(actionId, { resolve, reject, timeout });
      ws.send(JSON.stringify({ type: 'send_prompt', actionId, prompt }));
    });
  }

  handleAck(actionId: string, success: boolean, error?: string): void {
    const entry = this.pending.get(actionId);
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
