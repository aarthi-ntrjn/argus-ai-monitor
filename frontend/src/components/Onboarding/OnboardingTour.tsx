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

const FONT_FAMILY =
  'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

const tourStyles = {
  tooltip: {
    borderRadius: 10,
    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15), 0 4px 10px -5px rgba(0,0,0,0.1)',
    padding: '12px 16px',
    fontFamily: FONT_FAMILY,
    fontSize: 12,
    maxWidth: 300,
  },
  tooltipTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: '#111827',
    marginBottom: 4,
    fontFamily: FONT_FAMILY,
  },
  tooltipContent: {
    fontSize: 12,
    color: '#374151',
    lineHeight: 1.4,
    padding: '2px 0',
    fontFamily: FONT_FAMILY,
  },
  tooltipFooter: {
    marginTop: 10,
    gap: 6,
  },
  buttonPrimary: {
    backgroundColor: '#2563eb',
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 500,
    padding: '5px 12px',
    fontFamily: FONT_FAMILY,
    color: '#ffffff',
    border: 0,
    outline: 'none',
    cursor: 'pointer',
  },
  buttonBack: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: 500,
    fontFamily: FONT_FAMILY,
    padding: '5px 6px',
  },
  buttonSkip: {
    color: '#9ca3af',
    fontSize: 11,
    fontFamily: FONT_FAMILY,
    padding: '5px 6px',
  },
  buttonClose: {
    color: '#9ca3af',
    width: 12,
    height: 12,
  },
};

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
      styles={tourStyles}
      options={{
        buttons: ['back', 'primary', 'skip'],
        overlayClickAction: false,
        blockTargetInteraction: false,
        showProgress: true,
        primaryColor: '#2563eb',
        backgroundColor: '#ffffff',
        textColor: '#111827',
        overlayColor: 'rgba(0,0,0,0.45)',
        arrowColor: '#ffffff',
        zIndex: 10000,
        skipBeacon: true,
      }}
      locale={{
        back: 'Back',
        close: 'Close',
        last: 'Done',
        next: 'Next',
        open: 'Open the dialog',
        skip: 'Skip tour',
        nextWithProgress: 'Next ({current}/{total})',
      }}
    />
  );
}
