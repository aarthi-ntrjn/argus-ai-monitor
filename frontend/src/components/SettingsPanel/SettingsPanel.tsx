import type { DashboardSettings } from '../../types';

interface SettingsPanelProps {
  settings: DashboardSettings;
  onToggle: (key: keyof DashboardSettings, value: boolean) => void;
  onRestartTour?: () => void;
  onResetOnboarding?: () => void;
}

export function SettingsPanel({ settings, onToggle, onRestartTour, onResetOnboarding }: SettingsPanelProps) {
  return (
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
      {(onRestartTour || onResetOnboarding) && (
        <div className="mt-2 pt-2 border-t border-gray-100 flex flex-col gap-1">
          {onRestartTour && (
            <button
              onClick={onRestartTour}
              className="w-full text-left text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-sm px-2 py-1 transition-colors focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              Restart Tour
            </button>
          )}
          {onResetOnboarding && (
            <button
              onClick={onResetOnboarding}
              className="w-full text-left text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-sm px-2 py-1 transition-colors focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              Reset Onboarding
            </button>
          )}
        </div>
      )}
    </div>
  );
}
