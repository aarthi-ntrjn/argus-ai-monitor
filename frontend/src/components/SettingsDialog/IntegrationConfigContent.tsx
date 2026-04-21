import { useCallback, useState } from 'react';
import { Copy, Check } from 'lucide-react';
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

function ConfigFields({ fields }: { fields: { label: string; value: string | undefined }[] }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs text-gray-500">Configured via environment variables.</p>
      {fields.map(({ label, value }) => (
        <div key={label}>
          <p className="text-xs text-gray-500 mb-0.5">{label}</p>
          <div className="flex items-start gap-1">
            <p className="text-xs font-mono text-gray-700 break-all flex-1">
              {value ?? <span className="text-gray-400">not set</span>}
            </p>
            <CopyButton value={value} />
          </div>
        </div>
      ))}
    </div>
  );
}

function TeamsConfigContent() {
  const { config } = useTeamsSettings();
  const badge = config
    ? {
        text: config.connectionStatus,
        colorClass: config.connectionStatus === 'connected' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600',
      }
    : null;
  const fields = [
    { label: 'Team ID', value: config?.teamId },
    { label: 'Channel ID', value: config?.channelId },
    { label: 'Owner AAD Object ID', value: config?.ownerAadObjectId },
    { label: 'Webhook URL', value: `${window.location.origin}/api/v1/teams/webhook` },
  ];
  return (
    <>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700">Microsoft Teams</span>
        {badge && <Badge colorClass={badge.colorClass}>{badge.text}</Badge>}
      </div>
      <ConfigFields fields={fields} />
    </>
  );
}

function SlackConfigContent() {
  const { config } = useSlackSettings();
  const badge = config
    ? {
        text: config.enabled ? 'connected' : 'disconnected',
        colorClass: config.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600',
      }
    : null;
  const fields = [
    { label: 'Bot Token', value: config?.botToken },
    { label: 'App Token', value: config?.appToken },
    { label: 'Channel ID', value: config?.channelId },
  ];
  return (
    <>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700">Slack</span>
        {badge && <Badge colorClass={badge.colorClass}>{badge.text}</Badge>}
      </div>
      <ConfigFields fields={fields} />
    </>
  );
}

export function IntegrationConfigContent({ type }: { type: 'teams' | 'slack' }) {
  return type === 'teams' ? <TeamsConfigContent /> : <SlackConfigContent />;
}
