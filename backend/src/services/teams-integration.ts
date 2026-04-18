import { randomUUID } from 'crypto';
import type { Logger, LogFn } from 'pino';
import type { App } from '@microsoft/teams.apps';
import type { Session, SessionOutput } from '../models/index.js';
import { loadTeamsConfig } from '../config/teams-config-loader.js';
import { getTeamsThread, upsertTeamsThread, getRepository } from '../db/database.js';
import type { Repository } from '../models/index.js';

type TeamsLogger = Logger & { teams: LogFn };

type TrackedSessionState = {
  status: string;
  model: string | null;
  yoloMode: boolean | null;
  pid: number | null;
  launchMode: string | null;
  summary: string | null;
};

type UntrackedSessionSnapshot = {
  lastActivityAt: string | null;
  hostPid: number | null;
  pidSource: string | null;
  endedAt: string | null;
};

function extractTrackedState(session: Session): TrackedSessionState {
  return {
    status: session.status,
    model: session.model,
    yoloMode: session.yoloMode,
    pid: session.pid,
    launchMode: session.launchMode,
    summary: session.summary,
  };
}

function extractUntrackedSnapshot(session: Session): UntrackedSessionSnapshot {
  return {
    lastActivityAt: session.lastActivityAt,
    hostPid: session.hostPid ?? null,
    pidSource: session.pidSource ?? null,
    endedAt: session.endedAt,
  };
}

function field(label: string, value: string): string {
  return `**${label}:** ${value}`;
}

function code(value: string): string {
  return `\`${value}\``;
}

export class TeamsIntegrationService {
  private lastPostedState = new Map<string, TrackedSessionState>();
  private lastSeenSnapshot = new Map<string, UntrackedSessionSnapshot>();
  private active = false;

  constructor(
    private readonly teamsApp: App,
    private readonly logger: TeamsLogger,
  ) {}

  initialize(): boolean {
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
    const config = loadTeamsConfig();
    if (!this.isConfigured()) {
      this.logger.warn({ ...this._sessionCtx(session), enabled: config.enabled, hasTeamId: Boolean(config.teamId), hasChannelId: Boolean(config.channelId), hasOwner: Boolean(config.ownerAadObjectId) }, 'teams.session.created.skipped: not configured');
      return;
    }
    const { channelId } = config as { channelId: string };

    const existing = getTeamsThread(session.id);
    if (existing) {
      this.logger.teams({ ...this._sessionCtx(session), teamsThreadId: existing.teamsThreadId }, 'teams.thread.reused');
      this.lastPostedState.set(session.id, extractTrackedState(session));
      try {
        const threadConvId = `${channelId};messageid=${existing.teamsThreadId}`;
        await this.teamsApp.api.conversations.activities(threadConvId).create({ type: 'message', text: this._formatReconnectMessage(session) });
        this.logger.teams({ ...this._sessionCtx(session), teamsThreadId: existing.teamsThreadId }, 'teams.thread.reused.notified');
      } catch (err) {
        this.logger.warn({ ...this._sessionCtx(session), err }, 'teams.thread.reused.notify.failed');
      }
      return;
    }

    const repo = getRepository(session.repositoryId);
    this.logger.teams({ ...this._sessionCtx(session), repositoryId: session.repositoryId, repoName: repo?.name }, 'teams.thread.creating');
    try {
      const sent = await this.teamsApp.send(channelId, { type: 'message', text: this._formatOpeningMessage(session, repo) });
      this.logger.teams({ ...this._sessionCtx(session), sentId: sent?.id, sentKeys: sent ? Object.keys(sent) : [] }, 'teams.thread.send.response');
      upsertTeamsThread({
        id: randomUUID(),
        sessionId: session.id,
        teamsThreadId: sent.id,
        teamsChannelId: channelId,
        createdAt: new Date().toISOString(),
      });
      const stored = getTeamsThread(session.id);
      this.logger.teams({ ...this._sessionCtx(session), teamsThreadId: sent.id, storedThreadId: stored?.teamsThreadId, stored: !!stored }, 'teams.thread.created');
      this.lastPostedState.set(session.id, extractTrackedState(session));
    } catch (err) {
      this.logger.error({ ...this._sessionCtx(session), err }, 'teams.thread.create.failed');
    }
  }

  async onSessionUpdated(session: Session): Promise<void> {
    this.logger.teams({ ...this._sessionCtx(session), status: session.status, model: session.model, pid: session.pid }, 'teams.session.updated.received');
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

    const prevSnap = this.lastSeenSnapshot.get(session.id);
    this.lastSeenSnapshot.set(session.id, extractUntrackedSnapshot(session));

    const prev = this.lastPostedState.get(session.id);
    const curr = extractTrackedState(session);
    const changes = this._diffState(prev, curr);
    if (changes.length === 0) {
      const untrackedChanges: string[] = [];
      if (prevSnap) {
        if (prevSnap.lastActivityAt !== session.lastActivityAt) untrackedChanges.push('lastActivityAt');
        if (prevSnap.hostPid !== (session.hostPid ?? null)) untrackedChanges.push('hostPid');
        if (prevSnap.pidSource !== (session.pidSource ?? null)) untrackedChanges.push('pidSource');
        if (prevSnap.endedAt !== session.endedAt) untrackedChanges.push('endedAt');
      }
      this.logger.teams({ ...this._sessionCtx(session), untrackedChanges }, 'teams.session.updated.skipped: no meaningful changes');
      return;
    }

    this.logger.teams({ ...this._sessionCtx(session), changes: changes.map(c => c.label), prev, curr }, 'teams.session.updated.posting');
    this.lastPostedState.set(session.id, curr);

    const config = loadTeamsConfig();
    const { channelId } = config as { channelId: string };

    try {
      const threadConvId = `${channelId};messageid=${thread.teamsThreadId}`;
      await this.teamsApp.api.conversations.activities(threadConvId).create({ type: 'message', text: this._formatUpdateMessage(session, changes) });
      this.logger.teams({ ...this._sessionCtx(session), changes: changes.map(c => c.label) }, 'teams.session.updated.posted');
    } catch (err) {
      this.logger.error({ ...this._sessionCtx(session), err }, 'teams.session.update.notify.failed');
    }
  }

  async onSessionOutput(sessionId: string, outputs: SessionOutput[]): Promise<void> {
    const config = loadTeamsConfig();
    if (!config.enabled) {
      this.logger.teams({ sessionId }, 'teams.session.output.skipped: not enabled');
      return;
    }
    const assistantMessages = outputs.filter(o => o.role === 'assistant' && o.type === 'message' && o.content.trim());
    if (assistantMessages.length === 0) return;
    const thread = getTeamsThread(sessionId);
    if (!thread) return;
    const text = assistantMessages.map(o => o.content).join('\n\n');
    const { channelId } = config as { channelId: string };
    try {
      const threadConvId = `${channelId};messageid=${thread.teamsThreadId}`;
      await this.teamsApp.api.conversations.activities(threadConvId).create({ type: 'message', text });
      this.logger.teams({ ...this._logCtx(), sessionId, chars: text.length }, 'teams.session.output.posted');
    } catch (err) {
      this.logger.error({ ...this._logCtx(), err, sessionId }, 'teams.session.output.failed');
    }
  }

  async onSessionEnded(session: Session): Promise<void> {
    this.logger.teams({ ...this._sessionCtx(session), status: session.status }, 'teams.session.ended.received');
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

    try {
      const threadConvId = `${channelId};messageid=${thread.teamsThreadId}`;
      await this.teamsApp.api.conversations.activities(threadConvId).create({ type: 'message', text: this._formatEndedMessage(session) });
      this.logger.teams({ ...this._sessionCtx(session), status: session.status }, 'teams.session.ended');
    } catch (err) {
      this.logger.error({ ...this._sessionCtx(session), err }, 'teams.session.end.notify.failed');
    }
  }

  stop(): void {}

  private _diffState(prev: TrackedSessionState | undefined, curr: TrackedSessionState): { label: string; value: string }[] {
    if (!prev) return [];
    const changes: { label: string; value: string }[] = [];
    if (prev.status !== curr.status)
      changes.push({ label: 'Status', value: curr.status });
    if (prev.model !== curr.model)
      changes.push({ label: 'Model', value: curr.model ?? '(unknown)' });
    if (prev.yoloMode !== curr.yoloMode)
      changes.push({ label: 'Yolo', value: curr.yoloMode ? 'on' : 'off' });
    if (prev.pid !== curr.pid)
      changes.push({ label: 'PID', value: curr.pid != null ? String(curr.pid) : '(unknown)' });
    if (prev.launchMode !== curr.launchMode)
      changes.push({ label: 'Mode', value: curr.launchMode === 'pty' ? 'connected' : 'readonly' });
    if (curr.summary !== null && prev.summary !== curr.summary)
      changes.push({ label: 'Task', value: curr.summary });
    return changes;
  }

  _formatOpeningMessage(session: Session, repo: Repository | undefined): string {
    return [
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
  }

  _formatReconnectMessage(session: Session): string {
    return [
      '**Session Reconnected**',
      '---',
      field('Status', session.status),
      field('Session', code(session.id)),
    ].join('\n');
  }

  _formatUpdateMessage(_session: Session, changes: { label: string; value: string }[]): string {
    return [
      '**Session Updated**',
      '---',
      ...changes.map(({ label, value }) => field(label, value)),
    ].join('\n');
  }

  _formatEndedMessage(session: Session): string {
    return [
      '**Session Ended**',
      '---',
      field('Status', session.status),
      field('Ended', session.endedAt ?? new Date().toISOString()),
    ].join('\n');
  }
}
