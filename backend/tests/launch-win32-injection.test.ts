/**
 * Regression tests for T116/T117: Win32 keystroke injection is used for all session
 * types (copilot-cli and claude-code). pty.write() is unreliable for interactive
 * prompts (e.g. AskUserQuestion) because the PTY may be in raw/char mode.
 *
 * Every push goes through pushStdin() which adds KEYSTROKE_DELAY_MS so events
 * arrive one per event-loop tick rather than all at once.
 */
import { describe, it, expect, vi } from 'vitest';

// ---- replicated from launch.ts (must stay in sync with the production code) ----

const KEYSTROKE_DELAY_MS = 10;

function* win32InputEvents(ch: string): Generator<Buffer> {
  const keyInfo: Record<string, [number, number]> = {
    'a': [65, 30], 'b': [66, 48], 'c': [67, 46], 'd': [68, 32], 'e': [69, 18],
    'f': [70, 33], 'g': [71, 34], 'h': [72, 35], 'i': [73, 23], 'j': [74, 36],
    'k': [75, 37], 'l': [76, 38], 'm': [77, 50], 'n': [78, 49], 'o': [79, 24],
    'p': [80, 25], 'q': [81, 16], 'r': [82, 19], 's': [83, 31], 't': [84, 20],
    'u': [85, 22], 'v': [86, 47], 'w': [87, 17], 'x': [88, 45], 'y': [89, 21],
    'z': [90, 44], ' ': [32, 57], '\r': [13, 28],
    '0': [48, 11], '1': [49, 2], '2': [50, 3], '3': [51, 4], '4': [52, 5],
    '5': [53, 6], '6': [54, 7], '7': [55, 8], '8': [56, 9], '9': [57, 10],
  };
  const lower = ch.toLowerCase();
  const [vk, sc] = keyInfo[lower] ?? [ch.charCodeAt(0), 0];
  const uc = ch.charCodeAt(0);
  yield Buffer.from(`\x1b[${vk};${sc};${uc};1;0;1_`); // key-down
  yield Buffer.from(`\x1b[${vk};${sc};${uc};0;0;1_`); // key-up
}

// Mirrors pushStdin in launch.ts: push then delay.
const makePushStdin = (push: (buf: Buffer) => void) =>
  (buf: Buffer): Promise<void> => {
    push(buf);
    return new Promise<void>((resolve) => setTimeout(resolve, KEYSTROKE_DELAY_MS));
  };

async function injectWin32Prompt(prompt: string, push: (buf: Buffer) => void): Promise<void> {
  const pushStdin = makePushStdin(push);
  await pushStdin(Buffer.from('\x1b[I')); // focus-in
  for (const ch of prompt) {
    for (const buf of win32InputEvents(ch)) {
      await pushStdin(buf);
    }
  }
  for (const buf of win32InputEvents('\r')) {
    await pushStdin(buf);
  }
  await pushStdin(Buffer.from('\x1b[O')); // focus-out
}

// ---- end replicated logic ----

describe('copilot-cli Win32 keystroke injection', () => {
  it('win32InputEvents emits key-down then key-up buffer for a character', () => {
    const bufs = [...win32InputEvents('a')];
    expect(bufs).toHaveLength(2);
    expect(bufs[0].toString()).toBe('\x1b[65;30;97;1;0;1_'); // key-down
    expect(bufs[1].toString()).toBe('\x1b[65;30;97;0;0;1_'); // key-up
  });

  it('only the first push (focus-in) is synchronous — the rest are gated behind delays', async () => {
    vi.useFakeTimers();
    try {
      const pushed: string[] = [];
      const push = (buf: Buffer) => pushed.push(buf.toString());

      const promise = injectWin32Prompt('a', push);

      // Synchronous portion: only focus-in has been pushed.
      // If there were no delays, all 6 events would be here already.
      expect(pushed.length).toBe(1);
      expect(pushed[0]).toBe('\x1b[I');

      // Drain all sequential timers so the promise resolves.
      await vi.runAllTimersAsync();
      await promise;

      // For prompt 'a': focus-in, a-down, a-up, enter-down, enter-up, focus-out = 6 events.
      expect(pushed.length).toBe(6);
      expect(pushed[0]).toBe('\x1b[I');                    // focus-in
      expect(pushed[pushed.length - 1]).toBe('\x1b[O');    // focus-out
    } finally {
      vi.useRealTimers();
    }
  });
});
