import { useState, useCallback } from 'react';
import {
  readOnboardingState,
  writeOnboardingState,
  resetOnboardingState,
} from '../services/onboardingStorage';
import {
  onTourStarted,
  onTourCompleted,
  onTourSkipped,
  onHintDismissed,
} from '../services/onboardingEvents';
import type { DashboardTourStatus } from '../types';

export interface UseOnboardingReturn {
  tourStatus: DashboardTourStatus;
  dismissedHints: string[];
  /** Call to programmatically run the tour (auto on first load, manual from settings) */
  startTour: (trigger: 'auto' | 'manual') => void;
  /** Call when user skips or navigates away mid-tour */
  skipTour: (reason: 'user_action' | 'navigation') => void;
  /** Call when user completes all tour steps */
  completeTour: () => void;
  /** Call when user dismisses a contextual hint badge */
  dismissHint: (hintId: string) => void;
  /** Call from Settings to clear all onboarding state */
  resetOnboarding: () => void;
}

export function useOnboarding(): UseOnboardingReturn {
  const [state, setState] = useState(() => readOnboardingState());

  const startTour = useCallback((trigger: 'auto' | 'manual') => {
    onTourStarted(trigger);
    // startTour does not mutate persisted status — it only fires the event hook
    // so the tour can replay without changing the stored completion state
  }, []);

  const skipTour = useCallback((reason: 'user_action' | 'navigation') => {
    setState(prev => {
      const stepIndex = 0; // step tracking is handled by OnboardingTour via joyride callback
      onTourSkipped(stepIndex, reason);
      const updated = {
        ...prev,
        dashboardTour: {
          ...prev.dashboardTour,
          status: 'skipped' as DashboardTourStatus,
          skippedAt: new Date().toISOString(),
        },
      };
      writeOnboardingState(updated);
      return updated;
    });
  }, []);

  const completeTour = useCallback(() => {
    onTourCompleted();
    setState(prev => {
      const updated = {
        ...prev,
        dashboardTour: {
          ...prev.dashboardTour,
          status: 'completed' as DashboardTourStatus,
          completedAt: new Date().toISOString(),
        },
      };
      writeOnboardingState(updated);
      return updated;
    });
  }, []);

  const dismissHint = useCallback((hintId: string) => {
    onHintDismissed(hintId);
    setState(prev => {
      if (prev.sessionHints.dismissed.includes(hintId)) return prev;
      const updated = {
        ...prev,
        sessionHints: {
          dismissed: [...prev.sessionHints.dismissed, hintId],
        },
      };
      writeOnboardingState(updated);
      return updated;
    });
  }, []);

  const resetOnboarding = useCallback(() => {
    const fresh = resetOnboardingState();
    setState(fresh);
  }, []);

  return {
    tourStatus: state.dashboardTour.status,
    dismissedHints: state.sessionHints.dismissed,
    startTour,
    skipTour,
    completeTour,
    dismissHint,
    resetOnboarding,
  };
}
