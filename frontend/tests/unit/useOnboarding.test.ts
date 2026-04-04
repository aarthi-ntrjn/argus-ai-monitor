import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOnboarding } from '../../src/hooks/useOnboarding';
import { resetOnboardingState, ONBOARDING_STORAGE_KEY, DEFAULT_ONBOARDING_STATE } from '../../src/services/onboardingStorage';
import type { OnboardingState } from '../../src/types';

function seedState(partial: Partial<OnboardingState>) {
  localStorage.setItem(
    ONBOARDING_STORAGE_KEY,
    JSON.stringify({ ...DEFAULT_ONBOARDING_STATE, ...partial })
  );
}

describe('useOnboarding', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('initialises with not_started tour status for new user', () => {
    const { result } = renderHook(() => useOnboarding());
    expect(result.current.tourStatus).toBe('not_started');
    expect(result.current.dismissedHints).toEqual([]);
  });

  it('reads existing completed state from storage', () => {
    seedState({ dashboardTour: { status: 'completed', completedAt: '2026-01-01T00:00:00.000Z', skippedAt: null } });
    const { result } = renderHook(() => useOnboarding());
    expect(result.current.tourStatus).toBe('completed');
  });

  describe('completeTour', () => {
    it('sets tour status to completed and persists', () => {
      const { result } = renderHook(() => useOnboarding());
      act(() => result.current.completeTour());
      expect(result.current.tourStatus).toBe('completed');
      const stored = JSON.parse(localStorage.getItem(ONBOARDING_STORAGE_KEY)!);
      expect(stored.dashboardTour.status).toBe('completed');
      expect(stored.dashboardTour.completedAt).not.toBeNull();
    });
  });

  describe('skipTour', () => {
    it('sets tour status to skipped and persists', () => {
      const { result } = renderHook(() => useOnboarding());
      act(() => result.current.skipTour('user_action'));
      expect(result.current.tourStatus).toBe('skipped');
      const stored = JSON.parse(localStorage.getItem(ONBOARDING_STORAGE_KEY)!);
      expect(stored.dashboardTour.status).toBe('skipped');
      expect(stored.dashboardTour.skippedAt).not.toBeNull();
    });
  });

  describe('startTour', () => {
    it('does not change persisted status — tour runs in-session', () => {
      seedState({ dashboardTour: { status: 'completed', completedAt: '2026-01-01T00:00:00.000Z', skippedAt: null } });
      const { result } = renderHook(() => useOnboarding());
      act(() => result.current.startTour('manual'));
      expect(result.current.tourStatus).toBe('completed');
    });
  });

  describe('dismissHint', () => {
    it('adds hint id to dismissedHints and persists', () => {
      const { result } = renderHook(() => useOnboarding());
      act(() => result.current.dismissHint('session-status'));
      expect(result.current.dismissedHints).toContain('session-status');
      const stored = JSON.parse(localStorage.getItem(ONBOARDING_STORAGE_KEY)!);
      expect(stored.sessionHints.dismissed).toContain('session-status');
    });

    it('does not duplicate hint ids', () => {
      const { result } = renderHook(() => useOnboarding());
      act(() => result.current.dismissHint('session-status'));
      act(() => result.current.dismissHint('session-status'));
      expect(result.current.dismissedHints.filter(h => h === 'session-status')).toHaveLength(1);
    });
  });

  describe('resetOnboarding', () => {
    it('resets all state to defaults', () => {
      seedState({
        dashboardTour: { status: 'completed', completedAt: '2026-01-01T00:00:00.000Z', skippedAt: null },
        sessionHints: { dismissed: ['session-status', 'session-prompt-bar'] },
      });
      const { result } = renderHook(() => useOnboarding());
      act(() => result.current.resetOnboarding());
      expect(result.current.tourStatus).toBe('not_started');
      expect(result.current.dismissedHints).toEqual([]);
    });

    it('persists reset state to localStorage', () => {
      const { result } = renderHook(() => useOnboarding());
      act(() => result.current.completeTour());
      act(() => result.current.resetOnboarding());
      const stored = JSON.parse(localStorage.getItem(ONBOARDING_STORAGE_KEY)!);
      expect(stored).toEqual(DEFAULT_ONBOARDING_STATE);
    });
  });
});
