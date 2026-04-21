import { useEffect } from 'react';
import { X } from 'lucide-react';
import teamsUrl from '../../images/microsoft-teams.svg?url';
import slackUrl from '../../images/slack.svg?url';
import type { DashboardSettings } from '../../types';
import { GeneralSettingsContent } from './GeneralSettingsContent';
import { IntegrationConfigContent } from './IntegrationConfigContent';

export type SettingsTab = 'general' | 'teams' | 'slack';

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
];

export function SettingsDialog({ open, tab, onTabChange, onClose, settings, onToggle, onRestartTour }: SettingsDialogProps) {
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
        className="bg-white rounded-lg shadow-xl flex overflow-hidden w-full max-w-2xl max-h-[85vh]"
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
              <GeneralSettingsContent
                settings={settings}
                onToggle={onToggle}
                onRestartTour={onRestartTour}
              />
            )}
            {tab === 'teams' && <IntegrationConfigContent type="teams" />}
            {tab === 'slack' && <IntegrationConfigContent type="slack" />}
          </div>
        </div>
      </div>
    </div>
  );
}
