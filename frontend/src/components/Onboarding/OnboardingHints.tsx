import { useState, useCallback } from 'react';
import type { ContextualHint } from '../../types';
import { onHintViewed, onHintDismissed } from '../../services/onboardingEvents';

interface OnboardingHintsProps {
  hints: ContextualHint[];
  dismissedHints: string[];
  onDismiss: (hintId: string) => void;
}

interface HintBadgeProps {
  hint: ContextualHint;
  onDismiss: (hintId: string) => void;
}

function HintBadge({ hint, onDismiss }: HintBadgeProps) {
  const [visible, setVisible] = useState(false);
  const tooltipId = `hint-tooltip-${hint.id}`;

  const handleShow = useCallback(() => {
    if (!visible) {
      onHintViewed(hint.id);
      setVisible(true);
    }
  }, [visible, hint.id]);

  const handleDismiss = useCallback(() => {
    onHintDismissed(hint.id);
    setVisible(false);
    onDismiss(hint.id);
  }, [hint.id, onDismiss]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setVisible(false);
    }
  }, []);

  return (
    <span
      className="relative inline-flex items-center ml-1"
      data-hint-id={hint.id}
      onMouseEnter={handleShow}
      onMouseLeave={() => setVisible(false)}
    >
      <button
        aria-label={hint.ariaLabel}
        aria-describedby={visible ? tooltipId : undefined}
        aria-expanded={visible}
        onFocus={handleShow}
        onBlur={() => setVisible(false)}
        onKeyDown={handleKeyDown}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-100 text-blue-600 text-xs font-bold hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 cursor-help"
      >
        ?
      </button>

      {visible && (
        <div
          id={tooltipId}
          role="tooltip"
          className={`absolute z-50 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg
            ${hint.placement === 'top' ? 'bottom-full mb-2 left-1/2 -translate-x-1/2' : ''}
            ${hint.placement === 'bottom' ? 'top-full mt-2 left-1/2 -translate-x-1/2' : ''}
            ${hint.placement === 'left' ? 'right-full mr-2 top-1/2 -translate-y-1/2' : ''}
            ${hint.placement === 'right' ? 'left-full ml-2 top-1/2 -translate-y-1/2' : ''}
          `}
        >
          <p className="leading-relaxed">{hint.label}</p>
          <button
            aria-label="Dismiss hint"
            onClick={handleDismiss}
            className="mt-2 text-blue-300 hover:text-white text-xs underline focus:outline-none focus:ring-1 focus:ring-white rounded"
          >
            Got it
          </button>
        </div>
      )}
    </span>
  );
}

export function OnboardingHints({ hints, dismissedHints, onDismiss }: OnboardingHintsProps) {
  const activeHints = hints.filter(h => !dismissedHints.includes(h.id));
  if (activeHints.length === 0) return null;

  return (
    <>
      {activeHints.map(hint => (
        <HintBadge key={hint.id} hint={hint} onDismiss={onDismiss} />
      ))}
    </>
  );
}
