import { useCallback, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import Badge from '../Badge';
import { Button } from '../Button';
import { SectionHeading } from '../SectionHeading';
import { useTeamsSettings } from '../../hooks/useTeamsSettings';
import { useSlackSettings } from '../../hooks/useSlackSettings';
import { useIntegrationControl } from '../../hooks/useIntegrationControl';
import type { IntegrationVisibleStatus } from '../IntegrationButton/IntegrationButton';

const STATUS_BADGE: Record<IntegrationVisibleStatus, { text: string; colorClass: string }> = {
  'not-configured': { text: 'not configured', colorClass: 'bg-gray-100 text-gray-600' },
  'disconnected':   { text: 'disconnected',   colorClass: 'bg-amber-100 text-amber-700' },
  'connected':      { text: 'connected',       colorClass: 'bg-green-100 text-green-700' },
};

function IntegrationHeader({ label, badge }: { label: string; badge: { text: string; colorClass: string } }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <SectionHeading>{label}</SectionHeading>
      <Badge colorClass={badge.colorClass}>{badge.text}</Badge>
    </div>
  );
}

function SetupGuideLink({ to }: { to: string }) {
  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      <Link
        to={to}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 hover:underline"
      >
        <ExternalLink size={11} aria-hidden="true" />
        View setup guide
      </Link>
    </div>
  );
}

interface FieldDef {
  key: string;
  label: string;
  placeholder?: string;
  secret?: boolean;
}

function ConfigForm({
  fields,
  values,
  saving,
  saveError,
  onSave,
}: {
  fields: FieldDef[];
  values: Record<string, string>;
  saving: boolean;
  saveError: string | null;
  onSave: (patch: Record<string, string>) => Promise<void>;
}) {
  const [draft, setDraft] = useState<Record<string, string>>(values);
  const [saved, setSaved] = useState(false);

  const handleChange = useCallback((key: string, val: string) => {
    setDraft(prev => ({ ...prev, [key]: val }));
    setSaved(false);
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await onSave(draft);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { /* saveError shown via prop */ }
  }, [draft, onSave]);

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
      {fields.map(({ key, label, placeholder, secret }) => (
        <div key={key}>
          <label className="block text-xs text-gray-500 mb-0.5" htmlFor={`cfg-${key}`}>{label}</label>
          <input
            id={`cfg-${key}`}
            type={secret ? 'password' : 'text'}
            value={draft[key] ?? ''}
            onChange={e => handleChange(key, e.target.value)}
            placeholder={placeholder ?? ''}
            autoComplete="off"
            className="w-full text-xs font-mono border border-gray-200 rounded px-2 py-1 text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
          />
        </div>
      ))}
      {saveError && (
        <p role="alert" className="text-xs text-red-600">{saveError}</p>
      )}
      <div className="flex items-center gap-2 mt-1">
        <Button type="submit" variant="primary" size="sm" disabled={saving}>
          {saving ? 'Saving…' : saved ? 'Saved!' : 'Save'}
        </Button>
        <p className="text-xs text-gray-400">Changes apply on next Connect.</p>
      </div>
    </form>
  );
}

function TeamsConfigContent({ showSetupGuide }: { showSetupGuide: boolean }) {
  const { config, saving, saveError, save } = useTeamsSettings();
  const { teamsRunning } = useIntegrationControl();
  const status: IntegrationVisibleStatus =
    !config || config.connectionStatus === 'unconfigured' ? 'not-configured'
    : teamsRunning ? 'connected'
    : 'disconnected';

  const fields: FieldDef[] = [
    { key: 'teamId',           label: 'Team ID',               placeholder: 'e.g. 19:...' },
    { key: 'channelId',        label: 'Channel ID',            placeholder: 'e.g. 19:...' },
    { key: 'ownerAadObjectId', label: 'Owner AAD Object ID',   placeholder: 'e.g. xxxxxxxx-xxxx-...' },
    { key: 'clientId',         label: 'Client ID (App)',        placeholder: 'Azure app client ID' },
    { key: 'tenantId',         label: 'Tenant ID',             placeholder: 'Azure tenant ID' },
  ];

  const values: Record<string, string> = {
    teamId:           config?.teamId ?? '',
    channelId:        config?.channelId ?? '',
    ownerAadObjectId: config?.ownerAadObjectId ?? '',
    clientId:         config?.clientId ?? '',
    tenantId:         config?.tenantId ?? '',
  };

  return (
    <>
      <IntegrationHeader label="Microsoft Teams" badge={STATUS_BADGE[status]} />
      <ConfigForm
        key={config ? 'loaded' : 'empty'}
        fields={fields}
        values={values}
        saving={saving}
        saveError={saveError}
        onSave={save}
      />
      <div className="mt-2">
        <p className="text-xs text-gray-400">Webhook URL: <span className="font-mono">{window.location.origin}/api/v1/teams/webhook</span></p>
      </div>
      {showSetupGuide && <SetupGuideLink to="/setup/teams" />}
    </>
  );
}

function SlackConfigContent({ showSetupGuide }: { showSetupGuide: boolean }) {
  const { config, saving, saveError, save } = useSlackSettings();
  const { slackConfigured, slackRunning } = useIntegrationControl();
  const status: IntegrationVisibleStatus =
    !slackConfigured || !config ? 'not-configured'
    : slackRunning ? 'connected'
    : 'disconnected';

  const fields: FieldDef[] = [
    { key: 'botToken',    label: 'Bot Token',    placeholder: 'xoxb-...', secret: true },
    { key: 'appToken',    label: 'App Token',    placeholder: 'xapp-...', secret: true },
    { key: 'channelId',   label: 'Channel ID',   placeholder: 'C...' },
    { key: 'ownerUserId', label: 'Owner User ID', placeholder: 'U... (required, your Slack user ID)' },
  ];

  const values: Record<string, string> = {
    botToken:    config?.botToken ?? '',
    appToken:    config?.appToken ?? '',
    channelId:   config?.channelId ?? '',
    ownerUserId: config?.ownerUserId ?? '',
  };

  return (
    <>
      <IntegrationHeader label="Slack" badge={STATUS_BADGE[status]} />
      <ConfigForm
        key={config ? 'loaded' : 'empty'}
        fields={fields}
        values={values}
        saving={saving}
        saveError={saveError}
        onSave={save}
      />
      {showSetupGuide && <SetupGuideLink to="/setup/slack" />}
    </>
  );
}

export function IntegrationConfigContent({ type, showSetupGuide = true }: { type: 'teams' | 'slack'; showSetupGuide?: boolean }) {
  return type === 'teams'
    ? <TeamsConfigContent showSetupGuide={showSetupGuide} />
    : <SlackConfigContent showSetupGuide={showSetupGuide} />;
}
