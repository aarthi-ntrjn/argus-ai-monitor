import { describe, it, expect } from 'vitest';
import { parseClaudeJsonlLine, parseModel } from '../../src/services/claude-code-jsonl-parser.js';

const SESSION_ID = 'test-session-1';

function makeUserEntry(content: unknown): string {
  return JSON.stringify({
    type: 'user',
    uuid: 'uuid-1',
    parentUuid: null,
    isSidechain: false,
    timestamp: '2026-01-01T00:00:00.000Z',
    sessionId: SESSION_ID,
    cwd: 'C:\\test',
    message: { role: 'user', content },
  });
}

function makeAssistantEntry(content: unknown[], model = 'claude-haiku-4-5-20251001'): string {
  return JSON.stringify({
    type: 'assistant',
    uuid: 'uuid-2',
    parentUuid: null,
    isSidechain: false,
    timestamp: '2026-01-01T00:00:01.000Z',
    sessionId: SESSION_ID,
    cwd: 'C:\\test',
    message: { role: 'assistant', model, content, stop_reason: 'end_turn', id: 'msg_1', type: 'message' },
  });
}

describe('parseClaudeJsonlLine', () => {
  it('skips file-history-snapshot entries', () => {
    const line = JSON.stringify({ type: 'file-history-snapshot', messageId: '1', snapshot: {} });
    const result = parseClaudeJsonlLine(line, SESSION_ID, 1);
    expect(result).toEqual([]);
  });

  it('parses user entry with plain string content → message with role user', () => {
    const line = makeUserEntry('Hello world');
    const result = parseClaudeJsonlLine(line, SESSION_ID, 1);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('message');
    expect(result[0].role).toBe('user');
    expect(result[0].content).toBe('Hello world');
    expect(result[0].toolName).toBeNull();
    expect(result[0].sessionId).toBe(SESSION_ID);
    expect(result[0].sequenceNumber).toBe(1);
  });

  it('parses user entry with text block content → message with role user', () => {
    const line = makeUserEntry([{ type: 'text', text: 'User via text block' }]);
    const result = parseClaudeJsonlLine(line, SESSION_ID, 2);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('message');
    expect(result[0].role).toBe('user');
    expect(result[0].content).toBe('User via text block');
  });

  it('parses user entry with tool_result block → tool_result with role null', () => {
    const line = makeUserEntry([{ type: 'tool_result', tool_use_id: 'toolu_abc123', content: 'command output' }]);
    const result = parseClaudeJsonlLine(line, SESSION_ID, 3);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('tool_result');
    expect(result[0].role).toBeNull();
    expect(result[0].toolName).toBe('toolu_abc123');
    expect(result[0].content).toBe('command output');
  });

  it('parses assistant entry with text block → message with role assistant', () => {
    const line = makeAssistantEntry([{ type: 'text', text: 'I will help you.' }]);
    const result = parseClaudeJsonlLine(line, SESSION_ID, 4);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('message');
    expect(result[0].role).toBe('assistant');
    expect(result[0].content).toBe('I will help you.');
    expect(result[0].toolName).toBeNull();
  });

  it('parses assistant entry with tool_use block → tool_use with role null and toolName', () => {
    const line = makeAssistantEntry([{ type: 'tool_use', id: 'toolu_xyz', name: 'Bash', input: { command: 'ls -la' } }]);
    const result = parseClaudeJsonlLine(line, SESSION_ID, 5);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('tool_use');
    expect(result[0].role).toBeNull();
    expect(result[0].toolName).toBe('Bash');
    expect(result[0].content).toBe(JSON.stringify({ command: 'ls -la' }));
  });

  it('parses assistant entry with mixed text + tool_use blocks → two output items', () => {
    const line = makeAssistantEntry([
      { type: 'text', text: 'Running that now.' },
      { type: 'tool_use', id: 'toolu_xyz', name: 'Bash', input: { command: 'npm test' } },
    ]);
    const result = parseClaudeJsonlLine(line, SESSION_ID, 6);
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe('message');
    expect(result[0].role).toBe('assistant');
    expect(result[1].type).toBe('tool_use');
    expect(result[1].role).toBeNull();
  });

  it('returns empty array for malformed/partial JSON', () => {
    expect(parseClaudeJsonlLine('not json', SESSION_ID, 1)).toEqual([]);
    expect(parseClaudeJsonlLine('{incomplete', SESSION_ID, 1)).toEqual([]);
  });

  it('returns empty array for empty/whitespace line', () => {
    expect(parseClaudeJsonlLine('', SESSION_ID, 1)).toEqual([]);
    expect(parseClaudeJsonlLine('   ', SESSION_ID, 1)).toEqual([]);
  });

  it('includes isSidechain entries (subagent activity)', () => {
    const line = JSON.stringify({
      type: 'assistant',
      uuid: 'uuid-sub',
      parentUuid: 'uuid-root',
      isSidechain: true,
      timestamp: '2026-01-01T00:00:02.000Z',
      sessionId: SESSION_ID,
      cwd: 'C:\\test',
      message: {
        role: 'assistant', model: 'claude-haiku-4-5-20251001',
        content: [{ type: 'text', text: 'Subagent response' }],
        stop_reason: 'end_turn', id: 'msg_sub', type: 'message',
      },
    });
    const result = parseClaudeJsonlLine(line, SESSION_ID, 7);
    expect(result).toHaveLength(1);
    expect(result[0].role).toBe('assistant');
  });

  it('each returned item has a valid UUID id', () => {
    const line = makeUserEntry('test');
    const result = parseClaudeJsonlLine(line, SESSION_ID, 1);
    expect(result[0].id).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('parseModel', () => {
  it('returns model from first assistant entry', () => {
    const line = makeAssistantEntry([{ type: 'text', text: 'Hi' }], 'claude-sonnet-4-5');
    expect(parseModel(line)).toBe('claude-sonnet-4-5');
  });

  it('returns null for user entry', () => {
    const line = makeUserEntry('Hi');
    expect(parseModel(line)).toBeNull();
  });

  it('returns null for file-history-snapshot', () => {
    const line = JSON.stringify({ type: 'file-history-snapshot', messageId: '1', snapshot: {} });
    expect(parseModel(line)).toBeNull();
  });

  it('returns null for invalid JSON', () => {
    expect(parseModel('not json')).toBeNull();
  });
});
