import { randomUUID } from 'crypto';
import type { Logger } from 'pino';
import type { Session, SessionOutput, TeamsConfig } from '../models/index.js';
import { loadTeamsConfig } from '../config/teams-config-loader.js';
import { getTeamsThread, upsertTeamsThread, updateTeamsThreadOutputMessageId } from '../db/database.js';
import type { TeamsGraphClient } from './teams-graph-client.js';
import type { TeamsBotAuthService } from './teams-bot-auth-service.js';
import type { TeamsMessageBuffer } from './teams-message-buffer.js';

export class TeamsIntegrationService {
  private flushTimers = new Map<string, ReturnType<typeof setInterval>>();

  constructor(
    private readonly graphClient: TeamsGraphClient,
    private readonly botAuthService: TeamsBotAuthService,
    private readonly buffer: TeamsMessageBuffer,
    private readonly logger: Logger,
  ) {}

  private isConfigured(config: Partial<TeamsConfig> & { enabled: boolean }): config is TeamsConfig {
    return config.enabled === true &&
      Boolean(config.botAppId) &&
      Boolean(config.tenantId) &&
      Boolean(config.teamId) &&
      Boolean(config.channelId) &&
      Boolean(config.ownerAadObjectId);
  }

  async onSessionCreated(session: Session): Promise<void> {
    const config = loadTeamsConfig();
    if (!this.isConfigured(config)) return;

    const existing = getTeamsThread(session.id);
    if (existing) {
      this.logger.info({ sessionId: session.id, teamsThreadId: existing.teamsThreadId }, 'teams.thread.reused');
      this._startFlushTimer(session.id, config);
      return;
    }

    const openingText = this._formatOpeningMessage(session, config.ownerAadObjectId);
    try {
      const accessToken = await this.botAuthService.getAccessToken(config);
      const { messageId: threadId } = await this.graphClient.createThreadPost(config.teamId, config.channelId, accessToken, openingText);
      upsertTeamsThread({
        id: randomUUID(),
        sessionId: session.id,
        teamsThreadId: threadId,
        teamsChannelId: config.channelId,
        currentOutputMessageId: null,
        deltaLink: null,
        createdAt: new Date().toISOString(),
      });
      this.logger.info({ sessionId: session.id, teamsThreadId: threadId }, 'teams.thread.created');
      this._startFlushTimer(session.id, config);
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
    if (!this.isConfigured(config)) return;
    await this._flush(session.id, config);
    this._stopFlushTimer(session.id);
    const thread = getTeamsThread(session.id);
    if (!thread) return;
    const endedAt = session.endedAt ?? new Date().toISOString();
    const statusMsg = `<b>Session Ended</b><br>Type: ${session.type}<br>Session ID: ${session.id}<br>Status: <b>${session.status}</b><br>Ended: ${endedAt}`;
    try {
      const accessToken = await this.botAuthService.getAccessToken(config);
      await this.graphClient.postReply(config.teamId, config.channelId, thread.teamsThreadId, accessToken, statusMsg);
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
      const accessToken = await this.botAuthService.getAccessToken(config);
      if (thread.currentOutputMessageId) {
        await this.graphClient.updateReply(config.teamId, config.channelId, thread.teamsThreadId, thread.currentOutputMessageId, accessToken, text);
      } else {
        const { messageId } = await this.graphClient.postReply(config.teamId, config.channelId, thread.teamsThreadId, accessToken, text);
        updateTeamsThreadOutputMessageId(sessionId, messageId);
      }
    } catch (err) {
      for (const entry of entries) this.buffer.enqueue(sessionId, entry);
      this.logger.warn({ err, sessionId }, 'teams.flush.failed: re-enqueued');
    }
  }

  _formatOpeningMessage(session: Session, ownerAadObjectId: string): string {
    return [
      `<b>Argus Session Started</b>`,
      `Session ID: ${session.id}`,
      `Type: ${session.type}`,
      `Started: ${session.startedAt}`,
      `Owner: ${ownerAadObjectId}`,
    ].join('<br>');
  }
}

