import WebSocket from 'ws';
import type { SessionType } from '../models/index.js';

interface RegisterInfo {
  sessionId: string;
  hostPid: number;
  pid: number | null;
  sessionType: SessionType;
  cwd: string;
}

type PromptCallback = (actionId: string, prompt: string) => void | Promise<void>;

export class ArgusLaunchClient {
  private ws!: WebSocket;
  private url: string;
  private registerInfo: RegisterInfo | null = null;
  private promptCallback: PromptCallback | null = null;
  private isClosing = false;
  private workspaceSessionId: string | null = null;
  private pendingPid: number | null = null;
  private log: (msg: string) => void;

  constructor(url: string, log?: (msg: string) => void) {
    this.url = url;
    this.log = log ?? (() => {});
    this.connect();
  }

  private connect(): void {
    this.ws = new WebSocket(this.url);
    this.ws.on('open', () => this.handleOpen());
    this.ws.on('message', (data: Buffer) => this.handleMessage(data));
    this.ws.on('error', (err: Error) => {
      // Connection errors are non-fatal — argus may not be running
      // process.stderr.write(`[argus] Could not connect to Argus backend: ${err.message}\n`);
    });
    this.ws.on('close', () => {
      if (!this.isClosing) {
        // Backend restarted or connection dropped — reconnect and re-register
        setTimeout(() => this.connect(), 2000);
      }
    });
  }

  setRegisterInfo(info: RegisterInfo): void {
    this.registerInfo = info;
  }

  onSendPrompt(cb: PromptCallback): void {
    this.promptCallback = cb;
  }

  ackDelivered(actionId: string): void {
    this.send({ type: 'prompt_delivered', actionId });
  }

  ackFailed(actionId: string, error: string): void {
    this.send({ type: 'prompt_failed', actionId, error });
  }

  updatePid(pid: number): void {
    // Always keep registerInfo in sync so the register replay on reconnect carries the correct pid.
    if (this.registerInfo) {
      this.registerInfo = { ...this.registerInfo, pid };
    }
    const wsState = this.ws.readyState;
    const isOpen = wsState === WebSocket.OPEN;
    this.log(`updatePid pid=${pid} ws.readyState=${wsState} (${isOpen ? 'OPEN' : 'NOT_OPEN'})`);
    if (!isOpen) {
      this.log(`updatePid: ws not open, parking pid=${pid} for replay on open`);
      this.pendingPid = pid;
      return;
    }
    this.send({ type: 'update_pid', pid });
  }

  sendWorkspaceId(id: string): void {
    this.workspaceSessionId = id;
    this.send({ type: 'workspace_id', sessionId: id });
  }

  notifySessionEnded(sessionId: string, exitCode: number | null): Promise<void> {
    this.isClosing = true;
    return new Promise<void>((resolve) => {
      const done = () => { clearTimeout(timer); resolve(); };
      // Safety timeout so the launcher never hangs if the server is unresponsive
      const timer = setTimeout(done, 2000);
      if (this.ws.readyState !== WebSocket.OPEN) { done(); return; }
      // Use the send callback to know when data is flushed, then close
      this.ws.send(JSON.stringify({ type: 'session_ended', sessionId, exitCode }), () => {
        this.ws.once('close', done);
        this.ws.close();
      });
    });
  }

  private handleOpen(): void {
    if (this.registerInfo) {
      this.send({ type: 'register', ...this.registerInfo });
    }
    // Re-send workspace_id on reconnect so the backend can re-claim the session
    if (this.workspaceSessionId) {
      this.send({ type: 'workspace_id', sessionId: this.workspaceSessionId });
    }
    // Replay a pid that arrived before the connection was ready
    if (this.pendingPid !== null) {
      this.log(`handleOpen: replaying deferred update_pid pid=${this.pendingPid}`);
      this.send({ type: 'update_pid', pid: this.pendingPid });
      this.pendingPid = null;
    }
  }

  private handleMessage(data: Buffer): void {
    let msg: { type: string; actionId?: string; prompt?: string };
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }

    if (msg.type === 'send_prompt' && msg.actionId && msg.prompt !== undefined) {
      //process.stderr.write(`[argus-launch-client] send_prompt received actionId=${msg.actionId} promptLen=${msg.prompt.length}\n`);
      this.promptCallback?.(msg.actionId, msg.prompt);
    }
  }

  private send(payload: Record<string, unknown>): void {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }
}
