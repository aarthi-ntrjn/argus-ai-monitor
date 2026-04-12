import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSettings } from '../hooks/useSettings';

const KEY = 'argus:settings';

describe('useSettings', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns defaults when nothing is stored', () => {
    const { result } = renderHook(() => useSettings());
    expect(result.current[0]).toEqual({
      hideEndedSessions: true,
      hideReposWithNoActiveSessions: false,
      hideInactiveSessions: false,
      outputDisplayMode: 'focused',
      restingThresholdMinutes: 20,
    });
  });

  it('loads stored settings from localStorage on mount', () => {
    localStorage.setItem(KEY, JSON.stringify({
      hideEndedSessions: true,
      hideReposWithNoActiveSessions: false,
      hideInactiveSessions: true,
    }));
    const { result } = renderHook(() => useSettings());
    expect(result.current[0].hideEndedSessions).toBe(true);
    expect(result.current[0].hideInactiveSessions).toBe(true);
  });

  it('falls back to defaults when stored JSON is corrupt', () => {
    localStorage.setItem(KEY, 'not-valid-json{{{');
    const { result } = renderHook(() => useSettings());
    expect(result.current[0]).toEqual({
      hideEndedSessions: true,
      hideReposWithNoActiveSessions: false,
      hideInactiveSessions: false,
      outputDisplayMode: 'focused',
      restingThresholdMinutes: 20,
    });
  });

  it('defaults restingThresholdMinutes to 20 when key is missing from stored settings', () => {
    localStorage.setItem(KEY, JSON.stringify({ hideEndedSessions: true }));
    const { result } = renderHook(() => useSettings());
    expect(result.current[0].restingThresholdMinutes).toBe(20);
  });

  it('persists restingThresholdMinutes when updated', () => {
    const { result } = renderHook(() => useSettings());
    act(() => result.current[1]('restingThresholdMinutes', 5));
    expect(result.current[0].restingThresholdMinutes).toBe(5);
    expect(JSON.parse(localStorage.getItem(KEY)!).restingThresholdMinutes).toBe(5);
  });

  it('merges partial stored settings with defaults (missing keys get default values)', () => {
    localStorage.setItem(KEY, JSON.stringify({ hideEndedSessions: true }));
    const { result } = renderHook(() => useSettings());
    expect(result.current[0].hideEndedSessions).toBe(true);
    expect(result.current[0].hideReposWithNoActiveSessions).toBe(false);
    expect(result.current[0].hideInactiveSessions).toBe(false);
  });

  it('persists an updated setting to localStorage', () => {
    const { result } = renderHook(() => useSettings());
    act(() => result.current[1]('hideEndedSessions', true));
    const stored = JSON.parse(localStorage.getItem(KEY)!);
    expect(stored.hideEndedSessions).toBe(true);
  });

  it('updating one key does not change the other keys', () => {
    const { result } = renderHook(() => useSettings());
    act(() => result.current[1]('hideEndedSessions', true));
    expect(result.current[0].hideReposWithNoActiveSessions).toBe(false);
    expect(result.current[0].hideInactiveSessions).toBe(false);
  });

  it('reflects the new value in state immediately after update', () => {
    const { result } = renderHook(() => useSettings());
    act(() => result.current[1]('hideInactiveSessions', true));
    expect(result.current[0].hideInactiveSessions).toBe(true);
  });

  it('can toggle a setting back to false', () => {
    localStorage.setItem(KEY, JSON.stringify({ hideEndedSessions: true }));
    const { result } = renderHook(() => useSettings());
    act(() => result.current[1]('hideEndedSessions', false));
    expect(result.current[0].hideEndedSessions).toBe(false);
    expect(JSON.parse(localStorage.getItem(KEY)!).hideEndedSessions).toBe(false);
  });
});
