import { join } from 'path';
import { parseJsonlLine } from './copilot-cli-jsonl-parser.js';
import { JsonlWatcherBase } from './jsonl-watcher-base.js';
import type { SessionOutput } from '../models/index.js';

export class CopilotJsonlWatcher extends JsonlWatcherBase {
  protected readonly tag = '[CopilotDetector]';

  protected parseLine(line: string, sessionId: string, seq: number, makeId: (blockIndex: number) => string): SessionOutput[] {
    return parseJsonlLine(line, sessionId, seq, makeId);
  }

  async watchFile(sessionId: string, dirPath: string): Promise<void> {
    await this.attachWatcher(sessionId, join(dirPath, 'events.jsonl'));
  }
}
