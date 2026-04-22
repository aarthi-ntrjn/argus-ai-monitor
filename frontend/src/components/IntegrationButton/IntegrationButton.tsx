import { useRef, useState, useEffect } from 'react';
import { ChevronDown, ExternalLink, Pencil } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import teamsUrl from '../../images/microsoft-teams.svg?url';
import slackUrl from '../../images/slack.svg?url';
import { useTeamsSettings } from '../../hooks/useTeamsSettings';
import { useSlackSettings } from '../../hooks/useSlackSettings';

export type IntegrationVisibleStatus = 'not-configured' | 'disconnected' | 'connected';

interface DropdownProps {
  type: 'teams' | 'slack';
  label: string;
  status: IntegrationVisibleStatus;
  onToggle?: () => void;
  disabled?: boolean;
  onOpenSettings: () => void;
}

const STATUS_DOT: Record<IntegrationVisibleStatus, string> = {
  'not-configured': 'bg-gray-300',
  'disconnected':   'bg-amber-400',
  'connected':      'bg-green-500',
};

function IntegrationDropdown({ type, label, status, onToggle, disabled, onOpenSettings }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const src = type === 'teams' ? teamsUrl : slackUrl;

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

  const handleOpenSettings = () => { setOpen(false); onOpenSettings(); };
  const handleSetupGuide = () => { setOpen(false); navigate(type === 'teams' ? '/setup/teams' : '/setup/slack'); };

  const iconOpacity = status === 'not-configured' ? 'opacity-30' : 'opacity-90';
  const toggleTitle =
    status === 'connected' ? `${label}: running - click to stop`
    : status === 'disconnected' ? `${label}: stopped - click to start`
    : `${label}: not configured`;

  return (
    <div className="relative" ref={ref}>
      <div className="flex items-center rounded-md border border-gray-200 bg-white hover:border-gray-300 transition-colors">
        {onToggle ? (
          <button
            type="button"
            onClick={onToggle}
            disabled={disabled}
            title={toggleTitle}
            aria-label={toggleTitle}
            className="relative flex items-center justify-center p-1.5 rounded-l-md hover:bg-gray-50 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <img src={src} alt="" width={16} height={16} aria-hidden="true" className={`transition-opacity ${iconOpacity}`} />
            <span className={`absolute bottom-0.5 right-0.5 w-2 h-2 rounded-full border border-white ${STATUS_DOT[status]}`} aria-hidden="true" />
          </button>
        ) : (
          <div className="relative flex items-center justify-center p-1.5 rounded-l-md" title={toggleTitle} aria-label={toggleTitle}>
            <img src={src} alt="" width={16} height={16} aria-hidden="true" className={`transition-opacity ${iconOpacity}`} />
            <span className={`absolute bottom-0.5 right-0.5 w-2 h-2 rounded-full border border-white ${STATUS_DOT[status]}`} aria-hidden="true" />
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
          {status === 'not-configured' ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-gray-700">{label}</p>
              <p className="text-xs text-gray-500">
                Not configured. Set the required environment variables to enable this integration.
              </p>
              <button
                type="button"
                onClick={handleSetupGuide}
                className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline"
              >
                <ExternalLink size={11} aria-hidden="true" />
                Setup connection
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-gray-700">{label}</p>
              <p className="text-xs text-gray-500">
                {status === 'connected' ? 'Integration is running.' : 'Integration is stopped.'}
              </p>
              <button
                type="button"
                onClick={handleOpenSettings}
                className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline"
              >
                <Pencil size={11} aria-hidden="true" />
                Edit in settings
              </button>
              {status !== 'connected' && (
                <button
                  type="button"
                  onClick={handleSetupGuide}
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600 hover:underline"
                >
                  <ExternalLink size={11} aria-hidden="true" />
                  View setup guide
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface TeamsIntegrationButtonProps {
  running: boolean;
  disabled?: boolean;
  onToggle: () => void;
  onOpenSettings: () => void;
}

export function TeamsIntegrationButton({ running, disabled, onToggle, onOpenSettings }: TeamsIntegrationButtonProps) {
  const { config } = useTeamsSettings();
  const status: IntegrationVisibleStatus =
    !config || config.connectionStatus === 'unconfigured' ? 'not-configured'
    : running ? 'connected'
    : 'disconnected';
  return (
    <IntegrationDropdown
      type="teams"
      label="Microsoft Teams"
      status={status}
      onToggle={status !== 'not-configured' ? onToggle : undefined}
      disabled={disabled}
      onOpenSettings={onOpenSettings}
    />
  );
}

interface SlackIntegrationButtonProps {
  running: boolean;
  configured: boolean;
  disabled?: boolean;
  onToggle: () => void;
  onOpenSettings: () => void;
}

export function SlackIntegrationButton({ running, configured, disabled, onToggle, onOpenSettings }: SlackIntegrationButtonProps) {
  const { config } = useSlackSettings();
  const status: IntegrationVisibleStatus =
    !configured || !config ? 'not-configured'
    : running ? 'connected'
    : 'disconnected';
  return (
    <IntegrationDropdown
      type="slack"
      label="Slack"
      status={status}
      onToggle={status !== 'not-configured' ? onToggle : undefined}
      disabled={disabled}
      onOpenSettings={onOpenSettings}
    />
  );
}
