import { useEffect, useRef } from 'react';
import { Joyride, ACTIONS, EVENTS, STATUS, type EventData } from 'react-joyride';
import { useLocation } from 'react-router-dom';
import type { TourStep } from '../../types';
import { onStepAdvanced, onTourSkipped } from '../../services/onboardingEvents';

interface OnboardingTourProps {
  run: boolean;
  steps: TourStep[];
  onComplete: () => void;
  onSkip: (reason: 'user_action' | 'navigation') => void;
}

export function OnboardingTour({ run, steps, onComplete, onSkip }: OnboardingTourProps) {
  const location = useLocation();
  const runRef = useRef(run);
  runRef.current = run;

  // FR-011: gracefully dismiss if user navigates away mid-tour
  const prevPathRef = useRef(location.pathname);
  useEffect(() => {
    if (runRef.current && location.pathname !== prevPathRef.current) {
      onSkip('navigation');
    }
    prevPathRef.current = location.pathname;
  }, [location.pathname, onSkip]);

  const handleEvent = (data: EventData) => {
    const { action, index, status, type } = data;

    if (type === EVENTS.STEP_AFTER && action === ACTIONS.NEXT) {
      onStepAdvanced(index, index + 1);
    }

    if (type === EVENTS.TOUR_END) {
      if (status === STATUS.FINISHED) {
        onComplete();
      } else if (status === STATUS.SKIPPED) {
        onTourSkipped(index, 'user_action');
        onSkip('user_action');
      }
    }
  };

  return (
    <Joyride
      run={run}
      steps={steps}
      continuous
      scrollToFirstStep
      onEvent={handleEvent}
      options={{
        buttons: ['back', 'primary', 'skip'],
        overlayClickAction: false,
        blockTargetInteraction: false,
        showProgress: true,
        primaryColor: '#2563eb', // Tailwind blue-600
        zIndex: 10000,
      }}
      locale={{
        back: 'Back',
        close: 'Close',
        last: 'Done',
        next: 'Next',
        open: 'Open the dialog',
        skip: 'Skip tour',
        nextWithProgress: 'Next ({step}/{steps})',
      }}
    />
  );
}
