import { randomUUID } from 'crypto';
import type { Logger } from 'pino';
import type { App } from '@microsoft/teams.apps';
import type { Session, SessionOutput } from '../models/index.js';
import { loadTeamsConfig } from '../config/teams-config-loader.js';
import { getTeamsThread, upsertTeamsThread, updateTeamsThreadOutputMessageId } from '../db/database.js';
import type { TeamsMessageBuffer } from './teams-message-buffer.js';

export class TeamsIntegrationService {
  private flushTimers = new Map<string, ReturnType<typeof setInterval>>();

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
    const config = loadTeamsConfig();
    if (!this.isConfigured()) return;
    const { channelId } = config as { channelId: string };

    const existing = getTeamsThread(session.id);
    if (existing) {
      this.logger.info({ ...this._logCtx(), sessionId: session.id, teamsThreadId: existing.teamsThreadId }, 'teams.thread.reused');
      this._startFlushTimer(session.id, channelId);
      return;
    }

    const openingText = this._formatOpeningMessage(session, config.ownerAadObjectId!);
    try {
      const sent = await this.teamsApp.send(channelId, { type: 'message', text: openingText });
      upsertTeamsThread({
        id: randomUUID(),
        sessionId: session.id,
        teamsThreadId: sent.id,
        teamsChannelId: channelId,
        currentOutputMessageId: null,
        deltaLink: null,
        createdAt: new Date().toISOString(),
      });
      this.logger.info({ ...this._logCtx(), sessionId: session.id, teamsThreadId: sent.id }, 'teams.thread.created');
      this._startFlushTimer(session.id, channelId);
    } catch (err) {
      this.logger.error({ ...this._logCtx(), err, sessionId: session.id }, 'teams.thread.create.failed');
    }
  }

  onSessionOutput(sessionId: string, outputs: SessionOutput[]): void {
    const config = loadTeamsConfig();
    if (!config.enabled) return;
    for (const output of outputs) {
      if (!output.content.trim()) continue;
      this.buffer.enqueue(sessionId, output.content);
    }
  }

  async onSessionEnded(session: Session): Promise<void> {
    const config = loadTeamsConfig();
    if (!this.isConfigured()) return;
    const { channelId } = config as { channelId: string };

    await this._flush(session.id, channelId);
    this._stopFlushTimer(session.id);

    const thread = getTeamsThread(session.id);
    if (!thread) return;

    const endedAt = session.endedAt ?? new Date().toISOString();
    const statusMsg = `Session Ended\nType: ${session.type}\nSession ID: ${session.id}\nStatus: ${session.status}\nEnded: ${endedAt}`;
    try {
      await this.teamsApp.api.conversations.activities(channelId).reply(thread.teamsThreadId, { type: 'message', text: statusMsg });
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

  _formatOpeningMessage(session: Session, ownerAadObjectId: string): string {
    return [
      'Argus Session Started',
      `Session ID: ${session.id}`,
      `Type: ${session.type}`,
      `Started: ${session.startedAt}`,
      `Owner: ${ownerAadObjectId}`,
    ].join('\n');
  }
}
