import { describe, it, expect } from 'vitest';
import { isInactive, INACTIVE_THRESHOLD_MS } from '../utils/sessionUtils';
import type { Session } from '../types';

function session(overrides: Partial<Session> = {}): Session {
  return {
    id: 'test-id',
    repositoryId: 'repo-1',
    type: 'claude-code',
    pid: null,
    status: 'active',
    startedAt: new Date().toISOString(),
    endedAt: null,
    lastActivityAt: new Date().toISOString(),
    summary: null,
    expiresAt: null,
    model: null,
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

  it('returns true for idle status sessions that exceed the threshold', () => {
    expect(isInactive(session({ status: 'idle', lastActivityAt: OLD }))).toBe(true);
  });

  it('returns true for waiting status sessions that exceed the threshold', () => {
    expect(isInactive(session({ status: 'waiting', lastActivityAt: OLD }))).toBe(true);
  });
});
