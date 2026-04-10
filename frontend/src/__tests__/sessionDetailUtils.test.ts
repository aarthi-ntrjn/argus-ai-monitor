import { describe, it, expect } from 'vitest';
import { summariseToolUse, isAlwaysVisible, buildDisplayItems } from '../components/SessionDetail/sessionDetailUtils';
import type { SessionOutput } from '../types';

function output(overrides: Partial<SessionOutput>): SessionOutput {
  return {
    id: 'out-1',
    sessionId: 'session-1',
    timestamp: new Date().toISOString(),
    type: 'tool_use',
    content: '',
    toolName: null,
    toolCallId: null,
    role: null,
    sequenceNumber: 1,
    ...overrides,
  };
}

describe('summariseToolUse', () => {
  it('returns "ToolName: content" for plain string content', () => {
    const item = output({ toolName: 'Read', content: 'src/components/App.tsx' });
    expect(summariseToolUse(item)).toBe('Read: src/components/App.tsx');
  });

  it('returns "ToolName: content" for bash command', () => {
    const item = output({ toolName: 'Bash', content: 'npm run test' });
    expect(summariseToolUse(item)).toBe('Bash: npm run test');
  });

  it('truncates long content to 80 chars', () => {
    const longPath = 'a'.repeat(100);
    const item = output({ toolName: 'Read', content: longPath });
    const result = summariseToolUse(item);
    expect(result.length).toBeLessThanOrEqual(80);
    expect(result).toContain('...');
  });

  it('extracts path key from JSON content', () => {
    const item = output({ toolName: 'Edit', content: JSON.stringify({ path: 'src/App.tsx', old_str: 'foo', new_str: 'bar' }) });
    expect(summariseToolUse(item)).toBe('Edit: src/App.tsx');
  });

  it('extracts file_path key from JSON content', () => {
    const item = output({ toolName: 'Write', content: JSON.stringify({ file_path: 'src/main.ts', content: 'hello' }) });
    expect(summariseToolUse(item)).toBe('Write: src/main.ts');
  });

  it('extracts command key from JSON content', () => {
    const item = output({ toolName: 'Bash', content: JSON.stringify({ command: 'npm install' }) });
    expect(summariseToolUse(item)).toBe('Bash: npm install');
  });

  it('falls back to first 80 chars of raw content when JSON has no known key', () => {
    const item = output({ toolName: 'Search', content: JSON.stringify({ query: 'findAll', limit: 10 }) });
    const result = summariseToolUse(item);
    expect(result).toContain('Search:');
    expect(result.length).toBeLessThanOrEqual(80);
  });

  it('omits prefix when toolName is null', () => {
    const item = output({ toolName: null, content: 'some content' });
    expect(summariseToolUse(item)).toBe('some content');
  });

  it('handles empty content gracefully', () => {
    const item = output({ toolName: 'Read', content: '' });
    expect(summariseToolUse(item)).toBe('Read');
  });
});

describe('isAlwaysVisible', () => {
  it('returns true for error type', () => {
    expect(isAlwaysVisible(output({ type: 'error' }))).toBe(true);
  });

  it('returns true for status_change type', () => {
    expect(isAlwaysVisible(output({ type: 'status_change' }))).toBe(true);
  });

  it('returns false for tool_result type', () => {
    expect(isAlwaysVisible(output({ type: 'tool_result' }))).toBe(false);
  });

  it('returns true for message type', () => {
    expect(isAlwaysVisible(output({ type: 'message', role: 'user' }))).toBe(true);
  });

  it('returns true for tool_use type', () => {
    expect(isAlwaysVisible(output({ type: 'tool_use' }))).toBe(true);
  });
});

describe('buildDisplayItems', () => {
  it('verbose mode returns all items as singles', () => {
    const items = [
      output({ id: '1', type: 'tool_use', toolCallId: 'call-1' }),
      output({ id: '2', type: 'tool_result', toolCallId: 'call-1' }),
    ];
    const result = buildDisplayItems(items, false);
    expect(result).toHaveLength(2);
    expect(result[0].kind).toBe('single');
    expect(result[1].kind).toBe('single');
  });

  it('focused mode pairs tool_use and tool_result by toolCallId', () => {
    const toolUse = output({ id: '1', type: 'tool_use', toolCallId: 'call-1' });
    const toolResult = output({ id: '2', type: 'tool_result', toolCallId: 'call-1' });
    const result = buildDisplayItems([toolUse, toolResult], true);
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe('tool_pair');
    if (result[0].kind === 'tool_pair') {
      expect(result[0].toolUse.id).toBe('1');
      expect(result[0].toolResult.id).toBe('2');
    }
  });

  it('focused mode drops orphaned tool_result with no matching tool_use', () => {
    const items = [
      output({ id: '1', type: 'message', role: 'user', content: 'hello' }),
      output({ id: '2', type: 'tool_result', toolCallId: 'call-orphan' }),
    ];
    const result = buildDisplayItems(items, true);
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe('single');
    if (result[0].kind === 'single') expect(result[0].item.id).toBe('1');
  });

  it('focused mode emits unpaired tool_use (result not yet arrived) as single', () => {
    const items = [
      output({ id: '1', type: 'tool_use', toolCallId: 'call-pending' }),
    ];
    const result = buildDisplayItems(items, true);
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe('single');
  });

  it('focused mode pairs by ID even when not adjacent', () => {
    const toolUse = output({ id: '1', type: 'tool_use', toolCallId: 'call-1' });
    const message = output({ id: '2', type: 'message', role: 'assistant', content: 'thinking' });
    const toolResult = output({ id: '3', type: 'tool_result', toolCallId: 'call-1' });
    const result = buildDisplayItems([toolUse, message, toolResult], true);
    expect(result).toHaveLength(2);
    expect(result[0].kind).toBe('tool_pair');
    expect(result[1].kind).toBe('single');
  });

  it('focused mode handles null toolCallId: pairs adjacent tool_use + tool_result positionally', () => {
    const toolUse = output({ id: '1', type: 'tool_use', toolCallId: null });
    const toolResult = output({ id: '2', type: 'tool_result', toolCallId: null });
    const result = buildDisplayItems([toolUse, toolResult], true);
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe('tool_pair');
    if (result[0].kind === 'tool_pair') {
      expect(result[0].toolUse.id).toBe('1');
      expect(result[0].toolResult.id).toBe('2');
    }
  });

  it('focused mode groups 2+ consecutive tool_pairs into a tool_group', () => {
    const items = [
      output({ id: '1', type: 'tool_use', toolCallId: 'call-1' }),
      output({ id: '2', type: 'tool_result', toolCallId: 'call-1' }),
      output({ id: '3', type: 'tool_use', toolCallId: 'call-2' }),
      output({ id: '4', type: 'tool_result', toolCallId: 'call-2' }),
    ];
    const result = buildDisplayItems(items, true);
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe('tool_group');
    if (result[0].kind === 'tool_group') {
      expect(result[0].pairs).toHaveLength(2);
      expect(result[0].pairs[0].toolUse.id).toBe('1');
      expect(result[0].pairs[1].toolUse.id).toBe('3');
    }
  });

  it('focused mode keeps isolated tool_pair as tool_pair (not grouped)', () => {
    const items = [
      output({ id: '1', type: 'tool_use', toolCallId: 'call-1' }),
      output({ id: '2', type: 'tool_result', toolCallId: 'call-1' }),
    ];
    const result = buildDisplayItems(items, true);
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe('tool_pair');
  });

  it('focused mode splits groups broken by a message', () => {
    const items = [
      output({ id: '1', type: 'tool_use', toolCallId: 'call-1' }),
      output({ id: '2', type: 'tool_result', toolCallId: 'call-1' }),
      output({ id: '3', type: 'tool_use', toolCallId: 'call-2' }),
      output({ id: '4', type: 'tool_result', toolCallId: 'call-2' }),
      output({ id: '5', type: 'message', role: 'assistant', content: 'done' }),
      output({ id: '6', type: 'tool_use', toolCallId: 'call-3' }),
      output({ id: '7', type: 'tool_result', toolCallId: 'call-3' }),
      output({ id: '8', type: 'tool_use', toolCallId: 'call-4' }),
      output({ id: '9', type: 'tool_result', toolCallId: 'call-4' }),
    ];
    const result = buildDisplayItems(items, true);
    expect(result).toHaveLength(3);
    expect(result[0].kind).toBe('tool_group');
    expect(result[1].kind).toBe('single');
    expect(result[2].kind).toBe('tool_group');
  });
});
