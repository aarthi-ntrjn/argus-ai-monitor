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
  options: {
    primaryColor: '#2563eb',       // blue-600
    backgroundColor: '#ffffff',
    textColor: '#111827',          // gray-900
    overlayColor: 'rgba(0,0,0,0.45)',
    arrowColor: '#ffffff',
    zIndex: 10000,
    fontFamily: FONT_FAMILY,
    fontSize: 13,
  },
  tooltip: {
    borderRadius: 10,
    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15), 0 4px 10px -5px rgba(0,0,0,0.1)',
    padding: '16px 20px',
    fontFamily: FONT_FAMILY,
    fontSize: 13,
    maxWidth: 340,
  },
  tooltipTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: '#111827',              // gray-900
    marginBottom: 6,
    fontFamily: FONT_FAMILY,
  },
  tooltipContent: {
    fontSize: 13,
    color: '#374151',              // gray-700
    lineHeight: 1.55,
    padding: '4px 0',
    fontFamily: FONT_FAMILY,
  },
  tooltipFooter: {
    marginTop: 14,
    gap: 8,
  },
  buttonNext: {
    backgroundColor: '#2563eb',   // blue-600
    borderRadius: 8,               // rounded-lg
    fontSize: 14,                  // text-sm
    fontWeight: 500,               // font-medium
    padding: '8px 24px',           // py-2 px-6
    fontFamily: FONT_FAMILY,
    color: '#ffffff',
    border: 'none',
  },
  buttonBack: {
    color: '#6b7280',              // gray-500
    fontSize: 13,
    fontWeight: 500,
    fontFamily: FONT_FAMILY,
  },
  buttonSkip: {
    color: '#9ca3af',              // gray-400
    fontSize: 12,
    fontFamily: FONT_FAMILY,
  },
  buttonClose: {
    color: '#9ca3af',
    width: 14,
    height: 14,
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
