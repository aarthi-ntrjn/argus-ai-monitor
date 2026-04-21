import { useCallback, useState } from 'react';
import { Copy, Check } from 'lucide-react';
import Badge from '../Badge';
import { SectionHeading } from '../SectionHeading';
import { useTeamsSettings } from '../../hooks/useTeamsSettings';
import { useSlackSettings } from '../../hooks/useSlackSettings';
import { useIntegrationControl } from '../../hooks/useIntegrationControl';
import type { IntegrationVisibleStatus } from '../IntegrationButton/IntegrationButton';

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

const STATUS_BADGE: Record<IntegrationVisibleStatus, { text: string; colorClass: string }> = {
  'not-configured': { text: 'not configured', colorClass: 'bg-gray-100 text-gray-600' },
  'disconnected':   { text: 'disconnected',   colorClass: 'bg-amber-100 text-amber-700' },
  'connected':      { text: 'connected',       colorClass: 'bg-green-100 text-green-700' },
};

function IntegrationHeader({ label, badge }: { label: string; badge: { text: string; colorClass: string } }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <SectionHeading>{label}</SectionHeading>
      <Badge colorClass={badge.colorClass}>{badge.text}</Badge>
    </div>
  );
}

function TeamsConfigContent() {
  const { config } = useTeamsSettings();
  const { teamsRunning } = useIntegrationControl();
  const status: IntegrationVisibleStatus =
    !config || config.connectionStatus === 'unconfigured' ? 'not-configured'
    : teamsRunning ? 'connected'
    : 'disconnected';
  const fields = [
    { label: 'Team ID', value: config?.teamId },
    { label: 'Channel ID', value: config?.channelId },
    { label: 'Owner AAD Object ID', value: config?.ownerAadObjectId },
    { label: 'Webhook URL', value: `${window.location.origin}/api/v1/teams/webhook` },
  ];
  return (
    <>
      <IntegrationHeader label="Microsoft Teams" badge={STATUS_BADGE[status]} />
      <ConfigFields fields={fields} />
    </>
  );
}

function SlackConfigContent() {
  const { config } = useSlackSettings();
  const { slackConfigured, slackRunning } = useIntegrationControl();
  const status: IntegrationVisibleStatus =
    !slackConfigured || !config ? 'not-configured'
    : slackRunning ? 'connected'
    : 'disconnected';
  const fields = [
    { label: 'Bot Token', value: config?.botToken },
    { label: 'App Token', value: config?.appToken },
    { label: 'Channel ID', value: config?.channelId },
  ];
  return (
    <>
      <IntegrationHeader label="Slack" badge={STATUS_BADGE[status]} />
      <ConfigFields fields={fields} />
    </>
  );
}

export function IntegrationConfigContent({ type }: { type: 'teams' | 'slack' }) {
  return type === 'teams' ? <TeamsConfigContent /> : <SlackConfigContent />;
}
