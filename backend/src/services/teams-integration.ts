import { randomUUID } from 'crypto';
import type { Logger } from 'pino';
import type { Session, SessionOutput, TeamsConfig } from '../models/index.js';
import { loadTeamsConfig } from '../config/teams-config-loader.js';
import { getTeamsThread, upsertTeamsThread, updateTeamsThreadOutputMessageId } from '../db/database.js';
import type { TeamsApiClient } from './teams-api-client.js';
import type { TeamsMessageBuffer } from './teams-message-buffer.js';

export class TeamsIntegrationService {
  private flushTimers = new Map<string, ReturnType<typeof setInterval>>();

  constructor(
    private readonly apiClient: TeamsApiClient,
    private readonly buffer: TeamsMessageBuffer,
    private readonly logger: Logger,
  ) {}

  async onSessionCreated(session: Session): Promise<void> {
    const config = loadTeamsConfig();
    if (!config.enabled || !config.botAppId) return;

    const existing = getTeamsThread(session.id);
    if (existing) {
      this.logger.info({ sessionId: session.id, teamsThreadId: existing.teamsThreadId }, 'teams.thread.reused');
      this._startFlushTimer(session.id, config as TeamsConfig);
      return;
    }

    const openingText = this._formatOpeningMessage(session, config.ownerTeamsUserId ?? '');
    try {
      const { threadId } = await this.apiClient.createThread(config as TeamsConfig, openingText);
      upsertTeamsThread({
        id: randomUUID(),
        sessionId: session.id,
        teamsThreadId: threadId,
        teamsChannelId: config.channelId ?? '',
        currentOutputMessageId: null,
        createdAt: new Date().toISOString(),
      });
      this.logger.info({ sessionId: session.id, teamsThreadId: threadId }, 'teams.thread.created');
      this._startFlushTimer(session.id, config as TeamsConfig);
    } catch (err) {
      this.logger.error({ err, sessionId: session.id }, 'teams.thread.create.failed');
    }
  }

  onSessionOutput(sessionId: string, outputs: SessionOutput[]): void {
    const config = loadTeamsConfig();
    if (!config.enabled) return;
    for (const output of outputs) {
      const text = output.content;
      if (!text.trim()) continue;
      this.buffer.enqueue(sessionId, text);
    }
  }

  async onSessionEnded(session: Session): Promise<void> {
    const config = loadTeamsConfig();
    if (!config.enabled) return;
    await this._flush(session.id, config as TeamsConfig);
    this._stopFlushTimer(session.id);
    const thread = getTeamsThread(session.id);
    if (!thread) return;
    const statusMsg = `Session ended, status: **${session.status}** at ${session.endedAt ?? new Date().toISOString()}`;
    try {
      await this.apiClient.postReply(config as TeamsConfig, thread.teamsThreadId, statusMsg);
      this.logger.info({ sessionId: session.id, status: session.status }, 'teams.session.ended');
    } catch (err) {
      this.logger.error({ err, sessionId: session.id }, 'teams.session.end.notify.failed');
    }
  }

  stop(): void {
    for (const [sessionId] of this.flushTimers) {
      this._stopFlushTimer(sessionId);
    }
  }

  private _startFlushTimer(sessionId: string, config: TeamsConfig): void {
    if (this.flushTimers.has(sessionId)) return;
    const timer = setInterval(() => this._flush(sessionId, config), 3000);
    this.flushTimers.set(sessionId, timer);
  }

  private _stopFlushTimer(sessionId: string): void {
    const timer = this.flushTimers.get(sessionId);
    if (timer) { clearInterval(timer); this.flushTimers.delete(sessionId); }
  }

  async _flush(sessionId: string, config: TeamsConfig): Promise<void> {
    const entries = this.buffer.flush(sessionId);
    if (entries.length === 0) return;
    const text = entries.join('');
    const thread = getTeamsThread(sessionId);
    if (!thread) return;
    try {
      if (thread.currentOutputMessageId) {
        await this.apiClient.updateMessage(config, thread.teamsThreadId, thread.currentOutputMessageId, text);
      } else {
        const { messageId } = await this.apiClient.postReply(config, thread.teamsThreadId, text);
        updateTeamsThreadOutputMessageId(sessionId, messageId);
      }
    } catch (err) {
      for (const entry of entries) this.buffer.enqueue(sessionId, entry);
      this.logger.warn({ err, sessionId }, 'teams.flush.failed: re-enqueued');
    }
  }

  private _formatOpeningMessage(session: Session, ownerTeamsUserId: string): string {
    return [
      `**Argus Session Started**`,
      `Session ID: ${session.id}`,
      `Type: ${session.type}`,
      `Started: ${session.startedAt}`,
      `Owner (Teams ID): ${ownerTeamsUserId}`,
    ].join('\n');
  }
}
