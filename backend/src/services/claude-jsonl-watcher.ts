import { join } from 'path';
import { homedir } from 'os';
import { parseClaudeJsonlLine } from './claude-code-jsonl-parser.js';
import { JsonlWatcherBase } from './jsonl-watcher-base.js';
import type { SessionOutput } from '../models/index.js';

function claudeProjectDirName(repoPath: string): string {
  return repoPath.replace(/[:\\/\s]/g, '-');
}

export class ClaudeJsonlWatcher extends JsonlWatcherBase {
  protected readonly tag = '[ClaudeDetector]';

  protected parseLine(line: string, sessionId: string, seq: number, makeId: (blockIndex: number) => string): SessionOutput[] {
    return parseClaudeJsonlLine(line, sessionId, seq, makeId);
  }

  async watchFile(sessionId: string, repoPath: string): Promise<void> {
    const jsonlPath = join(
      homedir(), '.claude', 'projects',
      claudeProjectDirName(repoPath),
      `${sessionId}.jsonl`,
    );
    await this.attachWatcher(sessionId, jsonlPath);
  }

  closeWatcher(sessionId: string): void {
    this.watchers.get(sessionId)?.close().catch(() => {});
    this.watchers.delete(sessionId);
    this.filePositions.delete(sessionId);
    this.sequenceCounters.delete(sessionId);
  }

  stopAll(): void {
    this.stopWatchers();
  }
}
