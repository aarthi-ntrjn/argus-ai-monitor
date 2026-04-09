import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  readOnboardingState,
  writeOnboardingState,
  resetOnboardingState,
  DEFAULT_ONBOARDING_STATE,
  ONBOARDING_STORAGE_KEY,
} from '../../src/services/onboardingStorage';
import type { OnboardingState } from '../../src/types';

describe('onboardingStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('readOnboardingState', () => {
    it('returns default state and writes it when key is missing', () => {
      const state = readOnboardingState();
      expect(state).toEqual(DEFAULT_ONBOARDING_STATE);
      expect(localStorage.getItem(ONBOARDING_STORAGE_KEY)).not.toBeNull();
    });

    it('returns default state when stored JSON is corrupt', () => {
      localStorage.setItem(ONBOARDING_STORAGE_KEY, '{not valid json{{');
      const state = readOnboardingState();
      expect(state).toEqual(DEFAULT_ONBOARDING_STATE);
    });

    it('returns default state when schemaVersion is unrecognised (future version)', () => {
      const futureState = { ...DEFAULT_ONBOARDING_STATE, schemaVersion: 999 };
      localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(futureState));
      const state = readOnboardingState();
      expect(state).toEqual(DEFAULT_ONBOARDING_STATE);
    });

    it('returns parsed state for valid v1 schema', () => {
      const stored: OnboardingState = {
        schemaVersion: 1,
        userId: null,
        dashboardTour: { status: 'completed', completedAt: '2026-04-04T00:00:00.000Z', skippedAt: null, seenRepoSteps: false },
        sessionHints: { dismissed: ['session-status'] },
      };
      localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(stored));
      expect(readOnboardingState()).toEqual(stored);
    });

    it('merges missing fields with defaults for partial valid state', () => {
      const partial = { schemaVersion: 1, userId: null, dashboardTour: { status: 'not_started', completedAt: null, skippedAt: null } };
      localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(partial));
      const state = readOnboardingState();
      expect(state.sessionHints).toEqual({ dismissed: [] });
    });
  });

  describe('writeOnboardingState', () => {
    it('serialises and stores the state', () => {
      const state: OnboardingState = { ...DEFAULT_ONBOARDING_STATE };
      writeOnboardingState(state);
      const raw = localStorage.getItem(ONBOARDING_STORAGE_KEY);
      expect(raw).not.toBeNull();
      expect(JSON.parse(raw!)).toEqual(state);
    });

    it('does not throw when localStorage is unavailable (SecurityError)', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('blocked', 'SecurityError');
      });
      expect(() => writeOnboardingState(DEFAULT_ONBOARDING_STATE)).not.toThrow();
    });

    it('does not throw when localStorage is full (QuotaExceededError)', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('full', 'QuotaExceededError');
      });
      expect(() => writeOnboardingState(DEFAULT_ONBOARDING_STATE)).not.toThrow();
    });
  });

  describe('resetOnboardingState', () => {
    it('writes default state and returns it', () => {
      const modified: OnboardingState = {
        ...DEFAULT_ONBOARDING_STATE,
        dashboardTour: { status: 'completed', completedAt: '2026-04-04T00:00:00.000Z', skippedAt: null, seenRepoSteps: false },
      };
      localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(modified));
      const result = resetOnboardingState();
      expect(result).toEqual(DEFAULT_ONBOARDING_STATE);
      expect(JSON.parse(localStorage.getItem(ONBOARDING_STORAGE_KEY)!)).toEqual(DEFAULT_ONBOARDING_STATE);
    });

    it('preserves schemaVersion 1 in reset state', () => {
      const result = resetOnboardingState();
      expect(result.schemaVersion).toBe(1);
    });
  });
});
