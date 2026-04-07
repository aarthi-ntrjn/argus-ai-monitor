import type { WebSocket } from 'ws';

interface PendingPrompt {
  resolve: () => void;
  reject: (err: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

export class PtyRegistry {
  private connections = new Map<string, WebSocket>();
  private pending = new Map<string, PendingPrompt>();

  register(sessionId: string, ws: WebSocket): void {
    this.connections.set(sessionId, ws);
  }

  unregister(sessionId: string): void {
    this.connections.delete(sessionId);
    // Pending promises time out naturally; no need to reject them here
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
