import { EventEmitter } from 'events';
import psList from 'ps-list';
import { RepositoryScanner } from './repository-scanner.js';
import { CopilotCliDetector } from './copilot-cli-detector.js';
import { ClaudeCodeDetector } from './claude-code-detector.js';
import { ClaudeSessionRegistry } from './claude-session-registry.js';
import { loadConfig } from '../config/config-loader.js';
import { getSessions, getSession, upsertSession, updateSessionStatus, getRepositories, getRepositoryByPath, updateRepositoryBranch } from '../db/database.js';
import { broadcast } from '../api/ws/event-dispatcher.js';
import { getCurrentBranch } from './repository-scanner.js';
import { detectYoloModeFromPids } from './process-utils.js';
import { isAiToolProcess } from './pid-validator.js';
import { SessionTypes } from '../models/index.js';
import type { Session, Repository, ClaudeSessionRegistryEntry } from '../models/index.js';

export interface SessionMonitorEvents {
  'session.created': (session: Session) => void;
  'session.updated': (session: Session) => void;
  'session.ended': (session: Session) => void;
  'repository.added': (repo: Repository) => void;
  'repository.removed': (repo: Repository) => void;
}

export class SessionMonitor extends EventEmitter {
  private scanner: RepositoryScanner;
  private cliDetector: CopilotCliDetector;
  private claudeDetector: ClaudeCodeDetector;
  private sessionRegistry: ClaudeSessionRegistry;
  private scanInterval: ReturnType<typeof setInterval> | null = null;
  private knownSessionIds = new Set<string>();
  private activeSessionMap = new Map<string, Session>();
  // Track registry PIDs seen on the previous cycle to detect disappearances
  private previousRegistryPids = new Set<number>();
  // Track last-emitted state per session to suppress no-op session.updated events
  private lastEmittedSessions = new Map<string, string>();

  constructor() {
    super();
    const config = loadConfig();
    this.scanner = new RepositoryScanner(config.watchDirectories);
    this.cliDetector = new CopilotCliDetector();
    this.claudeDetector = new ClaudeCodeDetector();
    this.sessionRegistry = new ClaudeSessionRegistry();
  }

  async start(): Promise<void> {
    this.claudeDetector.injectHooks();
    await this.reconcileStaleSessions();
    await this.claudeDetector.scanExistingSessions();
    await this.runScan();
    this.scanInterval = setInterval(() => this.runScan(), 5000);
  }

  /**
   * Three-way reconciliation of active DB sessions on startup.
   *
   * Data sources:
   *   1. DB sessions with status active/idle
   *   2. Process registry (source of truth for PIDs, differs by session type):
   *      - claude-code: ~/.claude/sessions/*.json (ClaudeSessionRegistry)
   *      - copilot-cli: inuse.<PID>.lock files in ~/.copilot/session-state/<dir>/
   *   3. Running OS processes (psList) as the liveness check
   *
   * Reconciliation matrix (applied per session using its type-specific registry):
   *   Registry entry exists + PID running     → keep active, reconciled
   *   Registry entry exists + PID NOT running → mark ended, unreconciled (WARNING)
   *   No registry entry + PID running in OS   → mark active, unreconciled (ERROR)
   *   No registry entry + PID NOT running     → mark ended, reconciled
   */
  private async reconcileStaleSessions(): Promise<void> {
    try {
      const sessions = [
        ...getSessions({ status: 'active' }),
        ...getSessions({ status: 'idle' }),
      ];
      if (sessions.length === 0) return;

      // Source 2a: Claude session registry (session ID → registry entry with PID)
      const claudeRegistryEntries = this.sessionRegistry.scanEntries();
      const claudeRegistryBySessionId = new Map(claudeRegistryEntries.map(e => [e.sessionId, e.pid]));

      // Source 2b: Copilot lock file registry (session ID → PID)
      const copilotLockEntries = this.cliDetector.scanLockEntries();

      // Source 3: Running OS processes (filtered to AI tools only to avoid PID reuse false-positives)
      const processes = await psList();
      const runningPids = new Set(
        processes
          .filter((p) => isAiToolProcess(p.name, SessionTypes.CLAUDE_CODE) || isAiToolProcess(p.name, SessionTypes.COPILOT_CLI))
          .map((p) => p.pid)
      );

      const now = new Date().toISOString();

      for (const session of sessions) {
        // Look up the registry PID using the correct registry for this session type
        const registryPid = session.type === SessionTypes.CLAUDE_CODE
          ? claudeRegistryBySessionId.get(session.id) ?? null
          : copilotLockEntries.get(session.id) ?? null;

        const registryLabel = session.type === SessionTypes.CLAUDE_CODE
          ? 'Claude session registry'
          : 'Copilot lock file';

        if (registryPid != null) {
          // Registry has an entry for this session
          if (runningPids.has(registryPid)) {
            // Registry PID is alive: session is genuinely active, reconciled
            updateSessionStatus(session.id, 'active', null, true);
          } else {
            // Registry says this PID should be running, but OS says it's dead
            console.warn(
              `[reconcile] WARNING: ${session.type} session ${session.id} has ${registryLabel} entry with PID ${registryPid}, but process is not running. Marking ended (unreconciled).`
            );
            updateSessionStatus(session.id, 'ended', now, false);
          }
        } else if (session.pid != null && runningPids.has(session.pid)) {
          // No registry entry, but the DB PID is still a live OS process
          console.error(
            `[reconcile] ERROR: ${session.type} session ${session.id} has no ${registryLabel} entry, but PID ${session.pid} is still running. Marking active (unreconciled).`
          );
          updateSessionStatus(session.id, 'active', null, false);
        } else {
          // No registry entry and no live process: cleanly ended
          updateSessionStatus(session.id, 'ended', now, true);
        }
      }
    } catch (err) {
      console.error('[reconcile] Failed to reconcile stale sessions:', err);
    }
  }

  private async reconcileClaudeCodeSessions(): Promise<void> {
    try {
      const liveSessions = getSessions({ status: 'active', type: SessionTypes.CLAUDE_CODE });
      if (liveSessions.length === 0) return;

      const processes = await psList();
      const runningPids = new Set(
        processes
          .filter((p) => isAiToolProcess(p.name, SessionTypes.CLAUDE_CODE))
          .map((p) => p.pid)
      );
      const repos = getRepositories();
      const now = new Date().toISOString();

      for (const session of liveSessions) {
        const repo = repos.find(r => r.id === session.repositoryId);
        if (!repo) {
          console.log(`[ClaudeReconcile] session ended — repo removed sessionId=${session.id}`);
          updateSessionStatus(session.id, 'ended', now);
          this.claudeDetector.closeSessionWatcher(session.id);
          this.emit('session.ended', { ...session, status: 'ended', endedAt: now });
          continue;
        }

        // Check if the process is still running
        if (session.pid != null && !runningPids.has(session.pid)) {
          console.log(`[ClaudeReconcile] session ended — process gone sessionId=${session.id} pid=${session.pid}`);
          updateSessionStatus(session.id, 'ended', now);
          this.claudeDetector.closeSessionWatcher(session.id);
          this.emit('session.ended', { ...session, status: 'ended', endedAt: now });
        }
      }
    } catch { /* ignore — liveness check is best-effort */ }
  }

  private sessionSignature(session: Session): string {
    return JSON.stringify({
      status: session.status,
      lastActivityAt: session.lastActivityAt,
      summary: session.summary,
      model: session.model,
      pid: session.pid,
      hostPid: session.hostPid,
      pidSource: session.pidSource,
      launchMode: session.launchMode,
      endedAt: session.endedAt,
    });
  }

  triggerScan(): void {
    this.runScan().catch((err) => this.emit('error', err));
  }

  triggerCopilotScan(): void {
    this.cliDetector.scan(true).catch((err) => this.emit('error', err));
  }

  stop(): void {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    this.cliDetector.stopWatchers();
    this.claudeDetector.stopWatchers();
  }

  getClaudeCodeDetector(): ClaudeCodeDetector {
    return this.claudeDetector;
  }

  private async refreshRepositoryBranches(): Promise<void> {
    try {
      for (const repo of getRepositories()) {
        const branch = await getCurrentBranch(repo.path);
        if (branch !== repo.branch) {
          updateRepositoryBranch(repo.id, branch);
        }
      }
    } catch { /* ignore — branch refresh is best-effort */ }
  }

  private reconcileClaudeSessionRegistry(): void {
    const entries = this.sessionRegistry.scanEntries();
    const currentPids = new Set<number>();
    const now = new Date().toISOString();

    for (const entry of entries) {
      currentPids.add(entry.pid);
      this.reconcileRegistryEntry(entry, now);
    }

    this.endDisappearedSessions(currentPids, now);
    this.previousRegistryPids = currentPids;
  }

  private reconcileRegistryEntry(entry: ClaudeSessionRegistryEntry, now: string): void {
    const existing = getSession(entry.sessionId);
    if (existing) {
      // Skip if the PTY registry already resolved a real PID.
      // If pid is null, the Windows resolver failed — allow the session registry to backfill it.
      if (existing.pidSource === 'pty_registry' && existing.pid !== null) return;
      const pidChanged = existing.pid !== entry.pid || existing.pidSource !== 'session_registry';
      const yoloMode = existing.yoloMode !== null
        ? existing.yoloMode
        : detectYoloModeFromPids(entry.pid, null, 'claude-code');
      const yoloResolved = existing.yoloMode === null && yoloMode !== null;
      if (pidChanged || yoloResolved) {
        console.log(`[ClaudeRegistry] pid assigned sessionId=${entry.sessionId} pid=${entry.pid} (was ${existing.pid}) yoloMode=${yoloMode}`);
        const updated = { ...existing, pid: entry.pid, pidSource: 'session_registry' as const, yoloMode };
        upsertSession(updated);
        broadcast({ type: 'session.updated', timestamp: now, data: updated as unknown as Record<string, unknown> });
      }
    } else {
      this.createSessionFromRegistryEntry(entry, now);
    }
  }

  private createSessionFromRegistryEntry(entry: ClaudeSessionRegistryEntry, now: string): void {
    const repo = getRepositoryByPath(entry.cwd);
    if (!repo) return;
    console.log(`[ClaudeRegistry] session created sessionId=${entry.sessionId} pid=${entry.pid} cwd="${entry.cwd}"`);
    const session: Session = {
      id: entry.sessionId,
      repositoryId: repo.id,
      type: 'claude-code',
      launchMode: null,
      pid: entry.pid,
      hostPid: null,
      pidSource: 'session_registry',
      status: 'active',
      startedAt: new Date(entry.startedAt).toISOString(),
      endedAt: null,
      lastActivityAt: now,
      summary: null,
      expiresAt: null,
      model: null,
      reconciled: true,
      yoloMode: entry.pid ? detectYoloModeFromPids(entry.pid, null, 'claude-code') : null,
    };
    upsertSession(session);
    broadcast({ type: 'session.created', timestamp: now, data: session as unknown as Record<string, unknown> });
  }

  private endDisappearedSessions(currentPids: Set<number>, now: string): void {
    for (const oldPid of this.previousRegistryPids) {
      if (currentPids.has(oldPid)) continue;
      const activeSessions = getSessions({ status: 'active', type: 'claude-code' });
      for (const session of activeSessions) {
        if (session.pid === oldPid && session.pidSource === 'session_registry') {
          console.log(`[ClaudeRegistry] session ended — registry file gone sessionId=${session.id} pid=${oldPid}`);
          updateSessionStatus(session.id, 'ended', now);
          this.claudeDetector.closeSessionWatcher(session.id);
          this.emit('session.ended', { ...session, status: 'ended', endedAt: now });
        }
      }
    }
  }

  private async runScan(): Promise<void> {
    try {
      const tRun = Date.now();
      let t = Date.now();
      await this.scanner.scan();
      console.log(`[SessionMonitor] scanner.scan — ${Date.now() - t}ms`);
      t = Date.now();
      await this.refreshRepositoryBranches();
      console.log(`[SessionMonitor] refreshRepositoryBranches — ${Date.now() - t}ms`);
      t = Date.now();
      this.reconcileClaudeSessionRegistry();
      console.log(`[SessionMonitor] reconcileClaudeSessionRegistry — ${Date.now() - t}ms`);
      t = Date.now();
      await this.claudeDetector.scanExistingSessions();
      console.log(`[SessionMonitor] claudeDetector.scanExistingSessions — ${Date.now() - t}ms`);
      t = Date.now();
      await this.reconcileClaudeCodeSessions();
      console.log(`[SessionMonitor] reconcileClaudeCodeSessions — ${Date.now() - t}ms`);
      t = Date.now();
      const sessions = await this.cliDetector.scan();
      console.log(`[SessionMonitor] cliDetector.scan — ${Date.now() - t}ms`);
      console.log(`[SessionMonitor] runScan total — ${Date.now() - tRun}ms`);
      const currentScanIds = new Set<string>(sessions.map((s) => s.id));

      // Detect sessions that were active but are no longer returned (process exited + dir cleaned up)
      for (const [id, session] of this.activeSessionMap) {
        if (!currentScanIds.has(id)) {
          const now = new Date().toISOString();
          updateSessionStatus(id, 'ended', now);
          const endedSession: Session = { ...session, status: 'ended', endedAt: now };
          this.emit('session.ended', endedSession);
          this.activeSessionMap.delete(id);
          this.lastEmittedSessions.delete(id);
        }
      }

      for (const session of sessions) {
        if (!this.knownSessionIds.has(session.id)) {
          this.knownSessionIds.add(session.id);
          this.lastEmittedSessions.set(session.id, this.sessionSignature(session));
          this.emit('session.created', session);
        } else {
          const sig = this.sessionSignature(session);
          if (this.lastEmittedSessions.get(session.id) !== sig) {
            this.lastEmittedSessions.set(session.id, sig);
            this.emit('session.updated', session);
          }
        }
        if (session.status === 'ended') {
          // Only emit session.ended once: when the session was previously tracked as active.
          // Ended sessions remain on disk and would re-trigger this on every scan otherwise.
          if (this.activeSessionMap.has(session.id)) {
            this.emit('session.ended', session);
            this.activeSessionMap.delete(session.id);
            this.lastEmittedSessions.delete(session.id);
          }
        } else if (session.status === 'active') {
          this.activeSessionMap.set(session.id, session);
        }
      }
    } catch (err) {
      this.emit('error', err);
    }
  }
}