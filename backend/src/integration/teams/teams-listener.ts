import type { App } from '@microsoft/teams.apps';
import { getSessions, getSession, getTeamsThreadByTeamsId } from '../../db/database.js';
import type { NotificationListener } from '../../models/index.js';
import { SessionController } from '../../services/session-controller.js';
import { loadTeamsConfig } from '../../config/teams-config-loader.js';
import type { TeamsLogger } from './teams-notifier.js';

const LOG_TAG = 'teams-listener';

export class TeamsListener implements NotificationListener {
  private readonly sessionController: SessionController;
  private active = false;
  private handlerRegistered = false;

  constructor(
    private readonly teamsApp: App,
    private readonly logger: TeamsLogger,
  ) {
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
    this.teamsApp.message(/.*/, async (ctx) => {
      if (!this.active) return;
      const teamsConfig = loadTeamsConfig();
      const senderAadObjectId = (ctx.activity.from as Record<string, unknown>)?.['aadObjectId'] as string | undefined;
      this.logger.info({ senderAadObjectId, source: LOG_TAG }, 'teams.listener.message.received');

      if (!senderAadObjectId || senderAadObjectId !== teamsConfig.ownerAadObjectId) {
        this.logger.info({ senderAadObjectId, source: LOG_TAG }, 'teams.listener.message.rejected.non-owner');
        return;
      }

      const conversationId = ctx.activity.conversation?.id;
      const raw = ctx.activity.text ?? '';
      const text = raw.replace(/<at>[^<]*<\/at>/g, '').trim();
      if (!text) return;

      this.logger.info({ text, source: LOG_TAG }, 'teams.listener.message.command.received');

      try {
        const response = await this.handleArgusQuery(text, conversationId);
        if (conversationId) {
          await this.teamsApp.api.conversations.activities(conversationId).create({ type: 'message', text: response });
        }
      } catch (err) {
        this.logger.error({ err, source: LOG_TAG }, 'teams.listener.message.failed');
      }
    });
    return true;
  }

  shutdown(): void {
    this.active = false;
    this.logger.info({}, 'teams.listener.shutdown');
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

    const sendMatch = /^send\s+(.+)/s.exec(normalized);
    if (sendMatch) {
      return this.formatSendPrompt(sendMatch[1].trim(), conversationId);
    }

    return this.formatHelp();
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
      return '`send` must be used inside a session thread.';
    }

    const thread = getTeamsThreadByTeamsId(threadId);
    if (!thread) {
      return 'Could not find an active session for this thread.';
    }

    const session = getSession(thread.sessionId);
    if (!session) {
      return `Session \`${thread.sessionId}\` no longer exists.`;
    }

    this.logger.info({ sessionId: thread.sessionId, source: LOG_TAG }, 'teams.listener.send.dispatching');
    const action = await this.sessionController.sendPrompt(thread.sessionId, prompt);

    if (action.status === 'failed') {
      return `Failed to send prompt to \`${thread.sessionId}\`: ${action.result ?? 'unknown error'}`;
    }

    return `Prompt sent to session \`${thread.sessionId}\` (action \`${action.id}\`)`;
  }

  private formatHelp(): string {
    return [
      '**Argus Bot Help**',
      '---',
      '`sessions` - List all active AI sessions',
      '`status <sessionId>` - Show details for a specific session',
      '`send <message>` - Send a prompt to the session in this thread',
      '`help` - Show this help message',
    ].join('\n');
  }
}

function extractThreadId(conversationId: string | undefined): string | null {
  if (!conversationId) return null;
  const match = conversationId.match(/messageid=([^;]+)/);
  return match ? match[1] : null;
}
