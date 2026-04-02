import { describe, it, expect } from 'vitest';
import { parseJsonlLine, parseModelFromEvent } from '../../src/services/events-parser.js';

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

  it('maps unknown types to message', () => {
    const line = JSON.stringify({
      type: 'unknown.event',
      timestamp: '2024-01-01T00:00:00.000Z',
      content: 'Unknown content',
    });
    const result = parseJsonlLine(line, 'session-1', 6);
    expect(result?.type).toBe('message');
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

  it('maps unknown types to message', () => {
    const line = JSON.stringify({
      type: 'unknown.event',
      timestamp: '2024-01-01T00:00:00.000Z',
      content: 'Unknown content',
    });
    const result = parseJsonlLine(line, 'session-1', 6);
    expect(result?.type).toBe('message');
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
