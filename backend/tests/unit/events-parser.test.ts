import { describe, it, expect } from 'vitest';
import { parseJsonlLine, parseModelFromEvent } from '../../src/services/events-parser.js';

// T008/T009 — 019 US2: mixed content-block array and multi-text-block joining
describe('EventsParser 019 US2 — content-block array edge cases', () => {
  it('T008: should skip non-text blocks in a mixed content-block array', () => {
    const line = JSON.stringify({
      type: 'assistant.message',
      id: 'evt-c',
      parentId: null,
      timestamp: '2024-01-01T00:00:00.000Z',
      data: {
        messageId: 'msg-2',
        content: [
          { type: 'text', text: 'Let me check.' },
          { type: 'tool_use', id: 'tc-1', name: 'bash', input: { command: 'ls' } },
        ],
        toolRequests: [],
      },
    });
    const result = parseJsonlLine(line, 'session-1', 1);
    expect(result?.content).toBe('Let me check.');
    expect(result?.content).not.toContain('tool_use');
    expect(result?.content).not.toContain('bash');
  });

  it('T009: should join multiple text blocks with newline', () => {
    const line = JSON.stringify({
      type: 'assistant.message',
      id: 'evt-d',
      parentId: null,
      timestamp: '2024-01-01T00:00:00.000Z',
      data: {
        messageId: 'msg-3',
        content: [
          { type: 'text', text: 'Part 1.' },
          { type: 'text', text: 'Part 2.' },
        ],
        toolRequests: [],
      },
    });
    const result = parseJsonlLine(line, 'session-1', 2);
    expect(result?.content).toBe('Part 1.\nPart 2.');
  });
});

// T001/T002/T003 — 019 regression tests: blank MSG rows for unknown event types and array content
describe('EventsParser 019 — blank MSG row fix', () => {
  it('T001b: should suppress assistant.message with null data.content (tool-call-only turn)', () => {
    const line = JSON.stringify({
      type: 'assistant.message',
      id: 'evt-y',
      parentId: null,
      timestamp: '2024-01-01T00:00:00.000Z',
      data: { messageId: 'msg-x', content: null, toolRequests: [{ toolCallId: 'tc-1', toolName: 'bash' }] },
    });
    const result = parseJsonlLine(line, 'session-1', 1);
    expect(result).toBeNull();
  });

  it('T001c: should suppress assistant.message with empty string data.content', () => {
    const line = JSON.stringify({
      type: 'assistant.message',
      id: 'evt-z',
      parentId: null,
      timestamp: '2024-01-01T00:00:00.000Z',
      data: { messageId: 'msg-y', content: '', toolRequests: [] },
    });
    const result = parseJsonlLine(line, 'session-1', 2);
    expect(result).toBeNull();
  });

  it('T001: should suppress unrecognised copilot event types (e.g. turn/interaction bookkeeping)', () => {
    const line = JSON.stringify({
      type: 'turn.start',
      id: 'evt-x',
      parentId: null,
      timestamp: '2024-01-01T00:00:00.000Z',
      data: { turnId: '10', interactionId: 'f82b5d1a-6bf0-4380-a957-a3ab00cb3715' },
    });
    const result = parseJsonlLine(line, 'session-1', 1);
    // Lifecycle/bookkeeping events with no human-readable content must be suppressed
    expect(result).toBeNull();
  });

  it('T002: should extract text from assistant.message with data.content as content-block array', () => {
    const line = JSON.stringify({
      type: 'assistant.message',
      id: 'evt-a',
      parentId: null,
      timestamp: '2024-01-01T00:00:00.000Z',
      data: {
        messageId: 'msg-1',
        content: [{ type: 'text', text: 'Here is my answer.' }],
        toolRequests: [],
      },
    });
    const result = parseJsonlLine(line, 'session-1', 2);
    expect(result).not.toBeNull();
    expect(result?.role).toBe('assistant');
    expect(result?.content).toBe('Here is my answer.');
  });

  it('T003: should extract text from user.message with data.content as content-block array', () => {
    const line = JSON.stringify({
      type: 'user.message',
      id: 'evt-b',
      parentId: null,
      timestamp: '2024-01-01T00:00:00.000Z',
      data: {
        content: [{ type: 'text', text: 'Fix the bug.' }],
        transformedContent: '',
        attachments: [],
      },
    });
    const result = parseJsonlLine(line, 'session-1', 3);
    expect(result).not.toBeNull();
    expect(result?.role).toBe('user');
    expect(result?.content).toBe('Fix the bug.');
  });
});

describe('EventsParser', () => {
  it('maps assistant.message to message type', () => {
    const line = JSON.stringify({
      type: 'assistant.message',
      timestamp: '2024-01-01T00:00:00.000Z',
      content: 'Hello!',
    });
    const result = parseJsonlLine(line, 'session-1', 1);
    expect(result).not.toBeNull();
    expect(result?.type).toBe('message');
    expect(result?.content).toBe('Hello!');
    expect(result?.sequenceNumber).toBe(1);
    expect(result?.role).toBe('assistant');
  });

  it('maps tool.execution_start to tool_use type', () => {
    const line = JSON.stringify({
      type: 'tool.execution_start',
      timestamp: '2024-01-01T00:00:00.000Z',
      tool_name: 'bash',
      content: 'Running bash command',
    });
    const result = parseJsonlLine(line, 'session-1', 2);
    expect(result?.type).toBe('tool_use');
    expect(result?.toolName).toBe('bash');
    expect(result?.role).toBeNull();
  });

  it('maps tool.execution_complete to tool_result type', () => {
    const line = JSON.stringify({
      type: 'tool.execution_complete',
      timestamp: '2024-01-01T00:00:00.000Z',
      content: 'Done',
    });
    const result = parseJsonlLine(line, 'session-1', 3);
    expect(result?.type).toBe('tool_result');
    expect(result?.role).toBeNull();
  });

  it('maps session.start to status_change type', () => {
    const line = JSON.stringify({
      type: 'session.start',
      timestamp: '2024-01-01T00:00:00.000Z',
      content: 'Session started',
    });
    const result = parseJsonlLine(line, 'session-1', 4);
    expect(result?.type).toBe('status_change');
    expect(result?.role).toBeNull();
  });

  it('maps user.message to message type', () => {
    const line = JSON.stringify({
      type: 'user.message',
      timestamp: '2024-01-01T00:00:00.000Z',
      content: 'User prompt',
    });
    const result = parseJsonlLine(line, 'session-1', 5);
    expect(result?.type).toBe('message');
    expect(result?.role).toBe('user');
  });

  it('suppresses unknown event types', () => {
    const line = JSON.stringify({
      type: 'unknown.event',
      timestamp: '2024-01-01T00:00:00.000Z',
      content: 'Unknown content',
    });
    const result = parseJsonlLine(line, 'session-1', 6);
    expect(result).toBeNull();
  });

  it('returns null for invalid JSON', () => {
    const result = parseJsonlLine('not-json', 'session-1', 7);
    expect(result).toBeNull();
  });

  it('returns null for empty line', () => {
    const result = parseJsonlLine('', 'session-1', 8);
    expect(result).toBeNull();
  });

  it('generates a UUID id', () => {
    const line = JSON.stringify({ type: 'assistant.message', timestamp: '2024-01-01T00:00:00.000Z', content: 'test' });
    const result = parseJsonlLine(line, 'session-1', 1);
    expect(result?.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  // T085 regression tests — tool events without a content field must not dump raw JSON
  it('should not dump raw JSON when tool event has no content field', () => {
    const line = JSON.stringify({
      type: 'tool.execution_start',
      timestamp: '2024-01-01T00:00:00.000Z',
      tool_name: 'file_editor',
      path: '/src/foo.ts',
      operation: 'read',
    });
    const result = parseJsonlLine(line, 'session-1', 9);
    // content must NOT contain the raw event fields already shown elsewhere
    expect(result?.content).not.toContain('"type"');
    expect(result?.content).not.toContain('"timestamp"');
    expect(result?.content).not.toContain('"tool_name"');
    // content SHOULD contain the meaningful remaining fields
    expect(result?.content).toContain('path');
    expect(result?.content).toContain('/src/foo.ts');
  });

  it('should return empty string when tool event has no content field and no extra fields', () => {
    const line = JSON.stringify({
      type: 'session.start',
      timestamp: '2024-01-01T00:00:00.000Z',
      tool_name: null,
    });
    const result = parseJsonlLine(line, 'session-1', 10);
    expect(result?.content).toBe('');
  });

  it('should use string value directly when single remaining field is a string', () => {
    const line = JSON.stringify({
      type: 'tool.execution_complete',
      timestamp: '2024-01-01T00:00:00.000Z',
      tool_name: 'bash',
      output: 'exit code 0',
    });
    const result = parseJsonlLine(line, 'session-1', 11);
    expect(result?.content).toBe('exit code 0');
  });
});

// T088 regression tests — real Copilot CLI events use nested data object
describe('EventsParser T088 — nested data format', () => {
  it('should extract content from user.message data.content', () => {
    const line = JSON.stringify({
      type: 'user.message',
      data: { content: 'hello world', transformedContent: 'expanded...', attachments: [] },
      id: 'abc', timestamp: '2024-01-01T00:00:00.000Z', parentId: null,
    });
    const result = parseJsonlLine(line, 'session-1', 1);
    expect(result?.content).toBe('hello world');
    expect(result?.role).toBe('user');
  });

  it('should extract content from assistant.message data.content', () => {
    const line = JSON.stringify({
      type: 'assistant.message',
      data: { messageId: 'msg-1', content: 'Here is my answer', toolRequests: [] },
      id: 'abc', timestamp: '2024-01-01T00:00:00.000Z', parentId: null,
    });
    const result = parseJsonlLine(line, 'session-1', 2);
    expect(result?.content).toBe('Here is my answer');
    expect(result?.role).toBe('assistant');
  });

  it('should extract toolName from tool.execution_start data.toolName', () => {
    const line = JSON.stringify({
      type: 'tool.execution_start',
      data: { toolCallId: 'tc-1', toolName: 'bash', arguments: { command: 'ls -la' } },
      id: 'abc', timestamp: '2024-01-01T00:00:00.000Z', parentId: null,
    });
    const result = parseJsonlLine(line, 'session-1', 3);
    expect(result?.toolName).toBe('bash');
    expect(result?.content).toBe('ls -la');
  });

  it('should extract result.content from tool.execution_complete', () => {
    const line = JSON.stringify({
      type: 'tool.execution_complete',
      data: { toolCallId: 'tc-1', model: 'gpt-4o', success: true, result: { content: 'Intent logged', detailedContent: 'Exploring codebase' } },
      id: 'abc', timestamp: '2024-01-01T00:00:00.000Z', parentId: null,
    });
    const result = parseJsonlLine(line, 'session-1', 4);
    expect(result?.content).toBe('Intent logged');
    expect(result?.type).toBe('tool_result');
  });

  it('should not show raw JSON for real Copilot CLI events', () => {
    const line = JSON.stringify({
      type: 'user.message',
      data: { content: 'my prompt', transformedContent: 'expanded', attachments: [] },
      id: 'evt-1', timestamp: '2024-01-01T00:00:00.000Z', parentId: null,
    });
    const result = parseJsonlLine(line, 'session-1', 5);
    expect(result?.content).not.toContain('"type"');
    expect(result?.content).not.toContain('"id"');
    expect(result?.content).not.toContain('"parentId"');
    expect(result?.content).toBe('my prompt');
  });
});

// T086 regression tests — model extraction from Copilot CLI events
describe('parseModelFromEvent', () => {
  it('should extract model from assistant.message event', () => {
    const line = JSON.stringify({
      type: 'assistant.message',
      timestamp: '2024-01-01T00:00:00.000Z',
      content: 'Hello!',
      model: 'gpt-4o',
    });
    expect(parseModelFromEvent(line)).toBe('gpt-4o');
  });

  it('should return null for non-assistant events', () => {
    const line = JSON.stringify({
      type: 'user.message',
      timestamp: '2024-01-01T00:00:00.000Z',
      content: 'Hello!',
      model: 'gpt-4o',
    });
    expect(parseModelFromEvent(line)).toBeNull();
  });

  it('should return null when assistant.message has no model field', () => {
    const line = JSON.stringify({
      type: 'assistant.message',
      timestamp: '2024-01-01T00:00:00.000Z',
      content: 'Hello!',
    });
    expect(parseModelFromEvent(line)).toBeNull();
  });

  it('should return null for non-string model field', () => {
    const line = JSON.stringify({
      type: 'assistant.message',
      timestamp: '2024-01-01T00:00:00.000Z',
      content: 'Hello!',
      model: 42,
    });
    expect(parseModelFromEvent(line)).toBeNull();
  });

  it('should extract model from tool.execution_complete data.model', () => {
    const line = JSON.stringify({
      type: 'tool.execution_complete',
      data: { toolCallId: 'tc-1', model: 'claude-sonnet-4.6', success: true, result: { content: 'done' } },
      id: 'abc', timestamp: '2024-01-01T00:00:00.000Z', parentId: null,
    });
    expect(parseModelFromEvent(line)).toBe('claude-sonnet-4.6');
  });

  it('should return null for empty line', () => {
    expect(parseModelFromEvent('')).toBeNull();
  });

  it('should return null for invalid JSON', () => {
    expect(parseModelFromEvent('not-json')).toBeNull();
  });
});

describe('EventsParser', () => {
  it('maps assistant.message to message type', () => {
    const line = JSON.stringify({
      type: 'assistant.message',
      timestamp: '2024-01-01T00:00:00.000Z',
      content: 'Hello!',
    });
    const result = parseJsonlLine(line, 'session-1', 1);
    expect(result).not.toBeNull();
    expect(result?.type).toBe('message');
    expect(result?.content).toBe('Hello!');
    expect(result?.sequenceNumber).toBe(1);
    expect(result?.role).toBe('assistant');
  });

  it('maps tool.execution_start to tool_use type', () => {
    const line = JSON.stringify({
      type: 'tool.execution_start',
      timestamp: '2024-01-01T00:00:00.000Z',
      tool_name: 'bash',
      content: 'Running bash command',
    });
    const result = parseJsonlLine(line, 'session-1', 2);
    expect(result?.type).toBe('tool_use');
    expect(result?.toolName).toBe('bash');
    expect(result?.role).toBeNull();
  });

  it('maps tool.execution_complete to tool_result type', () => {
    const line = JSON.stringify({
      type: 'tool.execution_complete',
      timestamp: '2024-01-01T00:00:00.000Z',
      content: 'Done',
    });
    const result = parseJsonlLine(line, 'session-1', 3);
    expect(result?.type).toBe('tool_result');
    expect(result?.role).toBeNull();
  });

  it('maps session.start to status_change type', () => {
    const line = JSON.stringify({
      type: 'session.start',
      timestamp: '2024-01-01T00:00:00.000Z',
      content: 'Session started',
    });
    const result = parseJsonlLine(line, 'session-1', 4);
    expect(result?.type).toBe('status_change');
    expect(result?.role).toBeNull();
  });

  it('maps user.message to message type', () => {
    const line = JSON.stringify({
      type: 'user.message',
      timestamp: '2024-01-01T00:00:00.000Z',
      content: 'User prompt',
    });
    const result = parseJsonlLine(line, 'session-1', 5);
    expect(result?.type).toBe('message');
    expect(result?.role).toBe('user');
  });

  it('suppresses unknown event types', () => {
    const line = JSON.stringify({
      type: 'unknown.event',
      timestamp: '2024-01-01T00:00:00.000Z',
      content: 'Unknown content',
    });
    const result = parseJsonlLine(line, 'session-1', 6);
    expect(result).toBeNull();
  });

  it('returns null for invalid JSON', () => {
    const result = parseJsonlLine('not-json', 'session-1', 7);
    expect(result).toBeNull();
  });

  it('returns null for empty line', () => {
    const result = parseJsonlLine('', 'session-1', 8);
    expect(result).toBeNull();
  });

  it('generates a UUID id', () => {
    const line = JSON.stringify({ type: 'assistant.message', timestamp: '2024-01-01T00:00:00.000Z', content: 'test' });
    const result = parseJsonlLine(line, 'session-1', 1);
    expect(result?.id).toMatch(/^[0-9a-f-]{36}$/);
  });
});
