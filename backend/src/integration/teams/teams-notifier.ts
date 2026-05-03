import { randomUUID } from 'crypto';
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
import { createTaggedLogger } from '../../utils/logger.js';

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
    private readonly log = createTaggedLogger('[TeamsNotifier]', '\x1b[36m'),
  ) {
    this.queue = new MessageQueue((eventType, sessionId) => {
      this.log.warn(`teams: send queue full, dropping ${eventType} for session ${sessionId}`);
    });
  }

  async initialize(): Promise<boolean> {
    if (!this.isConfigured()) {
      const config = loadTeamsConfig();
      this.log.info(
        { enabled: config.enabled, hasTeamId: Boolean(config.teamId), hasChannelId: Boolean(config.channelId), hasOwner: Boolean(config.ownerSenderId) },
        'teams: not configured, skipping event subscriptions',
      );
      return false;
    }
    this.active = true;
    this.log.info('teams: configured, subscribing to session events');
    return true;
  }

  private isConfigured(): boolean {
    const config = loadTeamsConfig();
    return config.enabled === true &&
      Boolean(config.teamId) &&
      Boolean(config.channelId) &&
      Boolean(config.ownerSenderId);
  }

  async onSessionCreated(session: Session): Promise<void> {
    this.log.info(`teams.session.created.received: session=${session.id} type=${session.type} status=${session.status}`);
    if (!this.active) return;
    const config = loadTeamsConfig();
    if (!this.isConfigured()) {
      this.log.warn(`teams.session.created.skipped: not configured session=${session.id}`);
      return;
    }
    const { channelId } = config as { channelId: string };

    const existing = getTeamsThread(session.id);
    if (existing) {
      this.log.info(`teams.thread.reused: session=${session.id} teamsThreadId=${existing.teamsThreadId}`);
      this.diffTracker.seed(session);
      this.queue.enqueue(async () => {
        try {
          const threadConvId = `${channelId};messageid=${existing.teamsThreadId}`;
          await this.teamsApp.api.conversations.activities(threadConvId).create(this._buildReconnectMessage(session));
          this.log.info(`teams.thread.reused.notified: session=${session.id} teamsThreadId=${existing.teamsThreadId}`);
        } catch (err) {
          if (isTeamsThreadNotFound(err)) {
            // Stale anchor: the parent message was deleted. Clear the row and create a new thread.
            this.log.warn(`teams.thread.stale.detected: session=${session.id}`);
            deleteTeamsThread(session.id);
            const repo = getRepository(session.repositoryId);
            try {
              const sent = await this.teamsApp.send(channelId, this._buildOpeningMessage(session, repo));
              upsertTeamsThread({
                id: randomUUID(),
                sessionId: session.id,
                teamsThreadId: sent.id,
                teamsChannelId: channelId,
                tenantId: loadTeamsConfig().tenantId ?? '',
                createdAt: new Date().toISOString(),
              });
              this.diffTracker.seed(session);
              this.log.info(`teams.thread.stale.recovered: session=${session.id} teamsThreadId=${sent.id}`);
            } catch (retryErr) {
              this.log.error(`teams.thread.stale.recover.failed: session=${session.id}`, retryErr);
            }
          } else {
            this.log.warn(`teams.thread.reused.notify.failed: session=${session.id}`, err);
          }
        }
      }, 'session.created', session.id);
      return;
    }

    const repo = getRepository(session.repositoryId);
    this.log.info(`teams.thread.creating: session=${session.id} repo=${repo?.name ?? '(unknown)'}`);
    this.queue.enqueue(async () => {
      try {
        const sent = await this.teamsApp.send(channelId, this._buildOpeningMessage(session, repo));
        this.log.info(`teams.thread.send.response: session=${session.id} sentId=${sent?.id}`);
        upsertTeamsThread({
          id: randomUUID(),
          sessionId: session.id,
          teamsThreadId: sent.id,
          teamsChannelId: channelId,
          tenantId: loadTeamsConfig().tenantId ?? '',
          createdAt: new Date().toISOString(),
        });
        this.log.info(`teams.thread.created: session=${session.id} teamsThreadId=${sent.id}`);
        this.diffTracker.seed(session);
      } catch (err) {
        this.log.error(`teams.thread.create.failed: session=${session.id}`, err);
      }
    }, 'session.created', session.id);
  }

  async onSessionUpdated(session: Session): Promise<void> {
    this.log.info(`teams.session.updated.received: session=${session.id} status=${session.status} model=${session.model} pid=${session.pid}`);
    if (!this.active) return;
    if (!this.isConfigured()) {
      this.log.warn(`teams.session.updated.skipped: not configured session=${session.id}`);
      return;
    }

    const thread = getTeamsThread(session.id);
    this.log.info(`teams.session.updated.thread-lookup: session=${session.id} threadFound=${!!thread} teamsThreadId=${thread?.teamsThreadId}`);
    if (!thread) {
      this.log.info(`teams.session.updated: no thread, delegating to onSessionCreated: session=${session.id}`);
      await this.onSessionCreated(session);
      return;
    }

    const changes = this.diffTracker.update(session);
    if (changes === null) {
      this.log.info(`teams.session.updated.skipped: no baseline, recording current state session=${session.id}`);
      return;
    }
    if (changes.length === 0) {
      this.log.info(`teams.session.updated.skipped: no meaningful changes session=${session.id}`);
      return;
    }

    this.log.info(`teams.session.updated.posting: session=${session.id} changes=${changes.map(c => c.label).join(',')}`);

    const config = loadTeamsConfig();
    const { channelId } = config as { channelId: string };
    const activity = this._buildUpdateMessage(session, changes);

    this.queue.enqueue(async () => {
      try {
        const threadConvId = `${channelId};messageid=${thread.teamsThreadId}`;
        await this.teamsApp.api.conversations.activities(threadConvId).create(activity);
        this.log.info(`teams.session.updated.posted: session=${session.id}`);
      } catch (err) {
        this.log.error(`teams.session.update.notify.failed: session=${session.id}`, err);
      }
    }, 'session.updated', session.id);
  }

  async onSessionOutput(sessionId: string, outputs: SessionOutput[]): Promise<void> {
    if (!this.active) return;
    const config = loadTeamsConfig();
    if (!config.enabled) return;
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
        this.log.debug(`teams.session.output.posted: session=${sessionId} chars=${text.length}`);
      } catch (err) {
        this.log.error(`teams.session.output.failed: session=${sessionId}`, err);
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
        this.log.info(`teams.pending_choice.posted: session=${choice.sessionId}`);
      } catch (err) {
        this.log.error(`teams.pending_choice.failed: session=${choice.sessionId}`, err);
      }
    }, 'session.pending_choice', choice.sessionId);
  }

  async onSessionEnded(session: Session): Promise<void> {
    this.log.info(`teams.session.ended.received: session=${session.id} status=${session.status}`);
    if (!this.active) return;
    const config = loadTeamsConfig();
    if (!this.isConfigured()) {
      this.log.warn(`teams.session.ended.skipped: not configured session=${session.id}`);
      return;
    }
    const { channelId } = config as { channelId: string };

    const thread = getTeamsThread(session.id);
    this.log.info(`teams.session.ended.thread-lookup: session=${session.id} threadFound=${!!thread} teamsThreadId=${thread?.teamsThreadId}`);
    if (!thread) {
      this.log.warn(`teams.session.ended.skipped: no thread session=${session.id}`);
      return;
    }

    const activity = this._buildEndedMessage(session);
    this.queue.enqueue(async () => {
      try {
        const threadConvId = `${channelId};messageid=${thread.teamsThreadId}`;
        await this.teamsApp.api.conversations.activities(threadConvId).create(activity);
        deleteTeamsThread(session.id);
        this.diffTracker.clear(session.id);
        this.log.info(`teams.session.ended: session=${session.id} status=${session.status}`);
      } catch (err) {
        this.log.error(`teams.session.end.notify.failed: session=${session.id}`, err);
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
