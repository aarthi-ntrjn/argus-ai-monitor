import { randomUUID } from 'crypto';
import type { SessionOutput, OutputType, OutputRole } from '../models/index.js';

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

const EVENT_ROLE_MAP: Record<string, OutputRole | null> = {
  'assistant.message': 'assistant',
  'user.message': 'user',
};

function extractContent(event: JsonlEvent): string {
  if (typeof event.content === 'string') return event.content;
  // Strip fields already shown elsewhere; stringify only the remaining meaningful data
  const { type: _t, timestamp: _ts, tool_name: _tn, content: _c, ...rest } = event;
  const keys = Object.keys(rest);
  if (keys.length === 0) return '';
  if (keys.length === 1) {
    const val = rest[keys[0]];
    return typeof val === 'string' ? val : JSON.stringify(val);
  }
  return JSON.stringify(rest);
}

export function parseModelFromEvent(line: string): string | null {
  if (!line.trim()) return null;
  try {
    const event = JSON.parse(line) as JsonlEvent;
    if (event.type === 'assistant.message' && typeof event.model === 'string') {
      return event.model;
    }
    return null;
  } catch { return null; }
}

export function parseJsonlLine(line: string, sessionId: string, sequenceNumber: number): SessionOutput | null {
  if (!line.trim()) return null;
  try {
    const event = JSON.parse(line) as JsonlEvent;
    const outputType: OutputType = EVENT_TYPE_MAP[event.type] ?? 'message';
    const role: OutputRole | null = event.type in EVENT_ROLE_MAP ? EVENT_ROLE_MAP[event.type] : null;
    return {
      id: randomUUID(),
      sessionId,
      timestamp: event.timestamp ?? new Date().toISOString(),
      type: outputType,
      content: extractContent(event),
      toolName: typeof event.tool_name === 'string' ? event.tool_name : null,
      role,
      sequenceNumber,
    };
  } catch {
    return null;
  }
}
