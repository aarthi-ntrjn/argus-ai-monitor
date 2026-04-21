import { useCallback, useState } from 'react';
import { Copy, Check, ChevronDown } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';
import Badge from '../Badge';
import { SectionHeading } from '../SectionHeading';
import { useTeamsSettings } from '../../hooks/useTeamsSettings';
import { useSlackSettings } from '../../hooks/useSlackSettings';
import { useIntegrationControl } from '../../hooks/useIntegrationControl';
import type { IntegrationVisibleStatus } from '../IntegrationButton/IntegrationButton';
import teamsGuide from '../../../../docs/README-TEAMS-APP.md?raw';
import slackGuide from '../../../../docs/README-SLACK-APP.md?raw';

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

const GUIDE_COMPONENTS: Components = {
  h1: () => null,
  h2: ({ children }) => <p className="text-xs font-semibold text-gray-700 mt-3 mb-1 first:mt-0">{children}</p>,
  h3: ({ children }) => <p className="text-xs font-medium text-gray-600 mt-2 mb-0.5">{children}</p>,
  p: ({ children }) => <p className="text-xs text-gray-600 mb-1">{children}</p>,
  a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{children}</a>,
  code: ({ children, className }) => {
    const isBlock = className?.startsWith('language-');
    return isBlock
      ? <code className="block text-xs font-mono bg-gray-50 border border-gray-200 rounded p-2 overflow-x-auto mb-1 whitespace-pre">{children}</code>
      : <code className="text-xs font-mono bg-gray-100 text-gray-700 px-1 py-0.5 rounded">{children}</code>;
  },
  pre: ({ children }) => <>{children}</>,
  ul: ({ children }) => <ul className="list-disc pl-4 mb-1 space-y-0.5 text-xs text-gray-600">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-4 mb-1 space-y-0.5 text-xs text-gray-600">{children}</ol>,
  li: ({ children }) => <li>{children}</li>,
  blockquote: ({ children }) => <blockquote className="border-l-2 border-gray-200 pl-2 text-gray-500 text-xs italic my-1">{children}</blockquote>,
  hr: () => <hr className="border-gray-100 my-2" />,
  table: ({ children }) => <table className="text-xs w-full border-collapse mb-2">{children}</table>,
  th: ({ children }) => <th className="text-left text-xs font-medium text-gray-600 border-b border-gray-200 py-1 px-2">{children}</th>,
  td: ({ children }) => <td className="text-xs text-gray-600 border-b border-gray-100 py-1 px-2">{children}</td>,
};

function SetupGuide({ content, initialExpanded = false }: { content: string; initialExpanded?: boolean }) {
  const [expanded, setExpanded] = useState(initialExpanded);
  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 hover:underline"
      >
        <ChevronDown size={11} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
        Setup guide
      </button>
      {expanded && (
        <div className="mt-2 max-h-80 overflow-y-auto pr-1">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={GUIDE_COMPONENTS}>
            {content}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
}

function TeamsConfigContent({ expandSetupGuide }: { expandSetupGuide?: boolean }) {
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
      <SetupGuide content={teamsGuide} initialExpanded={expandSetupGuide} />
    </>
  );
}

function SlackConfigContent({ expandSetupGuide }: { expandSetupGuide?: boolean }) {
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
      <SetupGuide content={slackGuide} initialExpanded={expandSetupGuide} />
    </>
  );
}

export function IntegrationConfigContent({ type, expandSetupGuide }: { type: 'teams' | 'slack'; expandSetupGuide?: boolean }) {
  return type === 'teams'
    ? <TeamsConfigContent expandSetupGuide={expandSetupGuide} />
    : <SlackConfigContent expandSetupGuide={expandSetupGuide} />;
}
