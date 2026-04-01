import { exec } from 'child_process';
import { promisify } from 'util';
import { randomUUID } from 'crypto';
import { getSession, insertControlAction, updateControlAction } from '../db/database.js';
import { broadcast } from '../api/ws/event-dispatcher.js';
import type { ControlAction } from '../models/index.js';

const execAsync = promisify(exec);

export class SessionController {
  async stopSession(sessionId: string): Promise<ControlAction> {
    const session = getSession(sessionId);
    if (!session) throw Object.assign(new Error(`Session ${sessionId} not found`), { code: 'NOT_FOUND' });
    if (session.status === 'ended' || session.status === 'completed') {
      throw Object.assign(new Error('Session already ended'), { code: 'CONFLICT' });
    }

    const action: ControlAction = {
      id: randomUUID(),
      sessionId,
      type: 'stop',
      payload: null,
      status: 'pending',
      createdAt: new Date().toISOString(),
      completedAt: null,
      result: null,
    };
    insertControlAction(action);
    this.broadcastAction(action);

    try {
      if (session.pid) await this.killProcess(session.pid);
      const completed = { ...action, status: 'completed' as const, completedAt: new Date().toISOString() };
      updateControlAction(action.id, 'completed', completed.completedAt, null);
      this.broadcastAction(completed);
      return completed;
    } catch (err) {
      const failed = { ...action, status: 'failed' as const, completedAt: new Date().toISOString(), result: String(err) };
      updateControlAction(action.id, 'failed', failed.completedAt, failed.result);
      this.broadcastAction(failed);
      return failed;
    }
  }

  async sendPrompt(sessionId: string, prompt: string): Promise<ControlAction> {
    const session = getSession(sessionId);
    if (!session) throw Object.assign(new Error(`Session ${sessionId} not found`), { code: 'NOT_FOUND' });
    if (session.status === 'ended' || session.status === 'completed') {
      throw Object.assign(new Error('Session already ended'), { code: 'CONFLICT' });
    }

    if (session.type === 'copilot-cli') {
      const action: ControlAction = {
        id: randomUUID(),
        sessionId,
        type: 'send_prompt',
        payload: { prompt },
        status: 'not_supported',
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        result: 'Prompt injection not supported for Copilot CLI in v1',
      };
      insertControlAction(action);
      this.broadcastAction(action);
      return action;
    }

    const action: ControlAction = {
      id: randomUUID(),
      sessionId,
      type: 'send_prompt',
      payload: { prompt },
      status: 'sent',
      createdAt: new Date().toISOString(),
      completedAt: null,
      result: null,
    };
    insertControlAction(action);
    this.broadcastAction(action);
    return action;
  }

  private async killProcess(pid: number): Promise<void> {
    if (process.platform === 'win32') {
      await execAsync(`taskkill /PID ${pid} /T /F`);
    } else {
      process.kill(pid, 'SIGTERM');
    }
  }

  private broadcastAction(action: ControlAction): void {
    broadcast({
      type: 'action.updated',
      timestamp: new Date().toISOString(),
      data: action as unknown as Record<string, unknown>,
    });
  }
}
