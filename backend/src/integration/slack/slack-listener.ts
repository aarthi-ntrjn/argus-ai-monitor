import { SocketModeClient } from '@slack/socket-mode';
import { WebClient } from '@slack/web-api';
import type { SlackConfig, NotificationListener } from '../../models/index.js';
import { getSessions, getSession } from '../../db/database.js';
import { SessionController } from '../../services/session-controller.js';
import type { SlackNotifier } from './slack-notifier.js';
import * as logger from '../../utils/logger.js';

const LOG_TAG = '[SlackListener]';

const SUPPORTED_COMMANDS = ['sessions', 'session', 'status', 'help'];

export class SlackListener implements NotificationListener {
  private readonly config: SlackConfig;
  private readonly webClient: WebClient;
  private readonly notifier: SlackNotifier;
  private readonly sessionController: SessionController;
  private socketClient: SocketModeClient | null = null;

  get isRunning(): boolean {
    return this.socketClient !== null;
  }

  constructor(config: SlackConfig, webClient: WebClient, notifier: SlackNotifier) {
    this.config = config;
    this.webClient = webClient;
    this.notifier = notifier;
    this.sessionController = new SessionController();
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  async initialize(): Promise<boolean> {
    if (this.socketClient) {
      logger.info(`${LOG_TAG} Already running, skipping re-initialize`);
      return true;
    }
    if (!this.config.appToken) {
      logger.info(`${LOG_TAG} Socket Mode disabled: SLACK_APP_TOKEN not configured (inbound routing unavailable)`);
      return false;
    }

    this.socketClient = new SocketModeClient({ appToken: this.config.appToken });

    this.socketClient.on('app_mention', async ({ event, ack }: { event: AppMentionEvent; ack: () => Promise<void> }) => {
      await ack();
      // Skip DMs: the 'message' handler covers those, avoid double-processing
      if (event.channel.startsWith('D')) return;
      await this.handleIncoming(event.text, event.channel, event.ts, event.user, event.thread_ts);
    });

    this.socketClient.on('message', async ({ event, ack }: { event: MessageEvent & { channel_type?: string }; ack: () => Promise<void> }) => {
      await ack();
      // Only handle direct messages (channel type 'im')
      if (event.channel_type !== 'im') return;
      await this.handleIncoming(event.text ?? '', event.channel, event.ts, event.user, event.thread_ts);
    });

    this.socketClient.start().then(() => {
      logger.info(`${LOG_TAG} Socket Mode connected, listening for app mentions and DMs`);
    }).catch((err: unknown) => {
      logger.error(`${LOG_TAG} Failed to start Socket Mode client:`, err);
    });
    return true;
  }

  shutdown(): void {
    if (this.socketClient) {
      this.socketClient.disconnect().catch((err: unknown) => {
        logger.error(`${LOG_TAG} Error during disconnect:`, err);
      });
      this.socketClient = null;
      logger.info(`${LOG_TAG} Disconnected`);
    }
  }

  // -------------------------------------------------------------------------
  // Message handling
  // -------------------------------------------------------------------------

  private async handleIncoming(text: string, channel: string, messageTs: string, userId: string | undefined, parentThreadTs?: string): Promise<void> {
    try {
      logger.info(`${LOG_TAG} Incoming message: channel=${channel} ts=${messageTs} thread_ts=${parentThreadTs ?? 'none'} userId=${userId ?? 'unknown'} text=${JSON.stringify(text)}`);

      if (!userId || userId !== this.config.ownerSenderId) {
        logger.info(`${LOG_TAG} Rejected message from non-owner userId=${userId ?? 'unknown'}`);
        return;
      }

      const replyThreadTs = parentThreadTs ?? messageTs;
      const blocks = await this.handleArgusQuery(text, parentThreadTs);
      if (blocks.length > 0) {
        await this.webClient.chat.postMessage({ channel, blocks, thread_ts: replyThreadTs, text: 'Argus response' });
      }
    } catch (err) {
      logger.error(`${LOG_TAG} Failed to handle incoming message:`, err);
    }
  }

  // T020: route parsed query to response blocks
  async handleArgusQuery(text: string, parentThreadTs?: string): Promise<Block[]> {
    const cleanText = text.replace(/<@[A-Z0-9]+>/g, '').trim();
    const normalized = cleanText.toLowerCase();

    if (/^sessions?\s*$/.test(normalized)) {
      return this.buildSessionListBlocks();
    }

    const statusMatch = /^status\s+(\S+)/.exec(normalized);
    if (statusMatch) {
      return this.buildSessionStatusBlocks(statusMatch[1]);
    }

    if (/^help\s*$/.test(normalized)) {
      return this.buildHelpBlocks();
    }

    // Anything else is sent as a prompt to the session in this thread
    return this.buildSendPromptBlocks(cleanText, parentThreadTs);
  }

  private buildSessionListBlocks(): Block[] {
    const active = [
      ...getSessions({ status: 'active' }),
      ...getSessions({ status: 'idle' }),
      ...getSessions({ status: 'waiting' }),
    ];

    if (active.length === 0) {
      return [{
        type: 'section',
        text: { type: 'mrkdwn', text: '*No active sessions* at this time.' },
      }];
    }

    const rows = active.map((s) =>
      `*${s.id.slice(0, 8)}...* | ${s.type} | ${s.model ?? 'unknown'} | ${s.status}`
    ).join('\n');

    return [
      { type: 'header', text: { type: 'plain_text', text: `Active Sessions (${active.length})`, emoji: false } },
      { type: 'section', text: { type: 'mrkdwn', text: rows } },
    ];
  }

  private buildSessionStatusBlocks(sessionId: string): Block[] {
    const session = getSession(sessionId) ?? getSessions({ status: 'active' }).find((s) => s.id.startsWith(sessionId));
    if (!session) {
      return [{
        type: 'section',
        text: { type: 'mrkdwn', text: `No session found matching \`${sessionId}\`` },
      }];
    }
    return [
      { type: 'header', text: { type: 'plain_text', text: 'Session Status', emoji: false } },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*ID:*\n\`${session.id}\`` },
          { type: 'mrkdwn', text: `*Type:*\n${session.type}` },
          { type: 'mrkdwn', text: `*Status:*\n${session.status}` },
          { type: 'mrkdwn', text: `*Model:*\n${session.model ?? 'unknown'}` },
          { type: 'mrkdwn', text: `*Started:*\n${session.startedAt}` },
        ],
      },
    ];
  }

  private async buildSendPromptBlocks(prompt: string, parentThreadTs?: string): Promise<Block[]> {
    if (!parentThreadTs) {
      return [{
        type: 'section',
        text: { type: 'mrkdwn', text: ':warning: This message must be sent inside a session thread.' },
      }];
    }

    const sessionId = this.notifier.getSessionIdByThreadTs(parentThreadTs);
    if (!sessionId) {
      return [{
        type: 'section',
        text: { type: 'mrkdwn', text: ':warning: Could not find an active session for this thread.' },
      }];
    }

    const session = getSession(sessionId);
    if (!session) {
      return [{
        type: 'section',
        text: { type: 'mrkdwn', text: `:warning: Session \`${sessionId}\` no longer exists.` },
      }];
    }

    logger.info(`${LOG_TAG} Sending prompt to session ${sessionId}: ${JSON.stringify(prompt)}`);
    const action = await this.sessionController.sendPrompt(sessionId, prompt);

    if (action.status === 'failed') {
      return [{
        type: 'section',
        text: { type: 'mrkdwn', text: `:x: Failed to send prompt to \`${sessionId}\`: ${action.result ?? 'unknown error'}` },
      }];
    }

    return [];
  }

  private buildHelpBlocks(): Block[] {
    return [
      { type: 'header', text: { type: 'plain_text', text: 'Argus Bot Help', emoji: false } },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: [
            '`sessions` - List all active AI sessions',
            '`status <sessionId>` - Show details for a specific session',
            '`help` - Show this help message',
            '_Anything else is sent as a prompt to the session in this thread._',
          ].join('\n'),
        },
      },
    ];
  }
}

// -------------------------------------------------------------------------
// Minimal local types for Socket Mode event shapes
// -------------------------------------------------------------------------

interface AppMentionEvent {
  text: string;
  channel: string;
  ts: string;
  user: string;
  thread_ts?: string;
}

interface MessageEvent {
  text?: string;
  channel: string;
  ts: string;
  user?: string;
  thread_ts?: string;
}

interface Block {
  type: string;
  [key: string]: unknown;
}
