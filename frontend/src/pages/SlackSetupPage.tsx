import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Copy, Check } from 'lucide-react';
import ArgusLogo from '../components/ArgusLogo';
import slackUrl from '../images/slack.svg?url';

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const handle = useCallback(() => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [value]);
  return (
    <button type="button" onClick={handle} aria-label="Copy to clipboard" className="icon-btn text-gray-400 hover:text-blue-600 shrink-0">
      {copied ? <Check size={12} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}
    </button>
  );
}

function CodeBlock({ value }: { value: string }) {
  return (
    <div className="flex items-start gap-2 bg-gray-50 border border-gray-200 rounded-md px-3 py-2.5 mt-2">
      <code className="text-xs font-mono text-gray-800 flex-1 whitespace-pre">{value}</code>
      <CopyButton value={value} />
    </div>
  );
}

function Mono({ children }: { children: string }) {
  return <code className="text-xs font-mono bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded">{children}</code>;
}

function ExternalA({ href, children }: { href: string; children: string }) {
  return <a href={href} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{children}</a>;
}

const SCOPES = [
  ['chat:write',       'Post messages and thread replies'],
  ['channels:read',    'Look up channel information'],
  ['app_mentions:read','Receive @mention events'],
  ['im:history',       'Receive direct messages'],
] as const;

const ENV_BLOCK = `SLACK_BOT_TOKEN=xoxb-...        # required
SLACK_CHANNEL_ID=C01234ABCDE    # required
SLACK_APP_TOKEN=xapp-...        # optional — enables inbound commands`;

const LOG_BLOCK = `[SlackNotifier] Initialized, posting to channel C01234ABCDE
[SlackListener] Socket Mode connected, listening for app mentions and DMs`;

interface Step { title: string; body: React.ReactNode; }

const STEPS: Step[] = [
  {
    title: 'Create the app',
    body: (
      <ol className="space-y-1.5 text-sm text-gray-600 list-decimal pl-4">
        <li>Go to <ExternalA href="https://api.slack.com/apps">api.slack.com/apps</ExternalA> and sign in.</li>
        <li>Click <strong>Create New App</strong> → <strong>From scratch</strong>.</li>
        <li>Name the app (e.g. <Mono>Argus</Mono>) and select your workspace.</li>
        <li>Click <strong>Create App</strong>.</li>
      </ol>
    ),
  },
  {
    title: 'Add bot token scopes',
    body: (
      <>
        <ol className="space-y-1.5 text-sm text-gray-600 list-decimal pl-4 mb-3">
          <li>In the left sidebar, click <strong>OAuth and Permissions</strong>.</li>
          <li>Scroll to <strong>Scopes → Bot Token Scopes</strong> and add these four:</li>
        </ol>
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left font-medium text-gray-500 py-1.5 pr-6 w-2/5">Scope</th>
              <th className="text-left font-medium text-gray-500 py-1.5">Purpose</th>
            </tr>
          </thead>
          <tbody>
            {SCOPES.map(([scope, purpose]) => (
              <tr key={scope} className="border-b border-gray-100">
                <td className="py-1.5 pr-6 font-mono text-gray-800">{scope}</td>
                <td className="py-1.5 text-gray-600">{purpose}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </>
    ),
  },
  {
    title: 'Enable Socket Mode',
    body: (
      <>
        <ol className="space-y-1.5 text-sm text-gray-600 list-decimal pl-4 mb-3">
          <li>Click <strong>Socket Mode</strong> in the sidebar and toggle it on.</li>
          <li>When prompted, create an App-level token: name it anything (e.g. <Mono>argus-socket</Mono>), add scope <Mono>connections:write</Mono>, click <strong>Generate</strong>.</li>
          <li>Copy the <Mono>xapp-...</Mono> token — this is your <Mono>SLACK_APP_TOKEN</Mono>.</li>
        </ol>
        <p className="text-xs text-gray-400">Skip this step if you only need outbound notifications and don't need the bot to respond to commands.</p>
      </>
    ),
  },
  {
    title: 'Subscribe to bot events',
    body: (
      <ol className="space-y-1.5 text-sm text-gray-600 list-decimal pl-4">
        <li>Click <strong>Event Subscriptions</strong> in the sidebar and toggle <strong>Enable Events</strong> on.</li>
        <li>Under <strong>Subscribe to bot events</strong>, add <Mono>app_mention</Mono> and <Mono>message.im</Mono>.</li>
        <li>Click <strong>Save Changes</strong>.</li>
      </ol>
    ),
  },
  {
    title: 'Install to your workspace',
    body: (
      <ol className="space-y-1.5 text-sm text-gray-600 list-decimal pl-4">
        <li>Click <strong>OAuth and Permissions</strong> in the sidebar.</li>
        <li>Click <strong>Install to Workspace</strong> and allow the permissions.</li>
        <li>Copy the <strong>Bot User OAuth Token</strong> (<Mono>xoxb-...</Mono>) — this is your <Mono>SLACK_BOT_TOKEN</Mono>.</li>
      </ol>
    ),
  },
  {
    title: 'Get your channel ID',
    body: (
      <>
        <ol className="space-y-1.5 text-sm text-gray-600 list-decimal pl-4 mb-2">
          <li>In Slack, open the channel you want Argus to post to.</li>
          <li>Right-click the channel name → <strong>View channel details</strong>.</li>
          <li>Scroll to the bottom and copy the Channel ID (format: <Mono>C01234ABCDE</Mono>) — this is your <Mono>SLACK_CHANNEL_ID</Mono>.</li>
          <li>Invite the bot to the channel:</li>
        </ol>
        <CodeBlock value="/invite @Argus" />
      </>
    ),
  },
  {
    title: 'Configure Argus',
    body: (
      <>
        <p className="text-sm text-gray-600 mb-1">Add to <Mono>backend/.env</Mono>:</p>
        <CodeBlock value={ENV_BLOCK} />
      </>
    ),
  },
  {
    title: 'Verify the connection',
    body: (
      <>
        <p className="text-sm text-gray-600 mb-1">Restart Argus and check the server logs for:</p>
        <CodeBlock value={LOG_BLOCK} />
        <p className="text-sm text-gray-600 mt-3 mb-1">Type this in your Slack channel to confirm the bot responds:</p>
        <CodeBlock value="@Argus help" />
      </>
    ),
  },
];

export default function SlackSetupPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-12">
      <div className="mx-auto max-w-2xl">

        <div className="mb-8">
          <button onClick={() => navigate('/')} className="icon-btn text-sm text-gray-600 hover:text-blue-600 mb-6 flex items-center gap-1.5">
            <ArrowLeft size={14} aria-hidden="true" /> Back
          </button>
          <div className="flex items-center gap-2.5 mb-1">
            <ArgusLogo size={24} />
            <img src={slackUrl} alt="" width={20} height={20} aria-hidden="true" />
            <h1 className="text-xl font-semibold text-gray-900">Slack Setup</h1>
          </div>
          <p className="text-sm text-gray-500">Connect Argus to a Slack channel in 8 steps.</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg px-6 py-5 mb-4">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Prerequisites</h2>
          <ul className="space-y-1.5 text-sm text-gray-600 list-disc pl-4">
            <li>A Slack workspace — free tier is sufficient. <ExternalA href="https://slack.com/help/articles/206845317-Create-a-Slack-workspace">Create one</ExternalA> if you don't have one.</li>
            <li>Admin access to the workspace, or permission to install apps.</li>
          </ul>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg px-6 py-5">
          {STEPS.map((step, i) => (
            <div key={step.title} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-semibold shrink-0">
                  {i + 1}
                </div>
                {i < STEPS.length - 1 && <div className="w-px flex-1 bg-gray-100 my-1.5" />}
              </div>
              <div className={`flex-1 ${i < STEPS.length - 1 ? 'pb-6' : 'pb-0'}`}>
                <h2 className="text-sm font-semibold text-gray-900 mb-2 leading-6">{step.title}</h2>
                {step.body}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6">
          <button onClick={() => navigate('/')} className="icon-btn text-sm text-gray-500 hover:text-blue-600 flex items-center gap-1.5">
            <ArrowLeft size={13} aria-hidden="true" /> Back to Argus
          </button>
        </div>

      </div>
    </div>
  );
}
