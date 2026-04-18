import { WebClient } from '@slack/web-api';
import type { SessionMonitor } from '../../services/session-monitor.js';
import type { Session, Repository, SlackConfig, SessionOutput, NotificationIntegration } from '../../models/index.js';
import { randomUUID } from 'crypto';
import { getRepository, getSlackThread, getSlackThreadByTs, upsertSlackThread, deleteSlackThread } from '../../db/database.js';
import { MessageQueue } from '../../services/message-queue.js';
import { SessionDiffTracker } from '../../services/session-diff-tracker.js';
import type { SessionChange } from '../../services/session-diff-tracker.js';
import { outputEvents } from '../../services/output-store.js';
import { pendingChoiceEvents } from '../../services/pending-choice-events.js';
import type { PendingChoice } from '../../services/pending-choice-events.js';
import {
  SESSION_CREATED,
  SESSION_UPDATED,
  SESSION_ENDED,
  SESSION_AI_RESPONSE,
  SESSION_PENDING_CHOICE,
  REPOSITORY_ADDED,
  REPOSITORY_REMOVED,
} from '../../constants/slack-events.js';
import * as logger from '../../utils/logger.js';

const LOG_TAG = '[SlackNotifier]';

export class SlackNotifier implements NotificationIntegration {
  private config: SlackConfig;
  private readonly sessionMonitor: SessionMonitor;
  private client: WebClient | null = null;
  private active = false;
  private workspaceId = '';

  // Thread anchor map: sessionId -> Slack message ts of the parent message
  private readonly threadAnchors = new Map<string, string>();

  private readonly diffTracker = new SessionDiffTracker();
  private readonly queue: MessageQueue;
  private subscribed = false;

  constructor(config: SlackConfig, sessionMonitor: SessionMonitor) {
    this.config = { ...config };
    this.sessionMonitor = sessionMonitor;
    this.queue = new MessageQueue((eventType, sessionId) => {
      logger.warn(`${LOG_TAG} Send queue full, dropping ${eventType} for session ${sessionId}`);
    });
  }

  get isRunning(): boolean {
    return this.active;
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  async initialize(): Promise<boolean> {
    this.active = false;
    if (!this.config.botToken || !this.config.channelId) {
      logger.warn(`${LOG_TAG} Slack integration disabled: missing botToken or channelId`);
      return false;
    }
    if (!this.config.enabled) {
      logger.info(`${LOG_TAG} Slack integration disabled by configuration`);
      return false;
    }

    this.client = new WebClient(this.config.botToken);

    try {
      const auth = await this.client.auth.test();
      this.workspaceId = (auth.team_id as string | undefined) ?? '';
      logger.info(`${LOG_TAG} Workspace ID: ${this.workspaceId}`);
    } catch (err) {
      logger.warn(`${LOG_TAG} Failed to fetch workspace ID via auth.test:`, err);
    }

    this.active = true;
    this.subscribeToEvents();
    logger.info(`${LOG_TAG} Initialized, posting to channel ${this.config.channelId}`);
    return true;
  }

  shutdown(): void {
    this.active = false;
    this.client = null;
    this.queue.drain();
    logger.info(`${LOG_TAG} Shutdown complete`);
  }

  get webClient(): WebClient | null {
    return this.client;
  }

  getSessionIdByThreadTs(threadTs: string): string | undefined {
    for (const [sessionId, ts] of this.threadAnchors) {
      if (ts === threadTs) return sessionId;
    }
    // Fall back to DB for sessions not yet loaded into the in-memory map
    const thread = getSlackThreadByTs(threadTs);
    if (thread) {
      this.threadAnchors.set(thread.sessionId, threadTs); // warm the cache
      return thread.sessionId;
    }
    return undefined;
  }

  // -------------------------------------------------------------------------
  // Session lifecycle
  // -------------------------------------------------------------------------

  async onSessionCreated(session: Session): Promise<void> {
    if (!this.active || !this.client) return;
    if (!this.isEventEnabled(SESSION_CREATED)) return;

    const repo = session.repositoryId ? getRepository(session.repositoryId) : undefined;
    const blocks = buildSessionStartBlocks(session, repo);

    // Restore a persisted thread anchor (e.g. after server restart)
    const existingThreadTs = this.threadAnchors.get(session.id) ?? getSlackThread(session.id)?.slackThreadTs ?? null;
    if (existingThreadTs) {
      this.threadAnchors.set(session.id, existingThreadTs);
    }

    this.queue.enqueue(async () => {
      try {
        const threadTs = this.threadAnchors.get(session.id);
        const result = await this.client!.chat.postMessage({
          channel: this.config.channelId,
          text: `AI session started: ${session.id} (${session.type})`,
          blocks,
          ...(threadTs ? { thread_ts: threadTs } : {}),
        });
        if (result.ts) {
          // Update anchor when: (a) no prior anchor (new session), or (b) we tried to thread
          // but the message landed as a new top-level post because the parent was deleted
          // (stale anchor after channel cleanup). In case (b), Slack returns success but the
          // message's thread_ts equals its own ts, indicating it became a new thread root.
          const resultThreadTs = (result.message as any)?.thread_ts as string | undefined;
          const isNewTopLevel = !threadTs || !resultThreadTs || resultThreadTs === result.ts;
          if (isNewTopLevel) {
            this.threadAnchors.set(session.id, result.ts);
            upsertSlackThread({ id: randomUUID(), sessionId: session.id, slackThreadTs: result.ts, slackChannelId: this.config.channelId, workspaceId: this.workspaceId, createdAt: new Date().toISOString() });
          }
          this.diffTracker.seed(session);
        }
      } catch (err) {
        if ((err as any)?.data?.error === 'message_not_found') {
          // Stale anchor: the parent message was deleted (e.g. after channel cleanup).
          // Clear the stale anchor and retry as a new top-level post.
          this.threadAnchors.delete(session.id);
          deleteSlackThread(session.id);
          try {
            const result = await this.client!.chat.postMessage({
              channel: this.config.channelId,
              text: `AI session started: ${session.id} (${session.type})`,
              blocks,
            });
            if (result.ts) {
              this.threadAnchors.set(session.id, result.ts);
              upsertSlackThread({ id: randomUUID(), sessionId: session.id, slackThreadTs: result.ts, slackChannelId: this.config.channelId, workspaceId: this.workspaceId, createdAt: new Date().toISOString() });
              this.diffTracker.seed(session);
            }
          } catch (retryErr) {
            logger.error(`${LOG_TAG} Failed to re-post session start for ${session.id} after stale anchor:`, retryErr);
          }
        } else {
          logger.error(`${LOG_TAG} Failed to post session start for ${session.id}:`, err);
        }
      }
    }, SESSION_CREATED, session.id);
  }

  async onSessionEnded(session: Session): Promise<void> {
    if (!this.active || !this.client) return;
    if (!this.isEventEnabled(SESSION_ENDED)) return;

    const threadTs = this.threadAnchors.get(session.id);
    const blocks = buildSessionEndBlocks(session);
    this.queue.enqueue(async () => {
      try {
        await this.client!.chat.postMessage({
          channel: this.config.channelId,
          text: `AI session ended: ${session.id} (${session.status})`,
          blocks,
          ...(threadTs ? { thread_ts: threadTs } : {}),
        });
        this.threadAnchors.delete(session.id);
        this.diffTracker.clear(session.id);
        deleteSlackThread(session.id);
      } catch (err) {
        logger.error(`${LOG_TAG} Failed to post session end for ${session.id}:`, err);
      }
    }, SESSION_ENDED, session.id);
  }

  async onSessionUpdated(session: Session): Promise<void> {
    if (!this.active || !this.client) return;
    if (!this.isEventEnabled(SESSION_UPDATED)) return;

    const changes = this.diffTracker.update(session);
    if (changes === null || changes.length === 0) return;

    const blocks = buildSessionUpdatedBlocks(session, changes);
    this.queue.enqueue(async () => {
      // Resolve thread anchor: check in-memory first, then fall back to DB for sessions
      // detected after server restart where the anchor was persisted but not yet loaded.
      let threadTs = this.threadAnchors.get(session.id);
      if (!threadTs) {
        const stored = getSlackThread(session.id);
        if (stored) {
          threadTs = stored.slackThreadTs;
          this.threadAnchors.set(session.id, threadTs);
        }
      }
      if (!threadTs) {
        logger.error(`${LOG_TAG} No thread anchor for ${SESSION_UPDATED} session ${session.id}, cannot post`);
        return;
      }
      try {
        await this.client!.chat.postMessage({
          channel: this.config.channelId,
          text: `Session updated: ${session.id}`,
          blocks,
          thread_ts: threadTs,
        });
      } catch (err) {
        logger.error(`${LOG_TAG} Failed to post session update for ${session.id}:`, err);
      }
    }, SESSION_UPDATED, session.id);
  }

  async onSessionOutput(sessionId: string, outputs: SessionOutput[]): Promise<void> {
    if (!this.active || !this.client) return;
    if (!this.isEventEnabled(SESSION_AI_RESPONSE)) return;

    const relevant = outputs.filter((o) => o.type === 'message' && o.content.trim() && !o.isMeta &&
      (o.role === 'assistant' || o.role === 'user'));
    if (relevant.length === 0) return;

    const text = relevant.map((o) =>
      o.role === 'user' ? `*You said:* ${o.content}` : o.content
    ).join('\n\n');
    this.queue.enqueue(async () => {
      const threadTs = this.threadAnchors.get(sessionId);
      if (!threadTs) return;
      try {
        await this.client!.chat.postMessage({
          channel: this.config.channelId,
          text,
          thread_ts: threadTs,
        });
      } catch (err) {
        logger.error(`${LOG_TAG} Failed to post AI response for session ${sessionId}:`, err);
      }
    }, SESSION_AI_RESPONSE, sessionId);
  }

  async onPendingChoice(choice: PendingChoice): Promise<void> {
    if (!this.active || !this.client) return;
    if (!this.isEventEnabled(SESSION_PENDING_CHOICE)) return;

    const blocks = buildPendingChoiceBlocks(choice);
    this.queue.enqueue(async () => {
      const threadTs = this.threadAnchors.get(choice.sessionId);
      if (!threadTs) return;
      try {
        await this.client!.chat.postMessage({
          channel: this.config.channelId,
          text: `Action required: ${choice.question}`,
          blocks,
          thread_ts: threadTs,
        });
      } catch (err) {
        logger.error(`${LOG_TAG} Failed to post pending choice for session ${choice.sessionId}:`, err);
      }
    }, SESSION_PENDING_CHOICE, choice.sessionId);
  }

  // -------------------------------------------------------------------------
  // Generic event
  // -------------------------------------------------------------------------

  async postEvent(sessionId: string, eventType: string, payload: Session | Repository): Promise<void> {
    if (!this.active || !this.client) return;
    if (!this.isEventEnabled(eventType)) return;

    const blocks = buildEventBlocks(eventType, payload);
    this.queue.enqueue(async () => {
      // Resolve thread anchor at execution time so any preceding SESSION_CREATED job in the
      // queue has already run and set the anchor before we look it up.
      const threadTs = sessionId ? this.threadAnchors.get(sessionId) : undefined;
      if (sessionId && !threadTs) {
        logger.error(`${LOG_TAG} No thread anchor for ${eventType} session ${sessionId}, cannot post`);
        return;
      }
      try {
        await this.client!.chat.postMessage({
          channel: this.config.channelId,
          text: `Argus event: ${eventType}`,
          blocks,
          ...(threadTs ? { thread_ts: threadTs } : {}),
        });
      } catch (err) {
        logger.error(`${LOG_TAG} Failed to post event ${eventType} for session ${sessionId}:`, err);
      }
    }, eventType, sessionId);
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  private isEventEnabled(eventType: string): boolean {
    if (!this.config.enabledEventTypes) return true;
    return this.config.enabledEventTypes.includes(eventType);
  }

  private subscribeToEvents(): void {
    if (this.subscribed) return;
    this.subscribed = true;
    this.sessionMonitor.on(SESSION_CREATED, (session: Session) => {
      this.onSessionCreated(session).catch((err) => {
        logger.error(`${LOG_TAG} Unhandled error in session.created handler:`, err);
      });
    });
    this.sessionMonitor.on(SESSION_ENDED, (session: Session) => {
      this.onSessionEnded(session).catch((err) => {
        logger.error(`${LOG_TAG} Unhandled error in session.ended handler:`, err);
      });
    });
    this.sessionMonitor.on(SESSION_UPDATED, (session: Session) => {
      this.onSessionUpdated(session).catch((err) => {
        logger.error(`${LOG_TAG} Unhandled error in session.updated handler:`, err);
      });
    });
    this.sessionMonitor.on(REPOSITORY_ADDED, (repo: Repository) => {
      this.postEvent('', REPOSITORY_ADDED, repo).catch((err) => {
        logger.error(`${LOG_TAG} Unhandled error in repository.added handler:`, err);
      });
    });
    this.sessionMonitor.on(REPOSITORY_REMOVED, (repo: Repository) => {
      this.postEvent('', REPOSITORY_REMOVED, repo).catch((err) => {
        logger.error(`${LOG_TAG} Unhandled error in repository.removed handler:`, err);
      });
    });
    outputEvents.on('session.output.batch', (sessionId: string, outputs: SessionOutput[]) => {
      this.onSessionOutput(sessionId, outputs).catch((err) => {
        logger.error(`${LOG_TAG} Unhandled error in session.output.batch handler:`, err);
      });
    });
    pendingChoiceEvents.on('session.pending_choice', (choice: PendingChoice) => {
      this.onPendingChoice(choice).catch((err) => {
        logger.error(`${LOG_TAG} Unhandled error in session.pending_choice handler:`, err);
      });
    });
  }

}

// -------------------------------------------------------------------------
// Block Kit builders
// -------------------------------------------------------------------------

function buildSessionStartBlocks(session: Session, repo: Repository | undefined) {
  const connected = session.launchMode === 'pty' ? 'connected' : 'not connected';
  const yolo = session.yoloMode === true ? 'yes' : session.yoloMode === false ? 'no' : 'unknown';
  const pid = session.pid != null ? `\`${session.pid}\`` : 'unknown';
  return [
    {
      type: 'header',
      text: { type: 'plain_text', text: 'AI Session Started', emoji: false },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Session:* \`${session.id}\`` },
        { type: 'mrkdwn', text: `*Type:* ${session.type}` },
        { type: 'mrkdwn', text: `*Model:* ${session.model ?? 'unknown'}` },
        { type: 'mrkdwn', text: `*Started:* ${session.startedAt}` },
        { type: 'mrkdwn', text: `*Repo:* ${repo?.name ?? 'unknown'}` },
        { type: 'mrkdwn', text: `*Branch:* ${repo?.branch ?? 'unknown'}` },
        { type: 'mrkdwn', text: `*Repo path:* ${repo?.path ?? 'unknown'}` },
        { type: 'mrkdwn', text: `*Connection:* ${connected}` },
        { type: 'mrkdwn', text: `*Yolo:* ${yolo}` },
        { type: 'mrkdwn', text: `*PID:* ${pid}` },
      ],
    },
  ];
}

function buildSessionEndBlocks(session: Session) {
  const duration = session.endedAt
    ? formatDuration(new Date(session.startedAt), new Date(session.endedAt))
    : 'unknown';
  return [
    {
      type: 'header',
      text: { type: 'plain_text', text: 'AI Session Ended', emoji: false },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Session:* \`${session.id}\`` },
        { type: 'mrkdwn', text: `*Status:* ${session.status}` },
        { type: 'mrkdwn', text: `*Duration:* ${duration}` },
        { type: 'mrkdwn', text: `*Ended:* ${session.endedAt ?? 'unknown'}` },
      ],
    },
  ];
}

function buildSessionUpdatedBlocks(session: Session, changes: SessionChange[]) {
  const lines = changes.map(({ label, from, to }) =>
    `\u2022 *${label}:* ${from} \u2192 ${to}`
  );
  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Session Updated* \`${session.id}\`\n${lines.join('\n')}`,
      },
    },
  ];
}

function buildPendingChoiceBlocks(choice: PendingChoice) {
  const optionLines = choice.choices.length > 0
    ? choice.choices.map((c, i) => `${i + 1}. ${c}`).join('\n')
    : '';
  const text = optionLines
    ? `*Action Required*\n*Question:* ${choice.question}\n*Options:*\n${optionLines}`
    : `*Action Required*\n*Question:* ${choice.question}`;
  return [
    {
      type: 'section',
      text: { type: 'mrkdwn', text },
    },
  ];
}

function buildEventBlocks(eventType: string, payload: Session | Repository) {
  const summary = ('id' in payload) ? `\`${payload.id}\`` : JSON.stringify(payload).slice(0, 120);
  return [
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*Event:* \`${eventType}\`\n*Subject:* ${summary}` },
    },
  ];
}

function formatDuration(start: Date, end: Date): string {
  const seconds = Math.floor((end.getTime() - start.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return remaining > 0 ? `${minutes}m ${remaining}s` : `${minutes}m`;
}
