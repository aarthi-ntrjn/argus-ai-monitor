import { useState } from 'react';
import type { DashboardSettings } from '../../types';
import { useArgusSettings } from '../../hooks/useArgusSettings';
import { YoloWarningDialog } from '../YoloWarningDialog/YoloWarningDialog';

interface SettingsPanelProps {
  settings: DashboardSettings;
  onToggle: (key: keyof DashboardSettings, value: boolean) => void;
  onRestartTour?: () => void;
}

export function SettingsPanel({ settings, onToggle, onRestartTour }: SettingsPanelProps) {
  const { settings: argusSettings, patchSetting } = useArgusSettings();
  const [showYoloWarning, setShowYoloWarning] = useState(false);

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
          <span className="text-sm text-gray-700">Hide inactive sessions (&gt;20 min)</span>
        </label>

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
