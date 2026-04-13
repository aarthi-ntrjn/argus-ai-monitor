import { spawnSync } from 'child_process';
import { randomUUID } from 'crypto';
import { getSession, insertControlAction, updateControlAction } from '../db/database.js';
import { broadcast } from '../api/ws/event-dispatcher.js';
import { validatePidOwnership } from './pid-validator.js';
import { ptyRegistry } from './pty-registry.js';
import type { ControlAction } from '../models/index.js';

export class SessionController {
  async stopSession(sessionId: string): Promise<ControlAction> {
    console.log(`[stopSession] requested sessionId=${sessionId}`);
    const session = getSession(sessionId);
    if (!session) {
      console.log(`[stopSession] NOT_FOUND sessionId=${sessionId}`);
      throw Object.assign(new Error(`Session ${sessionId} not found`), { code: 'NOT_FOUND' });
    }
    if (session.status === 'ended' || session.status === 'completed') {
      console.log(`[stopSession] CONFLICT sessionId=${sessionId} status=${session.status}`);
      throw Object.assign(new Error('Session already ended'), { code: 'CONFLICT' });
    }
    if (!session.pid) {
      console.log(`[stopSession] PID_NOT_SET sessionId=${sessionId}`);
      throw Object.assign(new Error('Session has no PID on record'), { code: 'PID_NOT_SET' });
    }

    console.log(`[stopSession] validating PID ownership sessionId=${sessionId} pid=${session.pid} type=${session.type}`);
    const validation = await validatePidOwnership(session.pid, session.type);
    if (!validation.valid) {
      const code = validation.reason === 'process_not_ai_tool' ? 'PID_NOT_AI_TOOL' : 'PID_NOT_FOUND';
      const message = validation.reason === 'process_not_ai_tool'
        ? 'PID does not belong to a monitored AI process'
        : 'Process is no longer running';
      console.log(`[stopSession] validation failed sessionId=${sessionId} pid=${session.pid} reason=${validation.reason}`);
      throw Object.assign(new Error(message), { code });
    }

    console.log(`[stopSession] validation passed, killing pid=${session.pid} sessionId=${sessionId}`);
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
      console.log(`[stopSession] COMPLETED actionId=${action.id} sessionId=${sessionId} pid=${session.pid}`);
      return completed;
    } catch (err) {
      const failed = { ...action, status: 'failed' as const, completedAt: new Date().toISOString(), result: String(err) };
      updateControlAction(action.id, 'failed', failed.completedAt, failed.result);
      this.broadcastAction(failed);
      console.log(`[stopSession] FAILED actionId=${action.id} sessionId=${sessionId} pid=${session.pid} error=${String(err)}`);
      return failed;
    }
  }

  async sendPrompt(sessionId: string, prompt: string): Promise<ControlAction> {
    const session = getSession(sessionId);
    if (!session) throw Object.assign(new Error(`Session ${sessionId} not found`), { code: 'NOT_FOUND' });
    if (session.status === 'ended' || session.status === 'completed') {
      throw Object.assign(new Error('Session already ended'), { code: 'CONFLICT' });
    }

    console.log(`[sendPrompt] sessionId=${sessionId} type=${session.type} launchMode=${session.launchMode} ptyRegistryHas=${ptyRegistry.has(sessionId)}`);

    // Only PTY-launched sessions have a delivery channel
    if (session.launchMode !== 'pty') {
      const action: ControlAction = {
        id: randomUUID(),
        sessionId,
        type: 'send_prompt',
        payload: { prompt },
        status: 'failed',
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        result: 'Prompt delivery requires starting this session via argus launch',
      };
      insertControlAction(action);
      this.broadcastAction(action);
      return action;
    }

    if (!ptyRegistry.has(sessionId)) {
      const action: ControlAction = {
        id: randomUUID(),
        sessionId,
        type: 'send_prompt',
        payload: { prompt },
        status: 'failed',
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        result: 'Session launcher is not connected to Argus',
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
      status: 'pending',
      createdAt: new Date().toISOString(),
      completedAt: null,
      result: null,
    };
    insertControlAction(action);
    this.broadcastAction(action);

    // Deliver asynchronously; HTTP response returns immediately with pending action
    ptyRegistry.sendPrompt(sessionId, action.id, prompt)
      .then(() => {
        const now = new Date().toISOString();
        console.log(`[sendPrompt] DELIVERED actionId=${action.id} sessionId=${sessionId}`);
        updateControlAction(action.id, 'completed', now, null);
        this.broadcastAction({ ...action, status: 'completed', completedAt: now });
      })
      .catch((err: Error) => {
        const now = new Date().toISOString();
        console.log(`[sendPrompt] FAILED actionId=${action.id} sessionId=${sessionId} error=${err.message}`);
        updateControlAction(action.id, 'failed', now, err.message);
        this.broadcastAction({ ...action, status: 'failed', completedAt: now, result: err.message });
      });

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

    const validation = await validatePidOwnership(session.pid, session.type);
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
      spawnSync('taskkill', ['/PID', String(pid), '/F']);
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
