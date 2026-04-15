import { SocketModeClient } from '@slack/socket-mode';
import { WebClient } from '@slack/web-api';
import type { SlackConfig } from '../models/index.js';
import { getSessions, getSession } from '../db/database.js';
import * as logger from '../utils/logger.js';

const LOG_TAG = '[SlackListener]';

const SUPPORTED_COMMANDS = ['sessions', 'session', 'status', 'help'];

export class SlackListener {
  private readonly config: SlackConfig;
  private readonly webClient: WebClient;
  private socketClient: SocketModeClient | null = null;

  constructor(config: SlackConfig, webClient: WebClient) {
    this.config = config;
    this.webClient = webClient;
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  initialize(): void {
    if (!this.config.appToken) {
      logger.info(`${LOG_TAG} Socket Mode disabled: SLACK_APP_TOKEN not configured (inbound routing unavailable)`);
      return;
    }

    this.socketClient = new SocketModeClient({ appToken: this.config.appToken });

    this.socketClient.on('app_mention', async ({ event, say }: { event: AppMentionEvent; say: SayFn }) => {
      await this.handleIncoming(event.text, event.channel, event.ts, say);
    });

    this.socketClient.on('message', async ({ event, say }: { event: MessageEvent; say: SayFn }) => {
      // Only handle direct messages (channel type 'im')
      if ((event as MessageEvent & { channel_type?: string }).channel_type !== 'im') return;
      await this.handleIncoming(event.text ?? '', event.channel, event.ts, say);
    });

    this.socketClient.start().then(() => {
      logger.info(`${LOG_TAG} Socket Mode connected, listening for app mentions and DMs`);
    }).catch((err: unknown) => {
      logger.error(`${LOG_TAG} Failed to start Socket Mode client:`, err);
    });
  }

  shutdown(): void {
    if (this.socketClient) {
      this.socketClient.disconnect().catch((err: unknown) => {
        logger.error(`${LOG_TAG} Error during disconnect:`, err);
      });
      logger.info(`${LOG_TAG} Disconnected`);
    }
  }

  // -------------------------------------------------------------------------
  // Message handling
  // -------------------------------------------------------------------------

  private async handleIncoming(text: string, channel: string, threadTs: string, say: SayFn): Promise<void> {
    try {
      const blocks = await this.handleArgusQuery(text);
      await say({ channel, blocks, thread_ts: threadTs, text: 'Argus response' });
    } catch (err) {
      logger.error(`${LOG_TAG} Failed to handle incoming message:`, err);
    }
  }

  // T020: route parsed query to response blocks
  async handleArgusQuery(text: string): Promise<Block[]> {
    const normalized = text
      .replace(/<@[A-Z0-9]+>/g, '') // strip @mentions
      .trim()
      .toLowerCase();

    if (/^sessions?\s*$/.test(normalized)) {
      return this.buildSessionListBlocks();
    }

    const statusMatch = /^status\s+(\S+)/.exec(normalized);
    if (statusMatch) {
      return this.buildSessionStatusBlocks(statusMatch[1]);
    }

    return this.buildHelpBlocks();
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

  private buildHelpBlocks(): Block[] {
    const commands = SUPPORTED_COMMANDS.map((c) => `\`${c}\``).join(', ');
    return [
      { type: 'header', text: { type: 'plain_text', text: 'Argus Bot Help', emoji: false } },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: [
            '*Supported commands:*',
            '`sessions` - List all active AI sessions',
            '`status <sessionId>` - Show details for a specific session',
            '`help` - Show this help message',
          ].join('\n'),
        },
      },
      { type: 'section', text: { type: 'mrkdwn', text: `_Available commands: ${commands}_` } },
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
}

interface MessageEvent {
  text?: string;
  channel: string;
  ts: string;
}

interface Block {
  type: string;
  [key: string]: unknown;
}

type SayFn = (args: { channel: string; blocks: Block[]; thread_ts: string; text: string }) => Promise<unknown>;
