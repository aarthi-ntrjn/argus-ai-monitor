import { randomUUID } from 'crypto';
import type { SessionOutput, OutputType, OutputRole } from '../models/index.js';

interface JsonlEvent {
  type: string;
  timestamp?: string;
  content?: string;
  tool_name?: string;
  data?: Record<string, unknown>;
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
  const data = event.data;

  if (data) {
    // Messages: plain string content
    if (typeof data.content === 'string' && data.content) return data.content;

    // Tool execution start: show arguments
    if (event.type === 'tool.execution_start' && data.arguments != null) {
      if (typeof data.arguments === 'string') return data.arguments;
      const args = data.arguments as Record<string, unknown>;
      const vals = Object.values(args);
      if (vals.length === 1 && typeof vals[0] === 'string') return vals[0];
      return JSON.stringify(args);
    }

    // Tool execution complete: show result content
    if (event.type === 'tool.execution_complete' && data.result != null) {
      const result = data.result as Record<string, unknown>;
      if (typeof result.content === 'string') return result.content;
      if (typeof result.detailedContent === 'string') return result.detailedContent;
      return JSON.stringify(result);
    }
  }

  // Flat format (legacy/test): content at top level
  if (typeof event.content === 'string') return event.content;

  // Flat format fallback: strip known meta fields, serialize rest
  const { type: _t, timestamp: _ts, tool_name: _tn, content: _c, data: _d, id: _id, parentId: _pid, ...rest } = event;
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
    // Flat format: model on assistant.message
    if (event.type === 'assistant.message' && typeof event.model === 'string') return event.model;
    // Nested format: model on tool.execution_complete data.model (real CLI events)
    if (event.type === 'tool.execution_complete' && event.data && typeof event.data.model === 'string') return event.data.model;
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
      toolName: typeof event.tool_name === 'string' ? event.tool_name
              : typeof event.data?.toolName === 'string' ? event.data.toolName
              : null,
      role,
      sequenceNumber,
    };
  } catch {
    return null;
  }
}
