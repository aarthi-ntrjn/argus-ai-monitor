import { Settings, Bug, Lightbulb } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import type { DashboardSettings } from '../../types';
import { getHealth } from '../../services/api';
import { buildBugReportUrl, buildFeatureRequestUrl, ARGUS_CHANGELOG_URL } from '../../config/feedback';
import { GeneralSettingsContent } from '../SettingsDialog/GeneralSettingsContent';

interface SettingsPanelProps {
  settings: DashboardSettings;
  onToggle: (key: keyof DashboardSettings, value: boolean) => void;
  onOpenAllSettings?: () => void;
}

export function SettingsPanel({ settings, onToggle, onOpenAllSettings }: SettingsPanelProps) {
  const { data: healthData } = useQuery({ queryKey: ['health'], queryFn: getHealth, staleTime: Infinity });

  return (
    <div className="absolute right-0 top-full mt-1 w-96 bg-white border border-gray-200 rounded-lg shadow-lg z-50 p-3 max-h-[calc(100vh-4rem)] overflow-y-auto">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Settings</p>
      <GeneralSettingsContent settings={settings} onToggle={onToggle} compact />
      <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide shrink-0">
          About Argus{healthData?.version && (
            <><a href={ARGUS_CHANGELOG_URL} target="_blank" rel="noopener noreferrer" className="ml-3 normal-case font-normal tabular-nums text-blue-600 hover:text-blue-700 hover:underline">v{healthData.version}</a></>
          )}
        </p>
        <div className="flex items-center gap-1">
          <a
            href="https://aarthi-ntrjn.github.io/argus"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Website"
            title="Website"
            className="icon-btn text-gray-400 hover:text-blue-600"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
          </a>
          <a
            href="https://github.com/aarthi-ntrjn/argus"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub"
            title="GitHub"
            className="icon-btn text-gray-400 hover:text-blue-600"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/></svg>
          </a>
          <a
            href="https://www.npmjs.com/package/argus-ai-hub"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="npm"
            title="npm"
            className="icon-btn text-gray-400 hover:text-blue-600"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M0 0v24h24V0H0zm6.672 19.992H3.336V6.664h3.336v13.328zm11.664 0h-3.336v-9.992h-3.336v9.992H8.328V6.664h10.008v13.328z"/></svg>
          </a>
        </div>
      </div>
      <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide shrink-0">Feedback</p>
        <div className="flex items-center gap-1">
          <a
            href={buildBugReportUrl()}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Report a bug"
            title="Report a bug"
            className="icon-btn text-gray-400 hover:text-blue-600"
          >
            <Bug size={13} aria-hidden="true" />
          </a>
          <a
            href={buildFeatureRequestUrl()}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Request a feature"
            title="Request a feature"
            className="icon-btn text-gray-400 hover:text-blue-600"
          >
            <Lightbulb size={13} aria-hidden="true" />
          </a>
        </div>
      </div>
      {onOpenAllSettings && (
        <div className="mt-2 pt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={onOpenAllSettings}
            className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 hover:underline"
          >
            <Settings size={13} className="shrink-0" aria-hidden="true" />
            Advanced settings
          </button>
        </div>
      )}
    </div>
  );
}
