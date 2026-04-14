import { randomUUID } from 'crypto';
import type { Logger } from 'pino';
import { loadTeamsConfig } from '../config/teams-config-loader.js';
import { getSessions, getTeamsThread, getSession, insertControlAction, updateTeamsThreadDeltaLink } from '../db/database.js';
import type { TeamsConfig } from '../models/index.js';
import type { TeamsGraphClient } from './teams-graph-client.js';
import type { TeamsMsalService } from './teams-msal-service.js';

const ACTIVE_STATUSES = ['active', 'idle', 'running', 'waiting'];

export class TeamsPollingService {
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly graphClient: TeamsGraphClient,
    private readonly msalService: TeamsMsalService,
    private readonly logger: Logger,
    private readonly intervalMs = 10_000,
  ) {}

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.runOneCycle().catch(err => this.logger.error({ err }, 'teams.polling.unexpected.error'));
    }, this.intervalMs);
  }

  stop(): void {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }

  async runOneCycle(): Promise<void> {
    const config = loadTeamsConfig();
    if (!config.enabled || !config.clientId || !config.refreshToken) return;
    const typedConfig = config as TeamsConfig;

    let accessToken: string;
    try {
      accessToken = await this.msalService.getAccessToken(typedConfig);
    } catch (err) {
      this.logger.warn({ err }, 'teams.polling.token.failed');
      return;
    }

    const sessions = getSessions({ status: undefined });
    const activeSessions = sessions.filter(s => ACTIVE_STATUSES.includes(s.status));

    for (const session of activeSessions) {
      const thread = getTeamsThread(session.id);
      if (!thread) continue;
      try {
        await this._pollSession(session.id, thread.teamsThreadId, thread.deltaLink ?? null, accessToken, typedConfig);
      } catch (err) {
        this.logger.warn({ err, sessionId: session.id }, 'teams.polling.session.failed');
      }
    }
  }

  private async _pollSession(sessionId: string, threadId: string, deltaLink: string | null, accessToken: string, config: TeamsConfig): Promise<void> {
    const { replies, nextDeltaLink } = await this.graphClient.pollReplies(config.teamId, config.channelId, threadId, accessToken, deltaLink);

    for (const reply of replies) {
      const fromUserId = reply.from?.user?.id;
      const text = reply.body?.content?.replace(/<[^>]+>/g, '').trim() ?? '';
      if (!text) continue;

      const freshSession = getSession(sessionId);
      const isActive = freshSession && ACTIVE_STATUSES.includes(freshSession.status);

      if (!isActive) {
        await this.graphClient.postReply(config.teamId, config.channelId, threadId, accessToken,
          'This session has ended and no longer accepts commands.');
        continue;
      }

      if (fromUserId !== config.ownerUserId) {
        await this.graphClient.postReply(config.teamId, config.channelId, threadId, accessToken,
          'Only the session owner can send commands to this session.');
        this.logger.info({ fromUserId, sessionId }, 'teams.command.rejected');
        continue;
      }

      insertControlAction({
        id: randomUUID(),
        sessionId,
        type: 'send_prompt',
        payload: { text },
        status: 'pending',
        createdAt: new Date().toISOString(),
        completedAt: null,
        result: null,
        source: 'Teams',
      });
      this.logger.info({ sessionId, source: 'Teams' }, 'teams.command.received');
    }

    updateTeamsThreadDeltaLink(sessionId, nextDeltaLink);
  }
}
