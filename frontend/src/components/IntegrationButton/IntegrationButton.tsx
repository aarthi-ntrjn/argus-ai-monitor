import { useRef, useState, useEffect } from 'react';
import { ChevronDown, ExternalLink } from 'lucide-react';
import teamsUrl from '../../images/microsoft-teams.svg?url';
import slackUrl from '../../images/slack.svg?url';
import { IntegrationConfigContent } from '../SettingsDialog/IntegrationConfigContent';

interface IntegrationButtonBaseProps {
  connected: boolean;
  title: string;
  onClick?: () => void;
  disabled?: boolean;
  onOpenSettings: () => void;
}

interface DropdownProps extends IntegrationButtonBaseProps {
  type: 'teams' | 'slack';
  label: string;
}

function IntegrationDropdown({ type, connected, title, onClick, disabled, label, onOpenSettings }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const src = type === 'teams' ? teamsUrl : slackUrl;
  const configured = !!onClick;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const handleOpenSettings = () => {
    setOpen(false);
    onOpenSettings();
  };

  return (
    <div className="relative" ref={ref}>
      <div className="flex items-center rounded-md border border-gray-200 bg-white hover:border-gray-300 transition-colors">
        {configured ? (
          <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            title={title}
            aria-label={title}
            className="relative flex items-center justify-center p-1.5 rounded-l-md hover:bg-gray-50 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <img src={src} alt="" width={16} height={16} aria-hidden="true" className={`transition-opacity ${connected ? 'opacity-90' : 'opacity-30'}`} />
            <span className={`absolute bottom-0.5 right-0.5 w-2 h-2 rounded-full border border-white ${connected ? 'bg-green-500' : 'bg-gray-300'}`} aria-hidden="true" />
          </button>
        ) : (
          <div className="relative flex items-center justify-center p-1.5 rounded-l-md" title={title} aria-label={title}>
            <img src={src} alt="" width={16} height={16} aria-hidden="true" className="transition-opacity opacity-30" />
            <span className="absolute bottom-0.5 right-0.5 w-2 h-2 rounded-full border border-white bg-gray-300" aria-hidden="true" />
          </div>
        )}
        <div className="w-px self-stretch bg-gray-200" aria-hidden="true" />
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-label={`${label} settings`}
          aria-expanded={open}
          aria-haspopup="true"
          className="flex items-center justify-center px-1 py-1.5 rounded-r-md hover:bg-gray-50 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400"
        >
          <ChevronDown size={10} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
      </div>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-64 bg-white border border-gray-200 rounded-md shadow-lg z-50 p-3">
          {configured ? (
            <>
              <IntegrationConfigContent type={type} />
              <div className="mt-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={handleOpenSettings}
                  className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 hover:underline"
                >
                  <ExternalLink size={11} aria-hidden="true" />
                  Open in settings
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-gray-700">{label}</p>
              <p className="text-xs text-gray-500">Not configured. Set the required environment variables to enable this integration.</p>
              <button
                type="button"
                onClick={handleOpenSettings}
                className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline"
              >
                <ExternalLink size={11} aria-hidden="true" />
                Setup connection
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function TeamsIntegrationButton({ connected, title, onClick, disabled, onOpenSettings }: IntegrationButtonBaseProps) {
  return (
    <IntegrationDropdown
      type="teams"
      connected={connected}
      title={title}
      onClick={onClick}
      disabled={disabled}
      label="Microsoft Teams"
      onOpenSettings={onOpenSettings}
    />
  );
}

export function SlackIntegrationButton({ connected, title, onClick, disabled, onOpenSettings }: IntegrationButtonBaseProps) {
  return (
    <IntegrationDropdown
      type="slack"
      connected={connected}
      title={title}
      onClick={onClick}
      disabled={disabled}
      label="Slack"
      onOpenSettings={onOpenSettings}
    />
  );
}
