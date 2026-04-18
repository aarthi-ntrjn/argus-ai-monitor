import { describe, it, expect } from 'vitest';
import { findPendingQuestion } from '../../src/services/pending-question.js';
import type { SessionOutput } from '../../src/models/index.js';

function makeOutput(overrides: Partial<SessionOutput>): SessionOutput {
  return {
    id: 'id',
    sessionId: 'session-1',
    timestamp: '',
    type: 'message',
    content: '',
    toolName: null,
    toolCallId: null,
    role: null,
    sequenceNumber: 1,
    ...overrides,
  };
}

describe('findPendingQuestion', () => {
  it('returns null for an empty batch', () => {
    expect(findPendingQuestion([])).toBeNull();
  });

  it('returns null when no question tool_use exists', () => {
    const outputs = [
      makeOutput({ type: 'tool_use', toolName: 'Bash', content: '{}', sequenceNumber: 1 }),
      makeOutput({ type: 'tool_result', content: 'ok', sequenceNumber: 2 }),
    ];
    expect(findPendingQuestion(outputs)).toBeNull();
  });

  it('returns question for AskUserQuestion flat format (Claude Code)', () => {
    const outputs = [
      makeOutput({
        type: 'tool_use', toolName: 'AskUserQuestion', toolCallId: 'tc-1',
        content: JSON.stringify({ question: 'What directory?' }), sequenceNumber: 1,
      }),
    ];
    const result = findPendingQuestion(outputs);
    expect(result).not.toBeNull();
    expect(result?.question).toBe('What directory?');
    expect(result?.choices).toEqual([]);
  });

  it('returns question and choices for ask_user format (Copilot)', () => {
    const outputs = [
      makeOutput({
        type: 'tool_use', toolName: 'ask_user', toolCallId: 'tc-2',
        content: JSON.stringify({ question: 'Which option?', choices: ['A', 'B', 'C'] }), sequenceNumber: 1,
      }),
    ];
    const result = findPendingQuestion(outputs);
    expect(result?.question).toBe('Which option?');
    expect(result?.choices).toEqual(['A', 'B', 'C']);
  });

  it('returns question and label-extracted choices for AskUserQuestion nested format', () => {
    const outputs = [
      makeOutput({
        type: 'tool_use', toolName: 'AskUserQuestion', toolCallId: 'tc-3',
        content: JSON.stringify({
          questions: [{ question: 'Which color?', options: [{ label: 'Red' }, { label: 'Blue' }] }],
        }), sequenceNumber: 1,
      }),
    ];
    const result = findPendingQuestion(outputs);
    expect(result?.question).toBe('Which color?');
    expect(result?.choices).toEqual(['Red', 'Blue']);
  });

  it('returns null when the question already has a tool_result (already answered)', () => {
    const outputs = [
      makeOutput({
        type: 'tool_use', toolName: 'AskUserQuestion', toolCallId: 'tc-4',
        content: JSON.stringify({ question: 'Done?' }), sequenceNumber: 1,
      }),
      makeOutput({ type: 'tool_result', toolCallId: 'tc-4', content: 'yes', sequenceNumber: 2 }),
    ];
    expect(findPendingQuestion(outputs)).toBeNull();
  });

  it('returns the last unanswered question when multiple tool_use items exist', () => {
    const outputs = [
      makeOutput({
        type: 'tool_use', toolName: 'AskUserQuestion', toolCallId: 'tc-5',
        content: JSON.stringify({ question: 'First?' }), sequenceNumber: 1,
      }),
      makeOutput({ type: 'tool_result', toolCallId: 'tc-5', content: 'no', sequenceNumber: 2 }),
      makeOutput({
        type: 'tool_use', toolName: 'AskUserQuestion', toolCallId: 'tc-6',
        content: JSON.stringify({ question: 'Second?' }), sequenceNumber: 3,
      }),
    ];
    const result = findPendingQuestion(outputs);
    expect(result?.question).toBe('Second?');
  });
});
