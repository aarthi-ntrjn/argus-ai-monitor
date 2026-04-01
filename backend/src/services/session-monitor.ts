import { EventEmitter } from 'events';
import { RepositoryScanner } from './repository-scanner.js';
import { CopilotCliDetector } from './copilot-cli-detector.js';
import { ClaudeCodeDetector } from './claude-code-detector.js';
import { loadConfig } from '../config/config-loader.js';
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

  constructor() {
    super();
    const config = loadConfig();
    this.scanner = new RepositoryScanner(config.watchDirectories);
    this.cliDetector = new CopilotCliDetector();
    this.claudeDetector = new ClaudeCodeDetector();
  }

  async start(): Promise<void> {
    this.claudeDetector.injectHooks();
    await this.runScan();
    this.scanInterval = setInterval(() => this.runScan(), 5000);
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
      for (const session of sessions) {
        if (!this.knownSessionIds.has(session.id)) {
          this.knownSessionIds.add(session.id);
          this.emit('session.created', session);
        } else {
          this.emit('session.updated', session);
        }
        if (session.status === 'ended') {
          this.emit('session.ended', session);
        }
      }
    } catch (err) {
      this.emit('error', err);
    }
  }
}