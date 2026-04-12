import { describe, it, expect } from 'vitest';
import { isInactive, INACTIVE_THRESHOLD_MS, detectPendingChoice } from '../utils/sessionUtils';
import type { Session, SessionOutput } from '../types';

function session(overrides: Partial<Session> = {}): Session {
  return {
    id: 'test-id',
    repositoryId: 'repo-1',
    type: 'claude-code',
    launchMode: null,
    pid: null,
    pidSource: null,
    status: 'active',
    startedAt: new Date().toISOString(),
    endedAt: null,
    lastActivityAt: new Date().toISOString(),
    summary: null,
    expiresAt: null,
    model: null,
    yoloMode: false,
    ...overrides,
  };
}

const OLD = new Date(Date.now() - INACTIVE_THRESHOLD_MS - 60_000).toISOString();
const RECENT = new Date(Date.now() - 30_000).toISOString();

describe('isInactive', () => {
  it('returns false for a completed session even if lastActivityAt is very old', () => {
    expect(isInactive(session({ status: 'completed', lastActivityAt: OLD }))).toBe(false);
  });

  it('returns false for an ended session even if lastActivityAt is very old', () => {
    expect(isInactive(session({ status: 'ended', lastActivityAt: OLD }))).toBe(false);
  });

  it('returns false when the session had activity within the last 30 seconds', () => {
    expect(isInactive(session({ lastActivityAt: RECENT }))).toBe(false);
  });

  it('returns true when activity is more than 20 minutes ago', () => {
    expect(isInactive(session({ lastActivityAt: OLD }))).toBe(true);
  });

  it('returns false when activity is exactly at the threshold boundary (strict >)', () => {
    const atThreshold = new Date(Date.now() - INACTIVE_THRESHOLD_MS).toISOString();
    expect(isInactive(session({ lastActivityAt: atThreshold }))).toBe(false);
  });

  // T024: idle is not a terminal status — time-based "resting" check applies the same as active
  it('T024: returns true for idle status sessions when lastActivityAt is very old', () => {
    expect(isInactive(session({ status: 'idle', lastActivityAt: OLD }))).toBe(true);
  });

  it('returns true for waiting status sessions that exceed the threshold', () => {
    expect(isInactive(session({ status: 'waiting', lastActivityAt: OLD }))).toBe(true);
  });

  describe('custom thresholdMs', () => {
    it('returns true when last activity exceeds a custom short threshold (5 min)', () => {
      const fiveMinAgo = new Date(Date.now() - 5 * 60_000 - 1_000).toISOString();
      expect(isInactive(session({ lastActivityAt: fiveMinAgo }), 5 * 60_000)).toBe(true);
    });

    it('returns false when last activity is within a custom short threshold (5 min)', () => {
      const threeMinAgo = new Date(Date.now() - 3 * 60_000).toISOString();
      expect(isInactive(session({ lastActivityAt: threeMinAgo }), 5 * 60_000)).toBe(false);
    });

    it('returns false for activity > 20 min ago when a longer threshold (60 min) is given', () => {
      const twentyFiveMinAgo = new Date(Date.now() - 25 * 60_000).toISOString();
      expect(isInactive(session({ lastActivityAt: twentyFiveMinAgo }), 60 * 60_000)).toBe(false);
    });

    it('uses default 20-min threshold when no thresholdMs arg is passed', () => {
      const twentyOneMinAgo = new Date(Date.now() - 21 * 60_000).toISOString();
      expect(isInactive(session({ lastActivityAt: twentyOneMinAgo }))).toBe(true);
    });
  });
});

function makeOutput(overrides: Partial<SessionOutput>): SessionOutput {
  return {
    id: 'out-1',
    sessionId: 'sess-1',
    timestamp: new Date().toISOString(),
    type: 'message',
    content: '',
    toolName: null,
    toolCallId: null,
    role: 'assistant',
    sequenceNumber: 1,
    ...overrides,
  };
}

describe('detectPendingChoice', () => {
  it('returns null for empty items array', () => {
    expect(detectPendingChoice([])).toBeNull();
  });

  it('returns null when no ask_user or AskUserQuestion tool_use exists', () => {
    const items = [
      makeOutput({ type: 'message', role: 'user', content: 'hi', sequenceNumber: 1 }),
      makeOutput({ type: 'tool_use', toolName: 'Bash', content: '{}', sequenceNumber: 2 }),
      makeOutput({ type: 'tool_result', content: 'done', sequenceNumber: 3 }),
    ];
    expect(detectPendingChoice(items)).toBeNull();
  });

  it('returns PendingChoice with question and choices for unanswered ask_user (Copilot)', () => {
    const content = JSON.stringify({ question: 'Which option?', choices: ['A', 'B', 'C'] });
    const items = [
      makeOutput({ type: 'tool_use', toolName: 'ask_user', toolCallId: 'tc-1', content, sequenceNumber: 5 }),
    ];
    const result = detectPendingChoice(items);
    expect(result).not.toBeNull();
    expect(result?.question).toBe('Which option?');
    expect(result?.choices).toEqual(['A', 'B', 'C']);
  });

  it('returns PendingChoice with question and empty choices for unanswered AskUserQuestion (Claude, flat format)', () => {
    const content = JSON.stringify({ question: 'What directory?' });
    const items = [
      makeOutput({ type: 'tool_use', toolName: 'AskUserQuestion', toolCallId: 'tc-2', content, sequenceNumber: 3 }),
    ];
    const result = detectPendingChoice(items);
    expect(result).not.toBeNull();
    expect(result?.question).toBe('What directory?');
    expect(result?.choices).toEqual([]);
  });

  it('returns PendingChoice with question and label-extracted choices for AskUserQuestion nested format', () => {
    const content = JSON.stringify({
      questions: [{
        question: 'Which color do you prefer?',
        header: 'Color',
        multiSelect: false,
        options: [
          { label: 'Red', description: 'Bold, passionate, fiery red' },
          { label: 'Blue', description: 'Calm, cool, serene blue' },
        ],
      }],
    });
    const items = [
      makeOutput({ type: 'tool_use', toolName: 'AskUserQuestion', toolCallId: 'tc-6', content, sequenceNumber: 5 }),
    ];
    const result = detectPendingChoice(items);
    expect(result).not.toBeNull();
    expect(result?.question).toBe('Which color do you prefer?');
    expect(result?.choices).toEqual(['Red', 'Blue']);
  });

  it('returns null when ask_user tool_use has a subsequent tool_result', () => {
    const content = JSON.stringify({ question: 'Which?', choices: ['X', 'Y'] });
    const items = [
      makeOutput({ type: 'tool_use', toolName: 'ask_user', toolCallId: 'tc-3', content, sequenceNumber: 4 }),
      makeOutput({ type: 'tool_result', toolCallId: 'tc-3', content: 'X', sequenceNumber: 5 }),
    ];
    expect(detectPendingChoice(items)).toBeNull();
  });

  it('returns PendingChoice with empty question and choices when tool input is malformed JSON', () => {
    const items = [
      makeOutput({ type: 'tool_use', toolName: 'ask_user', content: 'not-json', sequenceNumber: 2 }),
    ];
    const result = detectPendingChoice(items);
    expect(result).not.toBeNull();
    expect(result?.question).toBe('');
    expect(result?.choices).toEqual([]);
  });

  it('returns null when tool_result with higher sequenceNumber exists even without matching toolCallId', () => {
    const content = JSON.stringify({ question: 'Pick one', choices: ['1', '2'] });
    const items = [
      makeOutput({ type: 'tool_use', toolName: 'ask_user', toolCallId: 'tc-5', content, sequenceNumber: 3 }),
      makeOutput({ type: 'tool_result', toolCallId: 'tc-5', content: '1', sequenceNumber: 7 }),
    ];
    expect(detectPendingChoice(items)).toBeNull();
  });
});
