import { WebClient } from '@slack/web-api';
import type { SessionMonitor } from './session-monitor.js';
import type { Session, Repository, SlackConfig } from '../models/index.js';
import {
  SESSION_CREATED,
  SESSION_UPDATED,
  SESSION_ENDED,
  REPOSITORY_ADDED,
  REPOSITORY_REMOVED,
} from '../constants/slack-events.js';
import * as logger from '../utils/logger.js';

const LOG_TAG = '[SlackNotifier]';

interface SendJob {
  fn: () => Promise<void>;
  eventType: string;
  sessionId: string;
}

export class SlackNotifier {
  private config: SlackConfig;
  private readonly sessionMonitor: SessionMonitor;
  private client: WebClient | null = null;
  private disabled = false;

  // Thread anchor map: sessionId -> Slack message ts of the parent message
  private readonly threadAnchors = new Map<string, string>();

  // Rate-limit queue
  private readonly sendQueue: SendJob[] = [];
  private isSending = false;
  private static readonly MAX_QUEUE_DEPTH = 50;
  private static readonly MIN_SEND_INTERVAL_MS = 1100;

  constructor(config: SlackConfig, sessionMonitor: SessionMonitor) {
    this.config = { ...config };
    this.sessionMonitor = sessionMonitor;
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  initialize(): void {
    if (!this.config.botToken || !this.config.channelId) {
      logger.warn(`${LOG_TAG} Slack integration disabled: missing botToken or channelId`);
      this.disabled = true;
      return;
    }
    if (!this.config.enabled) {
      logger.info(`${LOG_TAG} Slack integration disabled by configuration`);
      this.disabled = true;
      return;
    }

    this.client = new WebClient(this.config.botToken);
    this.subscribeToEvents();
    logger.info(`${LOG_TAG} Initialized, posting to channel ${this.config.channelId}`);
  }

  shutdown(): void {
    // Drain the queue: no new messages will be enqueued after this point.
    // In-flight messages complete naturally; pending ones are dropped.
    this.sendQueue.length = 0;
    logger.info(`${LOG_TAG} Shutdown complete`);
  }

  get webClient(): WebClient | null {
    return this.client;
  }

  get isDisabled(): boolean {
    return this.disabled;
  }

  // -------------------------------------------------------------------------
  // Configuration hot-reload (T015)
  // -------------------------------------------------------------------------

  reconfigure(partial: Partial<Pick<SlackConfig, 'channelId' | 'enabledEventTypes' | 'enabled'>>): void {
    if ('channelId' in partial && partial.channelId !== undefined) {
      this.config.channelId = partial.channelId;
    }
    if ('enabledEventTypes' in partial) {
      this.config.enabledEventTypes = partial.enabledEventTypes;
    }
    if ('enabled' in partial && partial.enabled !== undefined) {
      this.config.enabled = partial.enabled;
    }
    logger.info(`${LOG_TAG} Configuration updated`, { channelId: this.config.channelId, enabled: this.config.enabled });
  }

  // -------------------------------------------------------------------------
  // Session lifecycle (T008, T009)
  // -------------------------------------------------------------------------

  async postSessionStart(session: Session): Promise<void> {
    if (this.disabled || !this.client) return;
    if (!this.isEventEnabled(SESSION_CREATED)) return;

    const blocks = buildSessionStartBlocks(session);
    this.enqueueMessage(async () => {
      try {
        const result = await this.client!.chat.postMessage({
          channel: this.config.channelId,
          text: `AI session started: ${session.id} (${session.type})`,
          blocks,
        });
        if (result.ts) {
          this.threadAnchors.set(session.id, result.ts);
        }
      } catch (err) {
        logger.error(`${LOG_TAG} Failed to post session start for ${session.id}:`, err);
      }
    }, SESSION_CREATED, session.id);
  }

  async postSessionEnd(session: Session): Promise<void> {
    if (this.disabled || !this.client) return;
    if (!this.isEventEnabled(SESSION_ENDED)) return;

    const threadTs = this.threadAnchors.get(session.id);
    const blocks = buildSessionEndBlocks(session);
    this.enqueueMessage(async () => {
      try {
        await this.client!.chat.postMessage({
          channel: this.config.channelId,
          text: `AI session ended: ${session.id} (${session.status})`,
          blocks,
          ...(threadTs ? { thread_ts: threadTs } : {}),
        });
        this.threadAnchors.delete(session.id);
      } catch (err) {
        logger.error(`${LOG_TAG} Failed to post session end for ${session.id}:`, err);
      }
    }, SESSION_ENDED, session.id);
  }

  // -------------------------------------------------------------------------
  // Generic event (T012)
  // -------------------------------------------------------------------------

  async postEvent(sessionId: string, eventType: string, payload: Session | Repository): Promise<void> {
    if (this.disabled || !this.client) return;
    if (!this.isEventEnabled(eventType)) return;

    const threadTs = sessionId ? this.threadAnchors.get(sessionId) : undefined;
    const blocks = buildEventBlocks(eventType, payload);
    this.enqueueMessage(async () => {
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
    // T010, T013: subscribe to all SessionMonitor events
    this.sessionMonitor.on(SESSION_CREATED, (session: Session) => {
      this.postSessionStart(session).catch((err) => {
        logger.error(`${LOG_TAG} Unhandled error in session.created handler:`, err);
      });
    });
    this.sessionMonitor.on(SESSION_ENDED, (session: Session) => {
      this.postSessionEnd(session).catch((err) => {
        logger.error(`${LOG_TAG} Unhandled error in session.ended handler:`, err);
      });
    });
    this.sessionMonitor.on(SESSION_UPDATED, (session: Session) => {
      this.postEvent(session.id, SESSION_UPDATED, session).catch((err) => {
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
  }

  // T014: rate-limit queue
  private enqueueMessage(fn: () => Promise<void>, eventType: string, sessionId: string): void {
    if (this.sendQueue.length >= SlackNotifier.MAX_QUEUE_DEPTH) {
      const dropped = this.sendQueue.shift()!;
      logger.warn(`${LOG_TAG} Send queue full, dropping ${dropped.eventType} for session ${dropped.sessionId}`);
    }
    this.sendQueue.push({ fn, eventType, sessionId });
    this.processSendQueue();
  }

  private processSendQueue(): void {
    if (this.isSending || this.sendQueue.length === 0) return;
    const job = this.sendQueue.shift()!;
    this.isSending = true;
    const start = Date.now();
    job.fn()
      .catch(() => { /* errors are handled inside fn() */ })
      .finally(() => {
        const elapsed = Date.now() - start;
        const delay = Math.max(0, SlackNotifier.MIN_SEND_INTERVAL_MS - elapsed);
        setTimeout(() => {
          this.isSending = false;
          this.processSendQueue();
        }, delay);
      });
  }
}

// -------------------------------------------------------------------------
// Block Kit builders
// -------------------------------------------------------------------------

function buildSessionStartBlocks(session: Session) {
  return [
    {
      type: 'header',
      text: { type: 'plain_text', text: 'AI Session Started', emoji: false },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Session:*\n\`${session.id}\`` },
        { type: 'mrkdwn', text: `*Type:*\n${session.type}` },
        { type: 'mrkdwn', text: `*Model:*\n${session.model ?? 'unknown'}` },
        { type: 'mrkdwn', text: `*Started:*\n${session.startedAt}` },
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
        { type: 'mrkdwn', text: `*Session:*\n\`${session.id}\`` },
        { type: 'mrkdwn', text: `*Status:*\n${session.status}` },
        { type: 'mrkdwn', text: `*Duration:*\n${duration}` },
        { type: 'mrkdwn', text: `*Ended:*\n${session.endedAt ?? 'unknown'}` },
      ],
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
