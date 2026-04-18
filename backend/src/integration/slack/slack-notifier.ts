import { WebClient } from '@slack/web-api';
import type { SessionMonitor } from '../../services/session-monitor.js';
import type { Session, Repository, SlackConfig, SessionOutput, NotificationIntegration } from '../../models/index.js';
import { randomUUID } from 'crypto';
import { getRepository, getSlackThread, getSlackThreadByTs, upsertSlackThread, deleteSlackThread } from '../../db/database.js';
import { MessageQueue } from '../../services/message-queue.js';
import { outputEvents } from '../../services/output-store.js';
import {
  SESSION_CREATED,
  SESSION_UPDATED,
  SESSION_ENDED,
  SESSION_AI_RESPONSE,
  REPOSITORY_ADDED,
  REPOSITORY_REMOVED,
} from '../../constants/slack-events.js';
import * as logger from '../../utils/logger.js';

const LOG_TAG = '[SlackNotifier]';

export class SlackNotifier implements NotificationIntegration {
  private config: SlackConfig;
  private readonly sessionMonitor: SessionMonitor;
  private client: WebClient | null = null;
  private disabled = false;
  private workspaceId = '';

  // Thread anchor map: sessionId -> Slack message ts of the parent message
  private readonly threadAnchors = new Map<string, string>();

  // Previous session state for computing diffs on session.updated
  private readonly prevSessions = new Map<string, Session>();

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
    return !this.disabled;
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  async initialize(): Promise<boolean> {
    this.disabled = false;
    if (!this.config.botToken || !this.config.channelId) {
      logger.warn(`${LOG_TAG} Slack integration disabled: missing botToken or channelId`);
      this.disabled = true;
      return false;
    }
    if (!this.config.enabled) {
      logger.info(`${LOG_TAG} Slack integration disabled by configuration`);
      this.disabled = true;
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

    this.subscribeToEvents();
    logger.info(`${LOG_TAG} Initialized, posting to channel ${this.config.channelId}`);
    return true;
  }

  shutdown(): void {
    this.disabled = true;
    this.client = null;
    this.queue.drain();
    logger.info(`${LOG_TAG} Shutdown complete`);
  }

  get webClient(): WebClient | null {
    return this.client;
  }

  get isDisabled(): boolean {
    return this.disabled;
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
  // Session lifecycle (T008, T009)
  // -------------------------------------------------------------------------

  async onSessionCreated(session: Session): Promise<void> {
    if (this.disabled || !this.client) return;
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
    if (this.disabled || !this.client) return;
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
        deleteSlackThread(session.id);
      } catch (err) {
        logger.error(`${LOG_TAG} Failed to post session end for ${session.id}:`, err);
      }
    }, SESSION_ENDED, session.id);
  }

  async onSessionUpdated(session: Session): Promise<void> {
    if (this.disabled || !this.client) return;
    if (!this.isEventEnabled(SESSION_UPDATED)) return;

    const prev = this.prevSessions.get(session.id);
    const diff = prev ? diffSessions(prev, session) : null;
    this.prevSessions.set(session.id, session);

    // No previous state (e.g. server restart mid-session) or only untracked fields changed
    if (!diff || Object.keys(diff).length === 0) return;

    const blocks = buildSessionUpdatedBlocks(session, diff);
    this.queue.enqueue(async () => {
      const threadTs = this.threadAnchors.get(session.id);
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
    if (this.disabled || !this.client) return;
    if (!this.isEventEnabled(SESSION_AI_RESPONSE)) return;

    const assistantMessages = outputs.filter((o) => o.role === 'assistant' && o.type === 'message' && o.content);
    if (assistantMessages.length === 0) return;

    const text = assistantMessages.map((o) => o.content).join('\n\n');
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

  // -------------------------------------------------------------------------
  // Generic event (T012)
  // -------------------------------------------------------------------------

  async postEvent(sessionId: string, eventType: string, payload: Session | Repository): Promise<void> {
    if (this.disabled || !this.client) return;
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
    // T010, T013: subscribe to all SessionMonitor events
    this.sessionMonitor.on(SESSION_CREATED, (session: Session) => {
      this.prevSessions.set(session.id, session);
      this.onSessionCreated(session).catch((err) => {
        logger.error(`${LOG_TAG} Unhandled error in session.created handler:`, err);
      });
    });
    this.sessionMonitor.on(SESSION_ENDED, (session: Session) => {
      this.prevSessions.delete(session.id);
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

// Fields diffed for session.updated notifications. lastActivityAt is intentionally
// excluded as it changes on every scan cycle and produces noise without signal.
const TRACKED_UPDATE_FIELDS: (keyof Session)[] = ['model', 'summary', 'status', 'yoloMode'];

type SessionFieldDiff = Record<string, { from: string; to: string }>;

function diffSessions(prev: Session, curr: Session): SessionFieldDiff {
  const diff: SessionFieldDiff = {};
  for (const field of TRACKED_UPDATE_FIELDS) {
    if (prev[field] !== curr[field]) {
      diff[field] = {
        from: formatSessionFieldValue(field, prev[field]),
        to: formatSessionFieldValue(field, curr[field]),
      };
    }
  }
  return diff;
}

function formatSessionFieldValue(field: keyof Session, value: unknown): string {
  if (value == null) return 'none';
  if (field === 'yoloMode') return value ? 'yes' : 'no';
  if (field === 'summary' && typeof value === 'string' && value.length > 150) {
    return `${value.slice(0, 150)}…`;
  }
  return String(value);
}

function buildSessionUpdatedBlocks(session: Session, diff: SessionFieldDiff) {
  const lines = Object.entries(diff).map(([field, { from, to }]) =>
    `• *${field}:* ${from} → ${to}`
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
