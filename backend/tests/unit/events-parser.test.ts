import { describe, it, expect } from 'vitest';
import { parseJsonlLine } from '../../src/services/events-parser.js';

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
  });

  it('maps tool.execution_complete to tool_result type', () => {
    const line = JSON.stringify({
      type: 'tool.execution_complete',
      timestamp: '2024-01-01T00:00:00.000Z',
      content: 'Done',
    });
    const result = parseJsonlLine(line, 'session-1', 3);
    expect(result?.type).toBe('tool_result');
  });

  it('maps session.start to status_change type', () => {
    const line = JSON.stringify({
      type: 'session.start',
      timestamp: '2024-01-01T00:00:00.000Z',
      content: 'Session started',
    });
    const result = parseJsonlLine(line, 'session-1', 4);
    expect(result?.type).toBe('status_change');
  });

  it('maps user.message to message type', () => {
    const line = JSON.stringify({
      type: 'user.message',
      timestamp: '2024-01-01T00:00:00.000Z',
      content: 'User prompt',
    });
    const result = parseJsonlLine(line, 'session-1', 5);
    expect(result?.type).toBe('message');
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
