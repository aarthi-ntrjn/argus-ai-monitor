import { Settings } from 'lucide-react';
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
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Settings</p>
      <GeneralSettingsContent settings={settings} onToggle={onToggle} />
      {onOpenAllSettings && (
        <div className="mt-2 pt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={onOpenAllSettings}
            className="flex items-center gap-2 w-full text-sm text-gray-600 hover:text-blue-600 transition-colors"
          >
            <Settings size={13} className="shrink-0" aria-hidden="true" />
            Open settings
          </button>
        </div>
      )}
    </div>
  );
}
