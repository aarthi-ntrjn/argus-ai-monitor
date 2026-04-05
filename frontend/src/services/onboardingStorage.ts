import type { OnboardingState } from '../types';

export const ONBOARDING_STORAGE_KEY = 'argus:onboarding';
export const CURRENT_SCHEMA_VERSION = 1;

export const DEFAULT_ONBOARDING_STATE: OnboardingState = {
  schemaVersion: 1,
  userId: null,
  dashboardTour: {
    status: 'not_started',
    completedAt: null,
    skippedAt: null,
  },
  sessionHints: {
    dismissed: [],
  },
};

export function readOnboardingState(): OnboardingState {
  try {
    const raw = localStorage.getItem(ONBOARDING_STORAGE_KEY);
    if (!raw) {
      const state = { ...DEFAULT_ONBOARDING_STATE };
      writeOnboardingState(state);
      return state;
    }
    const parsed = JSON.parse(raw);
    if (parsed.schemaVersion !== CURRENT_SCHEMA_VERSION) {
      return { ...DEFAULT_ONBOARDING_STATE };
    }
    // Merge with defaults so missing optional fields are safe
    return {
      ...DEFAULT_ONBOARDING_STATE,
      ...parsed,
      dashboardTour: { ...DEFAULT_ONBOARDING_STATE.dashboardTour, ...parsed.dashboardTour },
      sessionHints: { ...DEFAULT_ONBOARDING_STATE.sessionHints, ...parsed.sessionHints },
    };
  } catch {
    return { ...DEFAULT_ONBOARDING_STATE };
  }
}

export function writeOnboardingState(state: OnboardingState): void {
  try {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Silently ignore SecurityError / QuotaExceededError — tour continues in-memory
  }
}

export function resetOnboardingState(): OnboardingState {
  const state = { ...DEFAULT_ONBOARDING_STATE };
  writeOnboardingState(state);
  return state;
}
