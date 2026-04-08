import { EventEmitter } from 'events';
import { existsSync } from 'fs';
import { promises as fsPromises } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import psList from 'ps-list';
import { RepositoryScanner } from './repository-scanner.js';
import { CopilotCliDetector } from './copilot-cli-detector.js';
import { ClaudeCodeDetector, ACTIVE_JSONL_THRESHOLD_MS } from './claude-code-detector.js';
import { loadConfig } from '../config/config-loader.js';
import { getSessions, updateSessionStatus, getRepositories, updateRepositoryBranch } from '../db/database.js';
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
  private scanInterval: ReturnType<typeof setInterval> | null = null;
  private knownSessionIds = new Set<string>();
  private activeSessionMap = new Map<string, Session>();

  constructor() {
    super();
    const config = loadConfig();
    this.scanner = new RepositoryScanner(config.watchDirectories);
    this.cliDetector = new CopilotCliDetector();
    this.claudeDetector = new ClaudeCodeDetector();
  }

  async start(): Promise<void> {
    this.claudeDetector.injectHooks();
    await this.reconcileStaleSessions();
    await this.claudeDetector.scanExistingSessions();
    await this.runScan();
    this.scanInterval = setInterval(() => this.runScan(), 5000);
  }

  private async reconcileStaleSessions(): Promise<void> {
    try {
      const sessions = [
        ...getSessions({ status: 'active' }),
        ...getSessions({ status: 'idle' }),
      ];
      if (sessions.length === 0) return;
      const processes = await psList();
      const runningPids = new Set(processes.map((p) => p.pid));
      const now = new Date().toISOString();
      for (const session of sessions) {
        if (session.launchMode === 'pty') continue; // managed by launcher WebSocket
        if (session.pid != null && !runningPids.has(session.pid)) {
          updateSessionStatus(session.id, 'ended', now);
        }
      }
    } catch { /* ignore — stale reconciliation is best-effort */ }
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
          // file missing — treat as ended regardless of PID
        }

        // PTY (live) sessions are managed by the launcher WebSocket, not JSONL.
        // Skip JSONL-based reconciliation for them — the launcher close handler
        // will mark them ended when the PTY disconnects.
        if (session.launchMode === 'pty') continue;

        if (jsonlAgeMs === null) {
          // JSONL file missing: session is over
          updateSessionStatus(session.id, 'ended', now);
          this.claudeDetector.closeSessionWatcher(session.id);
          this.emit('session.ended', { ...session, status: 'ended', endedAt: now });
        } else if (jsonlAgeMs > thresholdMs) {
          // JSONL is stale — check PID to decide if session is still alive
          const pidAlive = session.pid != null && runningPids.has(session.pid);
          if (!pidAlive) {
            updateSessionStatus(session.id, 'ended', now);
            this.claudeDetector.closeSessionWatcher(session.id);
            this.emit('session.ended', { ...session, status: 'ended', endedAt: now });
          }
          // else: PID alive, JSONL stale → stay active (frontend will show "resting")
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

  private async runScan(): Promise<void> {
    try {
      await this.scanner.scan();
      await this.refreshRepositoryBranches();
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