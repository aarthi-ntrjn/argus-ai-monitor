import WebSocket from 'ws';
import type { SessionType } from '../models/index.js';

interface RegisterInfo {
  sessionId: string;
  pid: number;
  sessionType: SessionType;
  cwd: string;
}

type PromptCallback = (actionId: string, prompt: string) => void;

export class ArgusLaunchClient {
  private ws: WebSocket;
  private registerInfo: RegisterInfo | null = null;
  private promptCallback: PromptCallback | null = null;

  constructor(url: string) {
    this.ws = new WebSocket(url);
    this.ws.on('open', () => this.handleOpen());
    this.ws.on('message', (data: Buffer) => this.handleMessage(data));
    this.ws.on('error', (err: Error) => {
      // Connection errors are non-fatal — argus may not be running
      process.stderr.write(`[argus] Could not connect to Argus backend: ${err.message}\n`);
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

  notifySessionEnded(sessionId: string, exitCode: number | null): void {
    this.send({ type: 'session_ended', sessionId, exitCode });
    this.ws.close();
  }

  private handleOpen(): void {
    if (this.registerInfo) {
      this.send({ type: 'register', ...this.registerInfo });
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
      this.promptCallback?.(msg.actionId, msg.prompt);
    }
  }

  private send(payload: Record<string, unknown>): void {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }
}
