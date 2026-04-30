import type { App } from '@microsoft/teams.apps';
import { MessageActivity } from '@microsoft/teams.api';
import { getSessions, getSession, getTeamsThreadByTeamsId } from '../../db/database.js';
import type { NotificationListener } from '../../models/index.js';
import { SessionController } from '../../services/session-controller.js';
import { loadTeamsConfig } from '../../config/teams-config-loader.js';
import { createTaggedLogger } from '../../utils/logger.js';

const log = createTaggedLogger('[TeamsListener]', '\x1b[36m'); // cyan

export class TeamsListener implements NotificationListener {
  private readonly sessionController: SessionController;
  private active = false;
  private handlerRegistered = false;

  constructor(private readonly teamsApp: App) {
    this.sessionController = new SessionController();
  }

  get isRunning(): boolean {
    return this.active;
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  async initialize(): Promise<boolean> {
    this.active = true;
    if (this.handlerRegistered) return true;
    this.handlerRegistered = true;
    this.teamsApp.on('message', async ({ activity, send }) => {
      if (!this.active) return;
      const teamsConfig = loadTeamsConfig();
      const senderAadObjectId = (activity.from as Record<string, unknown>)?.['aadObjectId'] as string | undefined;
      log.info(`teams.listener.message.received: senderAadObjectId=${senderAadObjectId}`);

      if (!senderAadObjectId || senderAadObjectId !== teamsConfig.ownerSenderId) {
        log.info(`teams.listener.message.rejected.non-owner: senderAadObjectId=${senderAadObjectId}`);
        return;
      }

      const conversationId = activity.conversation?.id;
      const raw = activity.text ?? '';
      const text = raw.replace(/<at>[^<]*<\/at>/g, '').trim();
      if (!text) return;

      log.info(`teams.listener.message.command.received: text=${text}`);

      try {
        const response = await this.handleArgusQuery(text, conversationId);
        if (response) {
          await send(new MessageActivity(response));
        }
      } catch (err) {
        log.error('teams.listener.message.failed', err);
      }
    });

    this.teamsApp.on('card.action', async ({ activity, send }) => {
      if (!this.active) return;
      const data = activity.value?.action?.data as Record<string, unknown> | undefined;
      if (data?.action !== 'pending_choice') return;

      const teamsConfig = loadTeamsConfig();
      const senderAadObjectId = (activity.from as Record<string, unknown>)?.['aadObjectId'] as string | undefined;
      if (!senderAadObjectId || senderAadObjectId !== teamsConfig.ownerSenderId) {
        log.info(`teams.listener.card.action.rejected.non-owner: senderAadObjectId=${senderAadObjectId}`);
        return { statusCode: 200, type: 'application/vnd.microsoft.activity.message' as const, value: 'Unauthorized' };
      }

      const sessionId = data.sessionId as string;
      const choiceText = data.choiceText as string;
      log.info(`teams.listener.card.action.pending_choice: session=${sessionId} choiceText=${choiceText}`);

      try {
        const action = await this.sessionController.sendPrompt(sessionId, choiceText);
        if (action.status === 'failed') {
          await send(new MessageActivity(`Failed to send choice: ${action.result ?? 'unknown error'}`));
          return { statusCode: 200, type: 'application/vnd.microsoft.activity.message' as const, value: 'Failed' };
        }
        return { statusCode: 200, type: 'application/vnd.microsoft.activity.message' as const, value: `Sent: ${choiceText}` };
      } catch (err) {
        log.error(`teams.listener.card.action.failed: session=${sessionId}`, err);
        return { statusCode: 200, type: 'application/vnd.microsoft.activity.message' as const, value: 'Error processing choice' };
      }
    });
    return true;
  }

  shutdown(): void {
    this.active = false;
    log.info('teams.listener.shutdown');
  }

  // -------------------------------------------------------------------------
  // Command routing
  // -------------------------------------------------------------------------

  async handleArgusQuery(text: string, conversationId: string | undefined): Promise<string> {
    const normalized = text.trim().toLowerCase();

    if (/^sessions?\s*$/.test(normalized)) {
      return this.formatSessionList();
    }

    const statusMatch = /^status\s+(\S+)/.exec(normalized);
    if (statusMatch) {
      return this.formatSessionStatus(statusMatch[1]);
    }

    if (/^help\s*$/.test(normalized)) {
      return this.formatHelp();
    }

    // Anything else is sent as a prompt to the session in this thread
    return this.formatSendPrompt(text.trim(), conversationId);
  }

  // -------------------------------------------------------------------------
  // Response formatters
  // -------------------------------------------------------------------------

  private formatSessionList(): string {
    const active = [
      ...getSessions({ status: 'active' }),
      ...getSessions({ status: 'idle' }),
      ...getSessions({ status: 'waiting' }),
    ];

    if (active.length === 0) {
      return 'No active sessions at this time.';
    }

    const rows = active.map((s) =>
      `\`${s.id.slice(0, 8)}...\` | ${s.type} | ${s.model ?? 'unknown'} | ${s.status}`
    ).join('\n');

    return `**Active Sessions (${active.length})**\n---\n${rows}`;
  }

  private formatSessionStatus(sessionId: string): string {
    const session = getSession(sessionId) ?? getSessions({ status: 'active' }).find((s) => s.id.startsWith(sessionId));
    if (!session) {
      return `No session found matching \`${sessionId}\``;
    }
    return [
      '**Session Status**',
      '---',
      `**ID:** \`${session.id}\``,
      `**Type:** ${session.type}`,
      `**Status:** ${session.status}`,
      `**Model:** ${session.model ?? 'unknown'}`,
      `**Started:** ${session.startedAt}`,
    ].join('\n');
  }

  private async formatSendPrompt(prompt: string, conversationId: string | undefined): Promise<string> {
    const threadId = extractThreadId(conversationId);
    if (!threadId) {
      return 'This message must be sent inside a session thread.';
    }

    const thread = getTeamsThreadByTeamsId(threadId);
    if (!thread) {
      return 'Could not find an active session for this thread.';
    }

    const session = getSession(thread.sessionId);
    if (!session) {
      return `Session \`${thread.sessionId}\` no longer exists.`;
    }

    log.info(`teams.listener.send.dispatching: session=${thread.sessionId}`);
    const action = await this.sessionController.sendPrompt(thread.sessionId, prompt);

    if (action.status === 'failed') {
      return `Failed to send prompt to \`${thread.sessionId}\`: ${action.result ?? 'unknown error'}`;
    }

    return '';
  }

  private formatHelp(): string {
    return [
      '**Argus Bot Help**',
      '---',
      '`sessions` - List all active AI sessions',
      '`status <sessionId>` - Show details for a specific session',
      '`help` - Show this help message',
      'Anything else is sent as a prompt to the session in this thread.',
    ].join('\n');
  }
}

function extractThreadId(conversationId: string | undefined): string | null {
  if (!conversationId) return null;
  const match = conversationId.match(/messageid=([^;]+)/);
  return match ? match[1] : null;
}

