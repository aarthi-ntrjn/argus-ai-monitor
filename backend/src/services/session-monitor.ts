import { EventEmitter } from 'events';
import { existsSync } from 'fs';
import { promises as fsPromises } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import psList from 'ps-list';
import { RepositoryScanner } from './repository-scanner.js';
import { CopilotCliDetector } from './copilot-cli-detector.js';
import { ClaudeCodeDetector, ACTIVE_JSONL_THRESHOLD_MS } from './claude-code-detector.js';
import { ClaudeSessionRegistry } from './claude-session-registry.js';
import { loadConfig } from '../config/config-loader.js';
import { getSessions, getSession, upsertSession, updateSessionStatus, getRepositories, getRepositoryByPath, updateRepositoryBranch } from '../db/database.js';
import { broadcast } from '../api/ws/event-dispatcher.js';
import { getCurrentBranch } from './repository-scanner.js';
import type { Session, Repository } from '../models/index.js';

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

      // Source 3: Running OS processes
      const processes = await psList();
      const runningPids = new Set(processes.map((p) => p.pid));

      const now = new Date().toISOString();

      for (const session of sessions) {
        // Look up the registry PID using the correct registry for this session type
        const registryPid = session.type === 'claude-code'
          ? claudeRegistryBySessionId.get(session.id) ?? null
          : copilotLockEntries.get(session.id) ?? null;

        const registryLabel = session.type === 'claude-code'
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
      const liveSessions = getSessions({ status: 'active', type: 'claude-code' });
      if (liveSessions.length === 0) return;

      const config = loadConfig();
      const thresholdMs = config.idleSessionThresholdMinutes * 60_000;
      const processes = await psList();
      const runningPids = new Set(processes.map((p) => p.pid));
      const repos = getRepositories();
      const now = new Date().toISOString();

      for (const session of liveSessions) {
        const repo = repos.find(r => r.id === session.repositoryId);
        if (!repo) {
          updateSessionStatus(session.id, 'ended', now);
          this.claudeDetector.closeSessionWatcher(session.id);
          this.emit('session.ended', { ...session, status: 'ended', endedAt: now });
          continue;
        }

        // Sessions with a PID: check if the process is still running
        if (session.pid != null) {
          if (!runningPids.has(session.pid)) {
            updateSessionStatus(session.id, 'ended', now);
            this.claudeDetector.closeSessionWatcher(session.id);
            this.emit('session.ended', { ...session, status: 'ended', endedAt: now });
          }
          continue;
        }

        // Null-PID sessions: use JSONL file freshness as the liveness signal.
        // Give new sessions a 60-second grace period before checking JSONL,
        // because Claude may not have written the file yet.
        const sessionAgeMs = Date.now() - new Date(session.startedAt).getTime();
        if (sessionAgeMs < 60_000) continue;

        const jsonlPath = join(
          homedir(), '.claude', 'projects',
          ClaudeCodeDetector.projectDirName(repo.path),
          `${session.id}.jsonl`
        );

        let jsonlAgeMs: number | null = null;
        try {
          const stat = await fsPromises.stat(jsonlPath);
          jsonlAgeMs = Date.now() - stat.mtime.getTime();
        } catch {
          // file missing
        }

        if (jsonlAgeMs === null || jsonlAgeMs > thresholdMs) {
          updateSessionStatus(session.id, 'ended', now);
          this.claudeDetector.closeSessionWatcher(session.id);
          this.emit('session.ended', { ...session, status: 'ended', endedAt: now });
        }
        // else: JSONL is fresh → stay active, no change
      }
    } catch { /* ignore — liveness check is best-effort */ }
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

      const existing = getSession(entry.sessionId);
      if (existing) {
        // Skip PID assignment if already claimed by PTY registry (PTY takes precedence)
        if (existing.pidSource === 'pty_registry') continue;

        // Assign PID if not yet set or if source was not session_registry
        if (existing.pid !== entry.pid || existing.pidSource !== 'session_registry') {
          const updated = { ...existing, pid: entry.pid, pidSource: 'session_registry' as const };
          upsertSession(updated);
          broadcast({ type: 'session.updated', timestamp: now, data: updated as unknown as Record<string, unknown> });
        }
      } else {
        // Session not in DB yet. Check if cwd matches a registered repo.
        const repo = getRepositoryByPath(entry.cwd);
        if (!repo) continue; // Unregistered repo, ignore

        const session: Session = {
          id: entry.sessionId,
          repositoryId: repo.id,
          type: 'claude-code',
          launchMode: null,
          pid: entry.pid,
          pidSource: 'session_registry',
          status: 'active',
          startedAt: new Date(entry.startedAt).toISOString(),
          endedAt: null,
          lastActivityAt: now,
          summary: null,
          expiresAt: null,
          model: null,
          reconciled: true,
        };
        upsertSession(session);
        broadcast({ type: 'session.created', timestamp: now, data: session as unknown as Record<string, unknown> });
      }
    }

    // Detect disappeared registry files: PIDs we saw last cycle but not this cycle
    for (const oldPid of this.previousRegistryPids) {
      if (currentPids.has(oldPid)) continue;
      // Find sessions that had this PID via session_registry and are still active
      const activeSessions = getSessions({ status: 'active', type: 'claude-code' });
      for (const session of activeSessions) {
        if (session.pid === oldPid && session.pidSource === 'session_registry') {
          updateSessionStatus(session.id, 'ended', now);
          this.claudeDetector.closeSessionWatcher(session.id);
          this.emit('session.ended', { ...session, status: 'ended', endedAt: now });
        }
      }
    }

    this.previousRegistryPids = currentPids;
  }

  private async runScan(): Promise<void> {
    try {
      await this.scanner.scan();
      await this.refreshRepositoryBranches();
      this.reconcileClaudeSessionRegistry();
      await this.claudeDetector.scanExistingSessions();
      await this.reconcileClaudeCodeSessions();
      const sessions = await this.cliDetector.scan();
      const currentScanIds = new Set<string>(sessions.map((s) => s.id));

      // Detect sessions that were active but are no longer returned (process exited + dir cleaned up)
      for (const [id, session] of this.activeSessionMap) {
        if (!currentScanIds.has(id)) {
          const now = new Date().toISOString();
          updateSessionStatus(id, 'ended', now);
          const endedSession: Session = { ...session, status: 'ended', endedAt: now };
          this.emit('session.ended', endedSession);
          this.activeSessionMap.delete(id);
        }
      }

      for (const session of sessions) {
        if (!this.knownSessionIds.has(session.id)) {
          this.knownSessionIds.add(session.id);
          this.emit('session.created', session);
        } else {
          this.emit('session.updated', session);
        }
        if (session.status === 'ended') {
          this.emit('session.ended', session);
          this.activeSessionMap.delete(session.id);
        } else if (session.status === 'active') {
          this.activeSessionMap.set(session.id, session);
        }
      }
    } catch (err) {
      this.emit('error', err);
    }
  }
}