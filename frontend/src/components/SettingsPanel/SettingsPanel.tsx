import type { DashboardSettings } from '../../types';

interface SettingsPanelProps {
  settings: DashboardSettings;
  onToggle: (key: keyof DashboardSettings, value: boolean) => void;
  onClose: () => void;
}

export function SettingsPanel({ settings, onToggle }: SettingsPanelProps) {
  return (
    <div className="absolute right-0 top-full mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50 p-3">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Settings</p>
      <label className="flex items-center gap-3 cursor-pointer select-none py-1">
        <input
          type="checkbox"
          aria-label="Show ended sessions"
          checked={settings.showEndedSessions}
          onChange={e => onToggle('showEndedSessions', e.target.checked)}
          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <span className="text-sm text-gray-700">Show ended sessions</span>
      </label>
      <label className="flex items-center gap-3 cursor-pointer select-none py-1">
        <input
          type="checkbox"
          aria-label="Hide repos with no active sessions"
          checked={settings.hideReposWithNoActiveSessions}
          onChange={e => onToggle('hideReposWithNoActiveSessions', e.target.checked)}
          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <span className="text-sm text-gray-700">Hide repos with no active sessions</span>
      </label>
    </div>
  );
}
