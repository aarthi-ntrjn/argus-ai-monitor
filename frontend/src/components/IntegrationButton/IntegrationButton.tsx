import { useRef, useState, useEffect, useCallback } from 'react';
import { ChevronDown, Copy, Check } from 'lucide-react';
import teamsUrl from '../../images/microsoft-teams.svg?url';
import slackUrl from '../../images/slack.svg?url';
import Badge from '../Badge';
import { useTeamsSettings } from '../../hooks/useTeamsSettings';
import { useSlackSettings } from '../../hooks/useSlackSettings';

function CopyButton({ value }: { value: string | undefined }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    if (!value) return;
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [value]);
  if (!value) return null;
  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label="Copy to clipboard"
      title="Copy to clipboard"
      className="icon-btn text-gray-400 hover:text-blue-600 shrink-0"
    >
      {copied ? <Check size={11} aria-hidden="true" /> : <Copy size={11} aria-hidden="true" />}
    </button>
  );
}

interface IntegrationButtonBaseProps {
  connected: boolean;
  title: string;
  onClick?: () => void;
  disabled?: boolean;
}

interface DropdownProps extends IntegrationButtonBaseProps {
  type: 'teams' | 'slack';
  label: string;
  configFields: { label: string; value: string | undefined }[];
  badge: { text: string; colorClass: string } | null;
}

function IntegrationDropdown({ type, connected, title, onClick, disabled, label, configFields, badge }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
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

  return (
    <div className="relative" ref={ref}>
      <div className="flex items-center rounded-md border border-gray-200 bg-white hover:border-gray-300 transition-colors">
        {onClick ? (
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
            <img src={src} alt="" width={16} height={16} aria-hidden="true" className={`transition-opacity ${connected ? 'opacity-90' : 'opacity-30'}`} />
            <span className={`absolute bottom-0.5 right-0.5 w-2 h-2 rounded-full border border-white ${connected ? 'bg-green-500' : 'bg-gray-300'}`} aria-hidden="true" />
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
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">{label}</span>
            {badge && <Badge colorClass={badge.colorClass}>{badge.text}</Badge>}
          </div>
          <div className="flex flex-col gap-1.5">
            <p className="text-xs text-gray-500">Configured via environment variables.</p>
            {configFields.map(({ label: fieldLabel, value }) => (
              <div key={fieldLabel}>
                <p className="text-xs text-gray-500 mb-0.5">{fieldLabel}</p>
                <div className="flex items-start gap-1">
                  <p className="text-xs font-mono text-gray-700 break-all flex-1">
                    {value ?? <span className="text-gray-400">not set</span>}
                  </p>
                  <CopyButton value={value} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function TeamsIntegrationButton({ connected, title, onClick, disabled }: IntegrationButtonBaseProps) {
  const { config } = useTeamsSettings();
  const fields = [
    { label: 'Team ID', value: config?.teamId },
    { label: 'Channel ID', value: config?.channelId },
    { label: 'Owner AAD Object ID', value: config?.ownerAadObjectId },
    { label: 'Webhook URL', value: `${window.location.origin}/api/v1/teams/webhook` },
  ];
  const badge = config ? {
    text: config.connectionStatus,
    colorClass: config.connectionStatus === 'connected' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600',
  } : null;
  return (
    <IntegrationDropdown
      type="teams"
      connected={connected}
      title={title}
      onClick={onClick}
      disabled={disabled}
      label="Microsoft Teams"
      configFields={fields}
      badge={badge}
    />
  );
}

export function SlackIntegrationButton({ connected, title, onClick, disabled }: IntegrationButtonBaseProps) {
  const { config } = useSlackSettings();
  const fields = [
    { label: 'Bot Token', value: config?.botToken },
    { label: 'App Token', value: config?.appToken },
    { label: 'Channel ID', value: config?.channelId },
  ];
  const badge = config ? {
    text: config.enabled ? 'connected' : 'disconnected',
    colorClass: config.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600',
  } : null;
  return (
    <IntegrationDropdown
      type="slack"
      connected={connected}
      title={title}
      onClick={onClick}
      disabled={disabled}
      label="Slack"
      configFields={fields}
      badge={badge}
    />
  );
}
