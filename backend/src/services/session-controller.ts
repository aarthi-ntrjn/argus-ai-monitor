import { spawnSync } from 'child_process';
import { randomUUID } from 'crypto';
import { getSession, insertControlAction, updateControlAction } from '../db/database.js';
import { broadcast } from '../api/ws/event-dispatcher.js';
import { validatePidOwnership } from './pid-validator.js';
import type { ControlAction } from '../models/index.js';

export class SessionController {
  async stopSession(sessionId: string): Promise<ControlAction> {
    const session = getSession(sessionId);
    if (!session) throw Object.assign(new Error(`Session ${sessionId} not found`), { code: 'NOT_FOUND' });
    if (session.status === 'ended' || session.status === 'completed') {
      throw Object.assign(new Error('Session already ended'), { code: 'CONFLICT' });
    }
    if (!session.pid) {
      throw Object.assign(new Error('Session has no PID on record'), { code: 'PID_NOT_SET' });
    }

    const validation = await validatePidOwnership(session.pid, session.type as 'claude-code' | 'copilot-cli');
    if (!validation.valid) {
      const code = validation.reason === 'process_not_ai_tool' ? 'PID_NOT_AI_TOOL' : 'PID_NOT_FOUND';
      const message = validation.reason === 'process_not_ai_tool'
        ? 'PID does not belong to a monitored AI process'
        : 'Process is no longer running';
      throw Object.assign(new Error(message), { code });
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
      await this.killProcess(session.pid);
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

  async interruptSession(sessionId: string): Promise<ControlAction> {
    const session = getSession(sessionId);
    if (!session) throw Object.assign(new Error(`Session ${sessionId} not found`), { code: 'NOT_FOUND' });
    if (session.status === 'ended' || session.status === 'completed') {
      throw Object.assign(new Error('Session already ended'), { code: 'CONFLICT' });
    }
    if (!session.pid) {
      throw Object.assign(new Error('Session has no PID on record'), { code: 'PID_NOT_SET' });
    }

    const validation = await validatePidOwnership(session.pid, session.type as 'claude-code' | 'copilot-cli');
    if (!validation.valid) {
      const code = validation.reason === 'process_not_ai_tool' ? 'PID_NOT_AI_TOOL' : 'PID_NOT_FOUND';
      const message = validation.reason === 'process_not_ai_tool'
        ? 'PID does not belong to a monitored AI process'
        : 'Process is no longer running';
      throw Object.assign(new Error(message), { code });
    }

    const action: ControlAction = {
      id: randomUUID(),
      sessionId,
      type: 'interrupt',
      payload: null,
      status: 'pending',
      createdAt: new Date().toISOString(),
      completedAt: null,
      result: null,
    };
    insertControlAction(action);
    this.broadcastAction(action);

    try {
      await this.interruptProcess(session.pid);
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

  private async interruptProcess(pid: number): Promise<void> {
    if (process.platform === 'win32') {
      // Windows: taskkill without /F sends Ctrl+Break (closest to SIGINT)
      // spawnSync with args array avoids shell string interpolation (FR-002)
      spawnSync('taskkill', ['/PID', String(pid)]);
    } else {
      process.kill(pid, 'SIGINT');
    }
  }

  private async killProcess(pid: number): Promise<void> {
    if (process.platform === 'win32') {
      // spawnSync with args array avoids shell string interpolation (FR-002)
      spawnSync('taskkill', ['/PID', String(pid), '/T', '/F']);
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
