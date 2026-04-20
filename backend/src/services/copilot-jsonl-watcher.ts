import { join } from 'path';
import { broadcast } from '../api/ws/event-dispatcher.js';
import { parseJsonlLine } from './copilot-cli-jsonl-parser.js';
import { JsonlWatcherBase } from './jsonl-watcher-base.js';
import type { SessionOutput } from '../models/index.js';

export class CopilotJsonlWatcher extends JsonlWatcherBase {
  protected readonly tag = '[CopilotDetector]';
  private readonly pendingAskUserCallIds = new Map<string, string>();

  protected parseLine(line: string, sessionId: string, seq: number, makeId: (blockIndex: number) => string): SessionOutput[] {
    return parseJsonlLine(line, sessionId, seq, makeId);
  }

  protected override onNewOutputs(sessionId: string, outputs: SessionOutput[]): void {
    const now = new Date().toISOString();
    for (const output of outputs) {
      if (output.type === 'tool_use' && output.toolName === 'ask_user') {
        let question = '';
        let choices: string[] = [];
        try {
          const parsed = JSON.parse(output.content) as Record<string, unknown>;
          if (typeof parsed.question === 'string') question = parsed.question;
          if (Array.isArray(parsed.choices)) {
            choices = (parsed.choices as unknown[]).filter((c): c is string => typeof c === 'string');
          }
        } catch { /* content may not be JSON when choices is absent */ }

        if (output.toolCallId) {
          this.pendingAskUserCallIds.set(sessionId, output.toolCallId);
        }
        const allQuestions = [{ question, choices }];
        broadcast({ type: 'session.pending_choice', timestamp: now, data: { sessionId, question, choices, allQuestions } });
      } else if (output.type === 'tool_result' && output.toolCallId) {
        const pendingId = this.pendingAskUserCallIds.get(sessionId);
        if (pendingId === output.toolCallId) {
          this.pendingAskUserCallIds.delete(sessionId);
          broadcast({ type: 'session.pending_choice.resolved', timestamp: now, data: { sessionId } });
        }
      }
    }
  }

  async watchFile(sessionId: string, dirPath: string): Promise<void> {
    await this.attachWatcher(sessionId, join(dirPath, 'events.jsonl'));
  }

  stopWatchers(): void {
    super.stopWatchers();
    this.pendingAskUserCallIds.clear();
  }
}
