import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePromptHistory } from '../hooks/usePromptHistory';
import type { SessionOutput } from '../types';

function makeOutput(overrides: Partial<SessionOutput> = {}): SessionOutput {
  return {
    id: 'o1',
    sessionId: 'session-1',
    timestamp: new Date().toISOString(),
    type: 'message',
    content: 'hello',
    toolName: null,
    toolCallId: null,
    role: 'user',
    sequenceNumber: 1,
    isMeta: false,
    ...overrides,
  };
}

const NO_OUTPUT: SessionOutput[] = [];

// ---------------------------------------------------------------------------
// navigateUp
// ---------------------------------------------------------------------------

describe('usePromptHistory — navigateUp', () => {
  it('returns currentInput unchanged when no entries exist', () => {
    const { result } = renderHook(() => usePromptHistory('s1', NO_OUTPUT));
    let returned: string = '';
    act(() => { returned = result.current.navigateUp('my draft'); });
    expect(returned).toBe('my draft');
    expect(result.current.isNavigating).toBe(false);
  });

  it('sets isNavigating to true after first up press when entries exist', () => {
    const { result } = renderHook(() => usePromptHistory('s1', NO_OUTPUT));
    act(() => { result.current.addEntry('first'); });
    act(() => { result.current.navigateUp(''); });
    expect(result.current.isNavigating).toBe(true);
  });

  it('returns most recent entry on first up press', () => {
    const { result } = renderHook(() => usePromptHistory('s1', NO_OUTPUT));
    act(() => {
      result.current.addEntry('first');
      result.current.addEntry('second');
    });
    let returned: string = '';
    act(() => { returned = result.current.navigateUp(''); });
    expect(returned).toBe('second');
  });

  it('returns older entries on subsequent up presses', () => {
    const { result } = renderHook(() => usePromptHistory('s1', NO_OUTPUT));
    act(() => {
      result.current.addEntry('first');
      result.current.addEntry('second');
      result.current.addEntry('third');
    });
    const results: string[] = [];
    act(() => { results.push(result.current.navigateUp('')); });
    act(() => { results.push(result.current.navigateUp('')); });
    act(() => { results.push(result.current.navigateUp('')); });
    expect(results).toEqual(['third', 'second', 'first']);
  });

  it('is a no-op when already at oldest entry', () => {
    const { result } = renderHook(() => usePromptHistory('s1', NO_OUTPUT));
    act(() => { result.current.addEntry('only'); });
    let r1: string = '', r2: string = '';
    act(() => { r1 = result.current.navigateUp(''); });
    act(() => { r2 = result.current.navigateUp(''); });
    expect(r1).toBe('only');
    expect(r2).toBe('only');
  });
});

// ---------------------------------------------------------------------------
// navigateDown
// ---------------------------------------------------------------------------

describe('usePromptHistory — navigateDown', () => {
  it('returns empty string and stays non-navigating when called without navigating first', () => {
    const { result } = renderHook(() => usePromptHistory('s1', NO_OUTPUT));
    let returned: string = 'untouched';
    act(() => { returned = result.current.navigateDown(); });
    expect(returned).toBe('');
    expect(result.current.isNavigating).toBe(false);
  });

  it('moves toward newest when called after navigating up twice', () => {
    const { result } = renderHook(() => usePromptHistory('s1', NO_OUTPUT));
    act(() => {
      result.current.addEntry('first');
      result.current.addEntry('second');
    });
    act(() => { result.current.navigateUp(''); });
    act(() => { result.current.navigateUp(''); });
    let returned: string = '';
    act(() => { returned = result.current.navigateDown(); });
    expect(returned).toBe('second');
  });

  it('returns the saved draft and resets isNavigating when called past newest', () => {
    const { result } = renderHook(() => usePromptHistory('s1', NO_OUTPUT));
    act(() => { result.current.addEntry('one'); });
    act(() => { result.current.navigateUp('my draft text'); });
    let returned: string = '';
    act(() => { returned = result.current.navigateDown(); });
    expect(returned).toBe('my draft text');
    expect(result.current.isNavigating).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Draft preservation
// ---------------------------------------------------------------------------

describe('usePromptHistory — draft preservation', () => {
  it('saves the currentInput passed to the first navigateUp call', () => {
    const { result } = renderHook(() => usePromptHistory('s1', NO_OUTPUT));
    act(() => { result.current.addEntry('sent'); });
    act(() => { result.current.navigateUp('half-typed text'); });
    let returned: string = '';
    act(() => { returned = result.current.navigateDown(); });
    expect(returned).toBe('half-typed text');
  });

  it('restores empty string draft when input was empty before navigation', () => {
    const { result } = renderHook(() => usePromptHistory('s1', NO_OUTPUT));
    act(() => { result.current.addEntry('sent'); });
    act(() => { result.current.navigateUp(''); });
    let returned: string = '';
    act(() => { returned = result.current.navigateDown(); });
    expect(returned).toBe('');
  });

  it('does not change the draft if navigateUp is called again while already navigating', () => {
    const { result } = renderHook(() => usePromptHistory('s1', NO_OUTPUT));
    act(() => {
      result.current.addEntry('first');
      result.current.addEntry('second');
    });
    act(() => { result.current.navigateUp('original draft'); });
    act(() => { result.current.navigateUp('this should not replace draft'); });
    let returned: string = '';
    act(() => { returned = result.current.navigateDown(); });
    act(() => { returned = result.current.navigateDown(); });
    expect(returned).toBe('original draft');
  });
});

// ---------------------------------------------------------------------------
// addEntry
// ---------------------------------------------------------------------------

describe('usePromptHistory — addEntry', () => {
  it('adds text to history so it appears on next navigateUp', () => {
    const { result } = renderHook(() => usePromptHistory('s1', NO_OUTPUT));
    act(() => { result.current.addEntry('hello'); });
    let returned: string = '';
    act(() => { returned = result.current.navigateUp(''); });
    expect(returned).toBe('hello');
  });

  it('resets isNavigating to false after adding an entry', () => {
    const { result } = renderHook(() => usePromptHistory('s1', NO_OUTPUT));
    act(() => { result.current.addEntry('one'); });
    act(() => { result.current.navigateUp(''); });
    expect(result.current.isNavigating).toBe(true);
    act(() => { result.current.addEntry('two'); });
    expect(result.current.isNavigating).toBe(false);
  });

  it('caps entries at 50, dropping the oldest', () => {
    const { result } = renderHook(() => usePromptHistory('s1', NO_OUTPUT));
    act(() => {
      for (let i = 1; i <= 51; i++) {
        result.current.addEntry(`msg-${i}`);
      }
    });
    // Navigate to oldest — should be msg-2 (msg-1 was dropped)
    const results: string[] = [];
    act(() => {
      for (let i = 0; i < 50; i++) {
        results.push(result.current.navigateUp(''));
      }
    });
    expect(results[49]).toBe('msg-2');
    expect(results.includes('msg-1')).toBe(false);
  });

  it('does not add empty or whitespace-only strings', () => {
    const { result } = renderHook(() => usePromptHistory('s1', NO_OUTPUT));
    act(() => { result.current.addEntry('  '); });
    let returned: string = '';
    act(() => { returned = result.current.navigateUp('my draft'); });
    expect(returned).toBe('my draft');
    expect(result.current.isNavigating).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// indicator
// ---------------------------------------------------------------------------

describe('usePromptHistory — indicator', () => {
  it('is null when not navigating', () => {
    const { result } = renderHook(() => usePromptHistory('s1', NO_OUTPUT));
    expect(result.current.indicator).toBeNull();
  });

  it('shows "1 / N" when at the most recent entry', () => {
    const { result } = renderHook(() => usePromptHistory('s1', NO_OUTPUT));
    act(() => {
      result.current.addEntry('a');
      result.current.addEntry('b');
      result.current.addEntry('c');
    });
    act(() => { result.current.navigateUp(''); });
    expect(result.current.indicator).toBe('1 / 3');
  });

  it('shows "N / N" when at the oldest entry', () => {
    const { result } = renderHook(() => usePromptHistory('s1', NO_OUTPUT));
    act(() => {
      result.current.addEntry('a');
      result.current.addEntry('b');
    });
    act(() => { result.current.navigateUp(''); });
    act(() => { result.current.navigateUp(''); });
    expect(result.current.indicator).toBe('2 / 2');
  });

  it('returns to null after navigating back to draft', () => {
    const { result } = renderHook(() => usePromptHistory('s1', NO_OUTPUT));
    act(() => { result.current.addEntry('one'); });
    act(() => { result.current.navigateUp(''); });
    expect(result.current.indicator).not.toBeNull();
    act(() => { result.current.navigateDown(); });
    expect(result.current.indicator).toBeNull();
  });

  it('returns to null after addEntry (send)', () => {
    const { result } = renderHook(() => usePromptHistory('s1', NO_OUTPUT));
    act(() => { result.current.addEntry('one'); });
    act(() => { result.current.navigateUp(''); });
    act(() => { result.current.addEntry('two'); });
    expect(result.current.indicator).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Terminal message backfill (sessionOutputItems on mount)
// ---------------------------------------------------------------------------

describe('usePromptHistory — backfill from sessionOutputItems', () => {
  it('seeds history from user messages in sessionOutputItems', () => {
    const items: SessionOutput[] = [
      makeOutput({ id: 'o1', content: 'terminal msg 1', sequenceNumber: 1 }),
      makeOutput({ id: 'o2', content: 'terminal msg 2', sequenceNumber: 2 }),
    ];
    const { result } = renderHook(() => usePromptHistory('s1', items));
    let r1: string = '', r2: string = '';
    act(() => { r1 = result.current.navigateUp(''); });
    act(() => { r2 = result.current.navigateUp(''); });
    expect(r1).toBe('terminal msg 2');
    expect(r2).toBe('terminal msg 1');
  });

  it('excludes isMeta entries from backfill', () => {
    const items: SessionOutput[] = [
      makeOutput({ id: 'o1', content: 'real msg', sequenceNumber: 1, isMeta: false }),
      makeOutput({ id: 'o2', content: 'meta msg', sequenceNumber: 2, isMeta: true }),
    ];
    const { result } = renderHook(() => usePromptHistory('s1', items));
    let returned: string = '';
    act(() => { returned = result.current.navigateUp(''); });
    act(() => { returned = result.current.navigateUp(''); });
    expect(returned).toBe('real msg');
  });

  it('excludes assistant messages from backfill', () => {
    const items: SessionOutput[] = [
      makeOutput({ id: 'o1', content: 'user says', sequenceNumber: 1, role: 'user' }),
      makeOutput({ id: 'o2', content: 'assistant says', sequenceNumber: 2, role: 'assistant' }),
    ];
    const { result } = renderHook(() => usePromptHistory('s1', items));
    let r1: string = '', r2: string = '';
    act(() => { r1 = result.current.navigateUp(''); });
    act(() => { r2 = result.current.navigateUp(''); });
    expect(r1).toBe('user says');
    expect(r2).toBe('user says'); // no older entry — no-op
  });

  it('excludes empty-content entries', () => {
    const items: SessionOutput[] = [
      makeOutput({ id: 'o1', content: 'real', sequenceNumber: 1 }),
      makeOutput({ id: 'o2', content: '   ', sequenceNumber: 2 }),
    ];
    const { result } = renderHook(() => usePromptHistory('s1', items));
    let r1: string = '', r2: string = '';
    act(() => { r1 = result.current.navigateUp(''); });
    act(() => { r2 = result.current.navigateUp(''); });
    expect(r1).toBe('real');
    expect(r2).toBe('real'); // no-op at oldest
  });
});

// ---------------------------------------------------------------------------
// Live sync and pendingBarSends deduplication
// ---------------------------------------------------------------------------

describe('usePromptHistory — live terminal message sync', () => {
  it('adds new terminal messages that arrive after mount', () => {
    const { result, rerender } = renderHook(
      ({ items }: { items: SessionOutput[] }) => usePromptHistory('s1', items),
      { initialProps: { items: [] as SessionOutput[] } },
    );

    const newItems: SessionOutput[] = [
      makeOutput({ id: 'o1', content: 'live msg', sequenceNumber: 1 }),
    ];

    rerender({ items: newItems });

    let returned: string = '';
    act(() => { returned = result.current.navigateUp(''); });
    expect(returned).toBe('live msg');
  });

  it('does not double-add a bar-sent message when it appears in session output', () => {
    const { result, rerender } = renderHook(
      ({ items }: { items: SessionOutput[] }) => usePromptHistory('s1', items),
      { initialProps: { items: [] as SessionOutput[] } },
    );

    // User sends via bar
    act(() => { result.current.addEntry('from bar'); });

    // Session output picks it up
    const withBarMsg: SessionOutput[] = [
      makeOutput({ id: 'o1', content: 'from bar', sequenceNumber: 1 }),
    ];
    rerender({ items: withBarMsg });

    // Navigate history — should appear exactly once
    const results: string[] = [];
    act(() => { results.push(result.current.navigateUp('')); });
    act(() => { results.push(result.current.navigateUp('')); });
    // Second navigateUp should be a no-op (only one entry)
    expect(results[0]).toBe('from bar');
    expect(results[1]).toBe('from bar'); // no-op
    expect(results.filter((r) => r === 'from bar').length).toBe(2); // both at same entry, not two entries
  });

  it('correctly handles same text sent twice via bar', () => {
    const { result, rerender } = renderHook(
      ({ items }: { items: SessionOutput[] }) => usePromptHistory('s1', items),
      { initialProps: { items: [] as SessionOutput[] } },
    );

    act(() => {
      result.current.addEntry('dup text');
      result.current.addEntry('dup text');
    });

    // Both appear in session output
    const withTwoDups: SessionOutput[] = [
      makeOutput({ id: 'o1', content: 'dup text', sequenceNumber: 1 }),
      makeOutput({ id: 'o2', content: 'dup text', sequenceNumber: 2 }),
    ];
    rerender({ items: withTwoDups });

    // Should still be exactly 2 entries (both from bar sends, session output deduplicated)
    const results: string[] = [];
    act(() => { results.push(result.current.navigateUp('')); });
    act(() => { results.push(result.current.navigateUp('')); });
    act(() => { results.push(result.current.navigateUp('')); });
    expect(results[0]).toBe('dup text');
    expect(results[1]).toBe('dup text');
    expect(results[2]).toBe('dup text'); // no-op (still at oldest)
  });
});
