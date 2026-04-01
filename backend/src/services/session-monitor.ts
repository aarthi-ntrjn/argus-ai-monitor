import { EventEmitter } from 'events';
import psList from 'ps-list';
import { RepositoryScanner } from './repository-scanner.js';
import { CopilotCliDetector } from './copilot-cli-detector.js';
import { ClaudeCodeDetector } from './claude-code-detector.js';
import { loadConfig } from '../config/config-loader.js';
import { getSessions, updateSessionStatus } from '../db/database.js';
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
      const activeSessions = getSessions({ status: 'active' });
      if (activeSessions.length === 0) return;
      const processes = await psList();
      const runningPids = new Set(processes.map((p) => p.pid));
      const now = new Date().toISOString();
      for (const session of activeSessions) {
        if (session.pid != null && !runningPids.has(session.pid)) {
          updateSessionStatus(session.id, 'ended', now);
        }
      }
    } catch { /* ignore — stale reconciliation is best-effort */ }
  }

  stop(): void {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
  }

  getCopilotCliDetector(): CopilotCliDetector {
    return this.cliDetector;
  }

  getClaudeCodeDetector(): ClaudeCodeDetector {
    return this.claudeDetector;
  }

  private async runScan(): Promise<void> {
    try {
      await this.scanner.scan();
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