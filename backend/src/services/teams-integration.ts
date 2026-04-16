import { randomUUID } from 'crypto';
import type { Logger } from 'pino';
import type { App } from '@microsoft/teams.apps';
import type { Session, SessionOutput } from '../models/index.js';
import { loadTeamsConfig } from '../config/teams-config-loader.js';
import { getTeamsThread, upsertTeamsThread, updateTeamsThreadOutputMessageId, getRepository } from '../db/database.js';
import type { Repository } from '../models/index.js';
import type { TeamsMessageBuffer } from './teams-message-buffer.js';

type TrackedSessionState = {
  status: string;
  model: string | null;
  yoloMode: boolean | null;
  pid: number | null;
  launchMode: string | null;
};

function extractTrackedState(session: Session): TrackedSessionState {
  return {
    status: session.status,
    model: session.model,
    yoloMode: session.yoloMode,
    pid: session.pid,
    launchMode: session.launchMode,
  };
}

function field(label: string, value: string): string {
  return `**${label}:** ${value}`;
}

function code(value: string): string {
  return `\`${value}\``;
}

export class TeamsIntegrationService {
  private flushTimers = new Map<string, ReturnType<typeof setInterval>>();
  private lastPostedState = new Map<string, TrackedSessionState>();

  constructor(
    private readonly teamsApp: App,
    private readonly buffer: TeamsMessageBuffer,
    private readonly logger: Logger,
  ) {}

  private isConfigured(): boolean {
    const config = loadTeamsConfig();
    return config.enabled === true &&
      Boolean(config.teamId) &&
      Boolean(config.channelId) &&
      Boolean(config.ownerAadObjectId);
  }

  private _logCtx(): Record<string, string | undefined> {
    const config = loadTeamsConfig();
    return {
      clientId: process.env.CLIENT_ID,
      tenantId: process.env.TENANT_ID,
      teamId: config.teamId,
    };
  }

  async onSessionCreated(session: Session): Promise<void> {
    this.logger.info({ ...this._logCtx(), sessionId: session.id, status: session.status }, 'teams.session.created.received');
    const config = loadTeamsConfig();
    if (!this.isConfigured()) {
      this.logger.warn({ ...this._logCtx(), sessionId: session.id, enabled: config.enabled, hasTeamId: Boolean(config.teamId), hasChannelId: Boolean(config.channelId), hasOwner: Boolean(config.ownerAadObjectId) }, 'teams.session.created.skipped: not configured');
      return;
    }
    const { channelId } = config as { channelId: string };

    const existing = getTeamsThread(session.id);
    if (existing) {
      this.logger.info({ ...this._logCtx(), sessionId: session.id, teamsThreadId: existing.teamsThreadId }, 'teams.thread.reused');
      this.lastPostedState.set(session.id, extractTrackedState(session));
      try {
        await this.teamsApp.api.conversations.activities(channelId).reply(existing.teamsThreadId, { type: 'message', text: this._formatReconnectMessage(session) });
        this.logger.info({ ...this._logCtx(), sessionId: session.id, teamsThreadId: existing.teamsThreadId }, 'teams.thread.reused.notified');
      } catch (err) {
        this.logger.warn({ ...this._logCtx(), err, sessionId: session.id }, 'teams.thread.reused.notify.failed');
      }
      this._startFlushTimer(session.id, channelId);
      return;
    }

    const repo = getRepository(session.repositoryId);
    this.logger.info({ ...this._logCtx(), sessionId: session.id, repositoryId: session.repositoryId, repoName: repo?.name }, 'teams.thread.creating');
    try {
      const sent = await this.teamsApp.send(channelId, { type: 'message', text: this._formatOpeningMessage(session, repo) });
      upsertTeamsThread({
        id: randomUUID(),
        sessionId: session.id,
        teamsThreadId: sent.id,
        teamsChannelId: channelId,
        currentOutputMessageId: null,
        deltaLink: null,
        createdAt: new Date().toISOString(),
      });
      this.lastPostedState.set(session.id, extractTrackedState(session));
      this.logger.info({ ...this._logCtx(), sessionId: session.id, teamsThreadId: sent.id }, 'teams.thread.created');
      this._startFlushTimer(session.id, channelId);
    } catch (err) {
      this.logger.error({ ...this._logCtx(), err, sessionId: session.id }, 'teams.thread.create.failed');
    }
  }

  async onSessionUpdated(session: Session): Promise<void> {
    this.logger.info({ ...this._logCtx(), sessionId: session.id, status: session.status, model: session.model, pid: session.pid }, 'teams.session.updated.received');
    if (!this.isConfigured()) {
      this.logger.warn({ ...this._logCtx(), sessionId: session.id }, 'teams.session.updated.skipped: not configured');
      return;
    }

    const thread = getTeamsThread(session.id);
    if (!thread) {
      this.logger.info({ ...this._logCtx(), sessionId: session.id }, 'teams.session.updated: no thread, delegating to onSessionCreated');
      await this.onSessionCreated(session);
      return;
    }

    const prev = this.lastPostedState.get(session.id);
    const curr = extractTrackedState(session);
    const changes = this._diffState(prev, curr);
    if (changes.length === 0) {
      this.logger.info({ ...this._logCtx(), sessionId: session.id }, 'teams.session.updated.skipped: no meaningful changes');
      return;
    }

    this.logger.info({ ...this._logCtx(), sessionId: session.id, changes: changes.map(c => c.label), prev, curr }, 'teams.session.updated.posting');
    this.lastPostedState.set(session.id, curr);

    const config = loadTeamsConfig();
    const { channelId } = config as { channelId: string };

    try {
      await this.teamsApp.api.conversations.activities(channelId).reply(thread.teamsThreadId, { type: 'message', text: this._formatUpdateMessage(session, changes) });
      this.logger.info({ ...this._logCtx(), sessionId: session.id, changes: changes.map(c => c.label) }, 'teams.session.updated.posted');
    } catch (err) {
      this.logger.error({ ...this._logCtx(), err, sessionId: session.id }, 'teams.session.update.notify.failed');
    }
  }

  onSessionOutput(sessionId: string, outputs: SessionOutput[]): void {
    const config = loadTeamsConfig();
    if (!config.enabled) {
      this.logger.info({ sessionId }, 'teams.session.output.skipped: not enabled');
      return;
    }
    const enqueued = outputs.filter(o => o.content.trim()).length;
    this.logger.info({ sessionId, total: outputs.length, enqueued }, 'teams.session.output.received');
    for (const output of outputs) {
      if (!output.content.trim()) continue;
      this.buffer.enqueue(sessionId, output.content);
    }
  }

  async onSessionEnded(session: Session): Promise<void> {
    this.logger.info({ ...this._logCtx(), sessionId: session.id, status: session.status }, 'teams.session.ended.received');
    const config = loadTeamsConfig();
    if (!this.isConfigured()) {
      this.logger.warn({ ...this._logCtx(), sessionId: session.id }, 'teams.session.ended.skipped: not configured');
      return;
    }
    const { channelId } = config as { channelId: string };

    await this._flush(session.id, channelId);
    this._stopFlushTimer(session.id);

    const thread = getTeamsThread(session.id);
    if (!thread) {
      this.logger.warn({ ...this._logCtx(), sessionId: session.id }, 'teams.session.ended.skipped: no thread');
      return;
    }

    try {
      await this.teamsApp.api.conversations.activities(channelId).reply(thread.teamsThreadId, { type: 'message', text: this._formatEndedMessage(session) });
      this.logger.info({ ...this._logCtx(), sessionId: session.id, status: session.status }, 'teams.session.ended');
    } catch (err) {
      this.logger.error({ ...this._logCtx(), err, sessionId: session.id }, 'teams.session.end.notify.failed');
    }
  }

  stop(): void {
    for (const [sessionId] of this.flushTimers) {
      this._stopFlushTimer(sessionId);
    }
  }

  private _diffState(prev: TrackedSessionState | undefined, curr: TrackedSessionState): { label: string; value: string }[] {
    const changes: { label: string; value: string }[] = [];
    if (!prev || prev.status !== curr.status)
      changes.push({ label: 'Status', value: curr.status });
    if (!prev || prev.model !== curr.model)
      changes.push({ label: 'Model', value: curr.model ?? '(unknown)' });
    if (!prev || prev.yoloMode !== curr.yoloMode)
      changes.push({ label: 'Yolo', value: curr.yoloMode ? 'on' : 'off' });
    if (!prev || prev.pid !== curr.pid)
      changes.push({ label: 'PID', value: curr.pid != null ? String(curr.pid) : '(unknown)' });
    if (!prev || prev.launchMode !== curr.launchMode)
      changes.push({ label: 'Mode', value: curr.launchMode === 'pty' ? 'connected' : 'readonly' });
    return changes;
  }

  private _startFlushTimer(sessionId: string, channelId: string): void {
    if (this.flushTimers.has(sessionId)) return;
    const timer = setInterval(() => this._flush(sessionId, channelId), 3000);
    this.flushTimers.set(sessionId, timer);
  }

  private _stopFlushTimer(sessionId: string): void {
    const timer = this.flushTimers.get(sessionId);
    if (timer) { clearInterval(timer); this.flushTimers.delete(sessionId); }
  }

  async _flush(sessionId: string, channelId: string): Promise<void> {
    const entries = this.buffer.flush(sessionId);
    if (entries.length === 0) return;
    const text = entries.join('');
    const thread = getTeamsThread(sessionId);
    if (!thread) return;
    try {
      const acts = this.teamsApp.api.conversations.activities(channelId);
      if (thread.currentOutputMessageId) {
        await acts.update(thread.currentOutputMessageId, { type: 'message', text });
        this.logger.info({ ...this._logCtx(), sessionId, chars: text.length }, 'teams.flush.updated');
      } else {
        const res = await acts.reply(thread.teamsThreadId, { type: 'message', text });
        updateTeamsThreadOutputMessageId(sessionId, res.id);
        this.logger.info({ ...this._logCtx(), sessionId, messageId: res.id, chars: text.length }, 'teams.flush.posted');
      }
    } catch (err) {
      for (const entry of entries) this.buffer.enqueue(sessionId, entry);
      this.logger.warn({ ...this._logCtx(), err, sessionId }, 'teams.flush.failed: re-enqueued');
    }
  }

  _formatOpeningMessage(session: Session, repo: Repository | undefined): string {
    return [
      '**Argus Session Started**',
      '---',
      field('Repo', repo?.name ?? '(unknown)'),
      field('Path', repo?.path ? code(repo.path) : '(unknown)'),
      field('Branch', repo?.branch ? code(repo.branch) : '(unknown)'),
      field('Type', session.type),
      field('Mode', session.launchMode === 'pty' ? 'connected' : 'readonly'),
      field('Model', session.model ?? '(unknown)'),
      field('Yolo', session.yoloMode ? 'on' : 'off'),
      field('PID', session.pid != null ? String(session.pid) : '(unknown)'),
      field('Session', code(session.id)),
    ].join('\n');
  }

  _formatReconnectMessage(session: Session): string {
    return [
      '**Session Reconnected**',
      '---',
      field('Status', session.status),
      field('Session', code(session.id)),
    ].join('\n');
  }

  _formatUpdateMessage(session: Session, changes: { label: string; value: string }[]): string {
    return [
      '**Session Updated**',
      '---',
      ...changes.map(({ label, value }) => field(label, value)),
      field('Session', code(session.id)),
    ].join('\n');
  }

  _formatEndedMessage(session: Session): string {
    return [
      '**Session Ended**',
      '---',
      field('Status', session.status),
      field('Type', session.type),
      field('Ended', session.endedAt ?? new Date().toISOString()),
      field('Session', code(session.id)),
    ].join('\n');
  }
}
