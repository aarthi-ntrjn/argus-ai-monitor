import { randomUUID } from 'crypto';
import type { SessionOutput, OutputRole } from '../models/index.js';

interface ContentBlock {
  type: string;
  text?: string;
  tool_use_id?: string;
  content?: unknown;
  id?: string;
  name?: string;
  input?: unknown;
}

interface ClaudeEntry {
  type: 'user' | 'assistant' | 'file-history-snapshot' | string;
  uuid: string;
  timestamp?: string;
  sessionId?: string;
  isSidechain?: boolean;
  isMeta?: boolean;
  message?: {
    role?: string;
    model?: string;
    content?: string | ContentBlock[];
  };
}

function stringifyContent(content: unknown): string {
  if (typeof content === 'string') return content;
  return JSON.stringify(content);
}

function parseUserEntry(entry: ClaudeEntry, sessionId: string, sequenceNumber: number, makeId?: (blockIndex: number) => string): SessionOutput[] {
  const content = entry.message?.content;
  const timestamp = entry.timestamp ?? new Date().toISOString();
  const isMeta = entry.isMeta === true ? true : undefined;
  const results: SessionOutput[] = [];
  let blockIndex = 0;
  const nextId = () => makeId ? makeId(blockIndex++) : randomUUID();

  if (typeof content === 'string') {
    results.push({
      id: nextId(), sessionId, timestamp,
      type: 'message', role: 'user', content, toolName: null, toolCallId: null, sequenceNumber, isMeta,
    });
    return results;
  }

  if (!Array.isArray(content)) {
    results.push({
      id: nextId(), sessionId, timestamp,
      type: 'message', role: 'user', content: '', toolName: null, toolCallId: null, sequenceNumber, isMeta,
    });
    return results;
  }

  for (const block of content) {
    if (block.type === 'text') {
      results.push({
        id: nextId(), sessionId, timestamp,
        type: 'message', role: 'user', content: block.text ?? '', toolName: null, toolCallId: null, sequenceNumber, isMeta,
      });
    } else if (block.type === 'tool_result') {
      results.push({
        id: nextId(), sessionId, timestamp,
        type: 'tool_result', role: null,
        content: stringifyContent(block.content),
        toolName: null,
        toolCallId: block.tool_use_id ?? null,
        sequenceNumber,
      });
    }
  }

  return results;
}

function parseAssistantEntry(entry: ClaudeEntry, sessionId: string, sequenceNumber: number, makeId?: (blockIndex: number) => string): SessionOutput[] {
  const content = entry.message?.content;
  const timestamp = entry.timestamp ?? new Date().toISOString();
  const results: SessionOutput[] = [];
  let blockIndex = 0;
  const nextId = () => makeId ? makeId(blockIndex++) : randomUUID();

  if (!Array.isArray(content)) return results;

  for (const block of content) {
    if (block.type === 'text') {
      results.push({
        id: nextId(), sessionId, timestamp,
        type: 'message', role: 'assistant' as OutputRole, content: block.text ?? '', toolName: null, toolCallId: null, sequenceNumber,
      });
    } else if (block.type === 'tool_use') {
      results.push({
        id: nextId(), sessionId, timestamp,
        type: 'tool_use', role: null,
        content: JSON.stringify(block.input ?? {}),
        toolName: block.name ?? null,
        toolCallId: block.id ?? null,
        sequenceNumber,
      });
    }
  }

  return results;
}

/**
 * Parse a single line from a Claude Code JSONL conversation file.
 * Returns an array because one entry (e.g. assistant with text + tool_use) can yield multiple outputs.
 */
export function parseClaudeJsonlLine(line: string, sessionId: string, sequenceNumber: number, makeId?: (blockIndex: number) => string): SessionOutput[] {
  if (!line.trim()) return [];
  try {
    const entry = JSON.parse(line) as ClaudeEntry;
    if (entry.type === 'file-history-snapshot') return [];
    if (entry.type === 'user') return parseUserEntry(entry, sessionId, sequenceNumber, makeId);
    if (entry.type === 'assistant') return parseAssistantEntry(entry, sessionId, sequenceNumber, makeId);
    return [];
  } catch {
    return [];
  }
}

/**
 * Extract model name from a JSONL line. Returns the model string from the first assistant entry found,
 * or null if this line is not an assistant entry or has no model.
 */
export function parseModel(line: string): string | null {
  if (!line.trim()) return null;
  try {
    const entry = JSON.parse(line) as ClaudeEntry;
    if (entry.type === 'assistant' && entry.message?.model) return entry.message.model;
    return null;
  } catch {
    return null;
  }
}

