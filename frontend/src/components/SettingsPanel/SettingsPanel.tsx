import type { DashboardSettings } from '../../types';
import { GeneralSettingsContent } from '../SettingsDialog/GeneralSettingsContent';

interface SettingsPanelProps {
  settings: DashboardSettings;
  onToggle: (key: keyof DashboardSettings, value: boolean) => void;
  onOpenAllSettings?: () => void;
}

export function SettingsPanel({ settings, onToggle, onOpenAllSettings }: SettingsPanelProps) {
  return (
    <div className="absolute right-0 top-full mt-1 w-96 bg-white border border-gray-200 rounded-lg shadow-lg z-50 p-3 max-h-[calc(100vh-4rem)] overflow-y-auto">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Settings</p>
        {onOpenAllSettings && (
          <button
            type="button"
            onClick={onOpenAllSettings}
            className="text-xs text-blue-600 hover:text-blue-700 hover:underline"
          >
            All settings
          </button>
        )}
      </div>
      <GeneralSettingsContent settings={settings} onToggle={onToggle} />
    </div>
  );
}
