import { describe, it, expect } from 'vitest';
import { isInactive, INACTIVE_THRESHOLD_MS } from '../utils/sessionUtils';
import { SessionTypes } from '../types';
import type { Session } from '../types';

function session(overrides: Partial<Session> = {}): Session {
  return {
    id: 'test-id',
    repositoryId: 'repo-1',
    type: SessionTypes.CLAUDE_CODE,
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
    hostPid: null,
    reconciled: false,
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
    // Use 1s inside the threshold to avoid timing flakiness on slow runners
    const atThreshold = new Date(Date.now() - INACTIVE_THRESHOLD_MS + 1000).toISOString();
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

