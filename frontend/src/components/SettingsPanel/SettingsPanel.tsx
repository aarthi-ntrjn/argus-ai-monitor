import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import type { DashboardSettings } from '../../types';
import { useArgusSettings } from '../../hooks/useArgusSettings';
import { YoloWarningDialog } from '../YoloWarningDialog/YoloWarningDialog';

const DEFAULT_THRESHOLD = 20;
const MIN_THRESHOLD = 1;
const MAX_THRESHOLD = 1440;

interface SettingsPanelProps {
  settings: DashboardSettings;
  onToggle: (key: keyof DashboardSettings, value: boolean) => void;
  onUpdateThreshold?: (minutes: number) => void;
  onRestartTour?: () => void;
}

export function SettingsPanel({ settings, onToggle, onUpdateThreshold, onRestartTour }: SettingsPanelProps) {
  const { settings: argusSettings, patchSetting } = useArgusSettings();
  const [showYoloWarning, setShowYoloWarning] = useState(false);
  const [thresholdInput, setThresholdInput] = useState(String(settings.restingThresholdMinutes ?? DEFAULT_THRESHOLD));
  const [thresholdError, setThresholdError] = useState<string | null>(null);

  const handleYoloChange = (checked: boolean) => {
    if (checked) {
      setShowYoloWarning(true);
    } else {
      patchSetting({ yoloMode: false });
    }
  };

  const handleYoloConfirm = () => {
    setShowYoloWarning(false);
    patchSetting({ yoloMode: true });
  };

  const handleYoloCancel = () => {
    setShowYoloWarning(false);
  };

  const commitThreshold = (raw: string, normalizeInput = false) => {
    const trimmed = raw.trim();
    if (trimmed === '') {
      setThresholdError('Enter a number between 1 and 1440.');
      return;
    }
    const rounded = Math.round(parseFloat(trimmed));
    if (isNaN(rounded)) {
      setThresholdError('Enter a number between 1 and 1440.');
      return;
    }
    if (rounded < MIN_THRESHOLD) {
      setThresholdError('Minimum is 1 minute.');
      return;
    }
    if (rounded > MAX_THRESHOLD) {
      setThresholdError('Maximum is 1440 minutes (24 hours).');
      return;
    }
    setThresholdError(null);
    // On blur, normalise the display value (e.g. "05" -> "5", "5.7" -> "6").
    if (normalizeInput) setThresholdInput(String(rounded));
    onUpdateThreshold?.(rounded);
  };

  const handleReset = () => {
    setThresholdInput(String(DEFAULT_THRESHOLD));
    setThresholdError(null);
    onUpdateThreshold?.(DEFAULT_THRESHOLD);
  };

  return (
    <>
      <div className="absolute right-0 top-full mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50 p-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Settings</p>
        <label className="flex items-center gap-3 cursor-pointer select-none py-1">
          <input
            type="checkbox"
            aria-label="Hide ended sessions"
            checked={settings.hideEndedSessions}
            onChange={e => onToggle('hideEndedSessions', e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-1 focus:ring-blue-400"
          />
          <span className="text-sm text-gray-700">Hide ended sessions</span>
        </label>
        <label className="flex items-center gap-3 cursor-pointer select-none py-1">
          <input
            type="checkbox"
            aria-label="Hide repos with no active sessions"
            checked={settings.hideReposWithNoActiveSessions}
            onChange={e => onToggle('hideReposWithNoActiveSessions', e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-1 focus:ring-blue-400"
          />
          <span className="text-sm text-gray-700">Hide repos with no active sessions</span>
        </label>
        <label className="flex items-center gap-3 cursor-pointer select-none py-1">
          <input
            type="checkbox"
            aria-label="Hide inactive sessions"
            checked={settings.hideInactiveSessions}
            onChange={e => onToggle('hideInactiveSessions', e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-1 focus:ring-blue-400"
          />
          <span className="text-sm text-gray-700">
            Hide inactive sessions (&gt;{settings.restingThresholdMinutes ?? DEFAULT_THRESHOLD} min)
          </span>
        </label>

        <div className="mt-2 pt-2 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Resting</p>
          <div className="flex items-center gap-2 py-1">
            <label htmlFor="resting-threshold-input" className="text-sm text-gray-700 shrink-0">
              Resting after
            </label>
            <input
              id="resting-threshold-input"
              type="number"
              aria-label="Resting after"
              value={thresholdInput}
              min={MIN_THRESHOLD}
              max={MAX_THRESHOLD}
              onChange={e => {
                setThresholdInput(e.target.value);
                commitThreshold(e.target.value);
              }}
              onBlur={e => commitThreshold(e.target.value, true)}
              className="w-14 text-sm px-1 py-0.5 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 text-center"
            />
            <span className="text-sm text-gray-500 shrink-0">min</span>
            <button
              type="button"
              onClick={handleReset}
              aria-label="Reset resting threshold to default"
              title="Reset to default (20 min)"
              className="text-gray-400 hover:text-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-400 rounded-sm"
            >
              <RotateCcw size={12} />
            </button>
          </div>
          {thresholdError && (
            <p role="alert" className="text-xs text-red-600 mt-0.5 px-1">{thresholdError}</p>
          )}
        </div>

        <div className="mt-2 pt-2 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Launch Behaviour</p>
          <label className="flex items-start gap-3 cursor-pointer select-none py-1">
            <input
              type="checkbox"
              aria-label="Yolo mode"
              checked={argusSettings?.yoloMode ?? false}
              onChange={e => handleYoloChange(e.target.checked)}
              className="mt-0.5 rounded border-gray-300 text-red-600 focus:ring-1 focus:ring-red-400"
            />
            <span className="flex flex-col">
              <span className="text-sm text-gray-700">Yolo mode</span>
              {argusSettings?.yoloMode && (
                <span className="text-xs text-amber-700">All permission checks disabled</span>
              )}
            </span>
          </label>
        </div>

        {onRestartTour && (
          <div className="mt-2 pt-2 border-t border-gray-100 flex flex-col gap-1">
            <button
              onClick={onRestartTour}
              className="w-full text-left text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-sm px-2 py-1 transition-colors focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              Restart Tour
            </button>
          </div>
        )}
      </div>

      <YoloWarningDialog
        open={showYoloWarning}
        onConfirm={handleYoloConfirm}
        onCancel={handleYoloCancel}
      />
    </>
  );
}
