import { useEffect } from 'react';
import { X, Bug, Lightbulb } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import teamsUrl from '../../images/microsoft-teams.svg?url';
import slackUrl from '../../images/slack.svg?url';
import type { DashboardSettings } from '../../types';
import { getHealth } from '../../services/api';
import { buildBugReportUrl, buildFeatureRequestUrl } from '../../config/feedback';
import { GeneralSettingsContent } from './GeneralSettingsContent';
import { IntegrationConfigContent } from './IntegrationConfigContent';

export type SettingsTab = 'general' | 'teams' | 'slack' | 'about' | 'feedback';

interface SettingsDialogProps {
  open: boolean;
  tab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
  onClose: () => void;
  settings: DashboardSettings;
  onToggle: (key: keyof DashboardSettings, value: boolean) => void;
  onRestartTour?: () => void;
}

const TABS: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
  {
    id: 'general',
    label: 'General',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    id: 'teams',
    label: 'Microsoft Teams',
    icon: <img src={teamsUrl} alt="" width={14} height={14} aria-hidden="true" />,
  },
  {
    id: 'slack',
    label: 'Slack',
    icon: <img src={slackUrl} alt="" width={14} height={14} aria-hidden="true" />,
  },
  {
    id: 'about',
    label: 'About',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
    ),
  },
  {
    id: 'feedback',
    label: 'Feedback',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
      </svg>
    ),
  },
] as const;

export function SettingsDialog({ open, tab, onTabChange, onClose, settings, onToggle, onRestartTour }: SettingsDialogProps) {
  const { data: healthData } = useQuery({ queryKey: ['health'], queryFn: getHealth, staleTime: Infinity });

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        className="bg-white rounded-lg shadow-xl flex overflow-hidden w-full max-w-2xl h-[70vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Left sidebar */}
        <div className="w-44 bg-gray-50 border-r border-gray-200 flex flex-col p-2 shrink-0">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-2 pt-1 pb-2">Settings</p>
          {TABS.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => onTabChange(t.id)}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-left transition-colors ${
                tab === t.id
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* Right content */}
        <div className="flex-1 overflow-y-auto relative">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="absolute top-3 right-3 icon-btn text-gray-400 hover:text-gray-600 z-10"
          >
            <X size={15} aria-hidden="true" />
          </button>
          <div className="p-4">
            {tab === 'general' && (
              <GeneralSettingsContent settings={settings} onToggle={onToggle} />
            )}
            {tab === 'teams' && <IntegrationConfigContent type="teams" />}
            {tab === 'slack' && <IntegrationConfigContent type="slack" />}
            {tab === 'about' && (
              <div className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between mb-1">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">About</p>
                  {healthData?.version && (
                    <span className="text-xs text-gray-400 tabular-nums">v{healthData.version}</span>
                  )}
                </div>
                <a href="https://aarthi-ntrjn.github.io/argus" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600">
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                  Website
                </a>
                <a href="https://github.com/aarthi-ntrjn/argus" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600">
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/></svg>
                  GitHub
                </a>
                <a href="https://www.npmjs.com/package/argus-ai-hub" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600">
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M0 0v24h24V0H0zm6.672 19.992H3.336V6.664h3.336v13.328zm11.664 0h-3.336v-9.992h-3.336v9.992H8.328V6.664h10.008v13.328z"/></svg>
                  npm
                </a>
                {onRestartTour && (
                  <button
                    type="button"
                    onClick={() => { onClose(); onRestartTour(); }}
                    className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600 transition-colors text-left"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>
                    Restart Tour
                  </button>
                )}
              </div>
            )}
            {tab === 'feedback' && (
              <div className="flex flex-col gap-1">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Feedback</p>
                <a
                  href={buildBugReportUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600 transition-colors"
                >
                  <Bug size={13} className="shrink-0" aria-hidden="true" />
                  Report a Bug
                </a>
                <a
                  href={buildFeatureRequestUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600 transition-colors"
                >
                  <Lightbulb size={13} className="shrink-0" aria-hidden="true" />
                  Request a Feature
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
