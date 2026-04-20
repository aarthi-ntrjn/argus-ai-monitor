import { randomUUID } from 'crypto';
import type { Logger, LogFn } from 'pino';
import type { App } from '@microsoft/teams.apps';
import { MessageActivity } from '@microsoft/teams.api';
import { AdaptiveCard, TextBlock, ExecuteAction } from '@microsoft/teams.cards';
import type { Session, SessionOutput } from '../../models/index.js';
import { loadTeamsConfig } from '../../config/teams-config-loader.js';
import { getTeamsThread, upsertTeamsThread, deleteTeamsThread, getRepository } from '../../db/database.js';
import type { Repository, NotificationIntegration } from '../../models/index.js';
import type { PendingChoice } from '../../services/pending-choice-events.js';
import { MessageQueue } from '../../services/message-queue.js';
import { SessionDiffTracker } from '../../services/session-diff-tracker.js';
import type { SessionChange } from '../../services/session-diff-tracker.js';

export type TeamsLogger = Logger & { teams: LogFn };

function field(label: string, value: string): string {
  return `**${label}:** ${value}`;
}

function code(value: string): string {
  return `\`${value}\``;
}

export class TeamsNotifier implements NotificationIntegration {
  private readonly diffTracker = new SessionDiffTracker();
  private active = false;
  private readonly queue: MessageQueue;

  constructor(
    private readonly teamsApp: App,
    private readonly logger: TeamsLogger,
  ) {
    this.queue = new MessageQueue((eventType, sessionId) => {
      this.logger.warn({ ...this._logCtx(), eventType, sessionId }, 'teams: send queue full, dropping oldest message');
    });
  }

  async initialize(): Promise<boolean> {
    if (!this.isConfigured()) {
      const config = loadTeamsConfig();
      this.logger.info({ enabled: config.enabled, hasTeamId: Boolean(config.teamId), hasChannelId: Boolean(config.channelId), hasOwner: Boolean(config.ownerAadObjectId) }, 'teams: not configured, skipping event subscriptions');
      return false;
    }
    this.active = true;
    this.logger.info({}, 'teams: configured, subscribing to session events');
    return true;
  }

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

  private _sessionCtx(session: Session): Record<string, string | undefined> {
    return { ...this._logCtx(), sessionId: session.id, sessionType: session.type };
  }

  async onSessionCreated(session: Session): Promise<void> {
    this.logger.teams({ ...this._sessionCtx(session), status: session.status }, 'teams.session.created.received');
    if (!this.active) return;
    const config = loadTeamsConfig();
    if (!this.isConfigured()) {
      this.logger.warn({ ...this._sessionCtx(session), enabled: config.enabled, hasTeamId: Boolean(config.teamId), hasChannelId: Boolean(config.channelId), hasOwner: Boolean(config.ownerAadObjectId) }, 'teams.session.created.skipped: not configured');
      return;
    }
    const { channelId } = config as { channelId: string };

    const existing = getTeamsThread(session.id);
    if (existing) {
      this.logger.teams({ ...this._sessionCtx(session), teamsThreadId: existing.teamsThreadId }, 'teams.thread.reused');
      this.diffTracker.seed(session);
      this.queue.enqueue(async () => {
        try {
          const threadConvId = `${channelId};messageid=${existing.teamsThreadId}`;
          await this.teamsApp.api.conversations.activities(threadConvId).create(this._buildReconnectMessage(session));
          this.logger.teams({ ...this._sessionCtx(session), teamsThreadId: existing.teamsThreadId }, 'teams.thread.reused.notified');
        } catch (err) {
          if (isTeamsThreadNotFound(err)) {
            // Stale anchor: the parent message was deleted. Clear the row and create a new thread.
            this.logger.warn({ ...this._sessionCtx(session) }, 'teams.thread.stale.detected');
            deleteTeamsThread(session.id);
            const repo = getRepository(session.repositoryId);
            try {
              const sent = await this.teamsApp.send(channelId, this._buildOpeningMessage(session, repo));
              upsertTeamsThread({
                id: randomUUID(),
                sessionId: session.id,
                teamsThreadId: sent.id,
                teamsChannelId: channelId,
                tenantId: process.env.TENANT_ID ?? '',
                createdAt: new Date().toISOString(),
              });
              this.diffTracker.seed(session);
              this.logger.teams({ ...this._sessionCtx(session), teamsThreadId: sent.id }, 'teams.thread.stale.recovered');
            } catch (retryErr) {
              this.logger.error({ ...this._sessionCtx(session), err: retryErr }, 'teams.thread.stale.recover.failed');
            }
          } else {
            this.logger.warn({ ...this._sessionCtx(session), err }, 'teams.thread.reused.notify.failed');
          }
        }
      }, 'session.created', session.id);
      return;
    }

    const repo = getRepository(session.repositoryId);
    this.logger.teams({ ...this._sessionCtx(session), repositoryId: session.repositoryId, repoName: repo?.name }, 'teams.thread.creating');
    this.queue.enqueue(async () => {
      try {
        const sent = await this.teamsApp.send(channelId, this._buildOpeningMessage(session, repo));
        this.logger.teams({ ...this._sessionCtx(session), sentId: sent?.id, sentKeys: sent ? Object.keys(sent) : [] }, 'teams.thread.send.response');
        upsertTeamsThread({
          id: randomUUID(),
          sessionId: session.id,
          teamsThreadId: sent.id,
          teamsChannelId: channelId,
          tenantId: process.env.TENANT_ID ?? '',
          createdAt: new Date().toISOString(),
        });
        const stored = getTeamsThread(session.id);
        this.logger.teams({ ...this._sessionCtx(session), teamsThreadId: sent.id, storedThreadId: stored?.teamsThreadId, stored: !!stored }, 'teams.thread.created');
        this.diffTracker.seed(session);
      } catch (err) {
        this.logger.error({ ...this._sessionCtx(session), err }, 'teams.thread.create.failed');
      }
    }, 'session.created', session.id);
  }

  async onSessionUpdated(session: Session): Promise<void> {
    this.logger.teams({ ...this._sessionCtx(session), status: session.status, model: session.model, pid: session.pid }, 'teams.session.updated.received');
    if (!this.active) return;
    if (!this.isConfigured()) {
      this.logger.warn({ ...this._sessionCtx(session) }, 'teams.session.updated.skipped: not configured');
      return;
    }

    const thread = getTeamsThread(session.id);
    this.logger.teams({ ...this._sessionCtx(session), threadFound: !!thread, teamsThreadId: thread?.teamsThreadId }, 'teams.session.updated.thread-lookup');
    if (!thread) {
      this.logger.teams({ ...this._sessionCtx(session) }, 'teams.session.updated: no thread, delegating to onSessionCreated');
      await this.onSessionCreated(session);
      return;
    }

    const changes = this.diffTracker.update(session);
    if (changes === null) {
      this.logger.teams({ ...this._sessionCtx(session) }, 'teams.session.updated.skipped: no baseline, recording current state');
      return;
    }
    if (changes.length === 0) {
      this.logger.teams({ ...this._sessionCtx(session) }, 'teams.session.updated.skipped: no meaningful changes');
      return;
    }

    this.logger.teams({ ...this._sessionCtx(session), changes: changes.map(c => c.label) }, 'teams.session.updated.posting');

    const config = loadTeamsConfig();
    const { channelId } = config as { channelId: string };
    const activity = this._buildUpdateMessage(session, changes);

    this.queue.enqueue(async () => {
      try {
        const threadConvId = `${channelId};messageid=${thread.teamsThreadId}`;
        await this.teamsApp.api.conversations.activities(threadConvId).create(activity);
        this.logger.teams({ ...this._sessionCtx(session), changes: changes.map(c => c.label) }, 'teams.session.updated.posted');
      } catch (err) {
        this.logger.error({ ...this._sessionCtx(session), err }, 'teams.session.update.notify.failed');
      }
    }, 'session.updated', session.id);
  }

  async onSessionOutput(sessionId: string, outputs: SessionOutput[]): Promise<void> {
    if (!this.active) return;
    const config = loadTeamsConfig();
    if (!config.enabled) {
      this.logger.teams({ sessionId }, 'teams.session.output.skipped: not enabled');
      return;
    }
    const relevant = outputs.filter(o => o.type === 'message' && o.content.trim() && !o.isMeta &&
      (o.role === 'assistant' || o.role === 'user'));
    if (relevant.length === 0) return;
    const text = relevant.map(o =>
      o.role === 'user' ? `**You said:** ${o.content}` : o.content
    ).join('\n\n');
    const { channelId } = config as { channelId: string };

    this.queue.enqueue(async () => {
      const thread = getTeamsThread(sessionId);
      if (!thread) return;
      try {
        const threadConvId = `${channelId};messageid=${thread.teamsThreadId}`;
        await this.teamsApp.api.conversations.activities(threadConvId).create(new MessageActivity(text));
        this.logger.teams({ ...this._logCtx(), sessionId, chars: text.length }, 'teams.session.output.posted');
      } catch (err) {
        this.logger.error({ ...this._logCtx(), err, sessionId }, 'teams.session.output.failed');
      }
    }, 'session.output', sessionId);
  }

  async onPendingChoice(choice: PendingChoice): Promise<void> {
    if (!this.active) return;
    const config = loadTeamsConfig();
    if (!config.enabled) return;
    const { channelId } = config as { channelId: string };

    const thread = getTeamsThread(choice.sessionId);
    if (!thread) return;

    const activity = this._buildPendingChoiceMessage(choice);
    this.queue.enqueue(async () => {
      try {
        const threadConvId = `${channelId};messageid=${thread.teamsThreadId}`;
        await this.teamsApp.api.conversations.activities(threadConvId).create(activity);
        this.logger.teams({ ...this._logCtx(), sessionId: choice.sessionId }, 'teams.pending_choice.posted');
      } catch (err) {
        this.logger.error({ ...this._logCtx(), err, sessionId: choice.sessionId }, 'teams.pending_choice.failed');
      }
    }, 'session.pending_choice', choice.sessionId);
  }

  async onSessionEnded(session: Session): Promise<void> {
    this.logger.teams({ ...this._sessionCtx(session), status: session.status }, 'teams.session.ended.received');
    if (!this.active) return;
    const config = loadTeamsConfig();
    if (!this.isConfigured()) {
      this.logger.warn({ ...this._sessionCtx(session) }, 'teams.session.ended.skipped: not configured');
      return;
    }
    const { channelId } = config as { channelId: string };

    const thread = getTeamsThread(session.id);
    this.logger.teams({ ...this._sessionCtx(session), threadFound: !!thread, teamsThreadId: thread?.teamsThreadId }, 'teams.session.ended.thread-lookup');
    if (!thread) {
      this.logger.warn({ ...this._sessionCtx(session) }, 'teams.session.ended.skipped: no thread');
      return;
    }

    const activity = this._buildEndedMessage(session);
    this.queue.enqueue(async () => {
      try {
        const threadConvId = `${channelId};messageid=${thread.teamsThreadId}`;
        await this.teamsApp.api.conversations.activities(threadConvId).create(activity);
        deleteTeamsThread(session.id);
        this.diffTracker.clear(session.id);
        this.logger.teams({ ...this._sessionCtx(session), status: session.status }, 'teams.session.ended');
      } catch (err) {
        this.logger.error({ ...this._sessionCtx(session), err }, 'teams.session.end.notify.failed');
      }
    }, 'session.ended', session.id);
  }

  get isRunning(): boolean {
    return this.active;
  }

  shutdown(): void {
    this.active = false;
    this.queue.drain();
  }

  _buildOpeningMessage(session: Session, repo: Repository | undefined): MessageActivity {
    const text = [
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
    return new MessageActivity(text);
  }

  _buildReconnectMessage(session: Session): MessageActivity {
    const text = [
      '**Session Reconnected**',
      '---',
      field('Status', session.status),
      field('Session', code(session.id)),
    ].join('\n');
    return new MessageActivity(text);
  }

  _buildUpdateMessage(_session: Session, changes: SessionChange[]): MessageActivity {
    const text = [
      '**Session Updated**',
      '---',
      ...changes.map(({ label, to }) => field(label, to)),
    ].join('\n');
    return new MessageActivity(text);
  }

  _buildPendingChoiceMessage(choice: PendingChoice): MessageActivity {
    const card = new AdaptiveCard(
      new TextBlock('Action Required', { size: 'Medium', weight: 'Bolder' }),
      new TextBlock(choice.question, { wrap: true }),
    );

    if (choice.choices.length > 0) {
      card.withActions(
        ...choice.choices.map((c, i) =>
          new ExecuteAction({ title: c })
            .withData({ action: 'pending_choice', sessionId: choice.sessionId, choiceIndex: i, choiceText: c })
            .withStyle('positive')
        ),
      );
    }

    const fallbackText = [
      '**Action Required**',
      '---',
      field('Question', choice.question),
      ...(choice.choices.length > 0
        ? ['**Options:**', ...choice.choices.map((c, i) => `${i + 1}. ${c}`)]
        : []),
    ].join('\n');

    return new MessageActivity(fallbackText)
      .addCard('adaptive', card);
  }

  _buildEndedMessage(session: Session): MessageActivity {
    const text = [
      '**Session Ended**',
      '---',
      field('Status', session.status),
      field('Ended', session.endedAt ?? new Date().toISOString()),
    ].join('\n');
    return new MessageActivity(text);
  }
}

function isTeamsThreadNotFound(err: unknown): boolean {
  const status = (err as any)?.statusCode ?? (err as any)?.status ?? (err as any)?.response?.status;
  if (status === 404) return true;
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return msg.includes('not found') || msg.includes('404') || msg.includes('does not exist');
  }
  return false;
}
