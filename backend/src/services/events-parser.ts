import { randomUUID } from 'crypto';
import type { SessionOutput, OutputType } from '../models/index.js';

interface JsonlEvent {
  type: string;
  timestamp?: string;
  content?: string;
  tool_name?: string;
  [key: string]: unknown;
}

const EVENT_TYPE_MAP: Record<string, OutputType> = {
  'assistant.message': 'message',
  'tool.execution_start': 'tool_use',
  'tool.execution_complete': 'tool_result',
  'session.start': 'status_change',
  'user.message': 'message',
};

export function parseJsonlLine(line: string, sessionId: string, sequenceNumber: number): SessionOutput | null {
  if (!line.trim()) return null;
  try {
    const event = JSON.parse(line) as JsonlEvent;
    const outputType: OutputType = EVENT_TYPE_MAP[event.type] ?? 'message';
    return {
      id: randomUUID(),
      sessionId,
      timestamp: event.timestamp ?? new Date().toISOString(),
      type: outputType,
      content: typeof event.content === 'string' ? event.content : JSON.stringify(event),
      toolName: typeof event.tool_name === 'string' ? event.tool_name : null,
      sequenceNumber,
    };
  } catch {
    return null;
  }
}
