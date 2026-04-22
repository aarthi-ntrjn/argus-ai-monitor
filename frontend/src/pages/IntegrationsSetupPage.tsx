import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import ArgusLogo from '../components/ArgusLogo';
import { CodeBlock, Mono, ExternalA } from '../components/SetupPage/SetupPage';
import type { SetupStep } from '../components/SetupPage/SetupPage';
import teamsUrl from '../images/microsoft-teams.svg?url';
import slackUrl from '../images/slack.svg?url';

// ---------------------------------------------------------------------------
// Teams content
// ---------------------------------------------------------------------------

const TUNNEL_SETUP = `devtunnel create argus-tunnel --allow-anonymous
devtunnel port create argus-tunnel -p 7411`;

const BOT_CREATE = `teams login
teams app create --name "Argus" \\
  --endpoint "https://<endpoint>/api/v1/teams/webhook" \\
  --env .env`;

const TEAMS_STEPS: SetupStep[] = [
  {
    title: 'Set up a tunnel',
    body: (
      <>
        <p className="text-sm text-gray-600 mb-3">Teams delivers webhook events to Argus over HTTPS. Since Argus runs on your local machine, use a dev tunnel to expose it.</p>
        <p className="text-sm text-gray-600 mb-1">Create a persistent tunnel (one-time):</p>
        <div className="flex items-center gap-3 mt-2 mb-2">
          <Mono>devtunnel login</Mono>
          <span className="text-xs text-gray-400">Sign in with your GitHub or personal Microsoft account.</span>
        </div>
        <CodeBlock value={TUNNEL_SETUP} />
        <p className="text-sm text-gray-600 mt-3 mb-1">Start it each session:</p>
        <CodeBlock value="devtunnel host argus-tunnel" />
        <p className="text-sm text-gray-600 mt-3">Note the printed URL, e.g. <Mono>{'https://<tunnel-id>-7411.<region>.devtunnels.ms'}</Mono>. This is your <Mono>{'<endpoint>'}</Mono> in the next step.</p>
      </>
    ),
  },
  {
    title: 'Create the bot',
    body: (
      <>
        <CodeBlock value={BOT_CREATE} />
        <p className="text-sm text-gray-600 mt-3">This registers the bot, generates credentials (<strong>Client ID</strong>, <strong>Client Secret</strong>, <strong>Tenant ID</strong>), and prints an install link. Open the install link to add the bot to your team.</p>
        <p className="text-xs text-gray-400 mt-2">Use your tunnel URL for <Mono>{'<endpoint>'}</Mono> during local dev.</p>
      </>
    ),
  },
  {
    title: 'Get your Team ID, Channel ID, and AAD Object ID',
    body: (
      <ol className="space-y-3 text-sm text-gray-600 list-decimal pl-4">
        <li><strong>Team ID:</strong> Right-click the team name in Teams &rarr; <strong>Get link to team</strong>. The <Mono>groupId</Mono> parameter is your <strong>Team ID</strong>.</li>
        <li><strong>Channel ID:</strong> Right-click the channel &rarr; <strong>Get link to channel</strong>. The decoded value starting with <Mono>19:</Mono> is your <strong>Channel ID</strong> (format: <Mono>{'19:xxxxxxxx@thread.tacv2'}</Mono>).</li>
        <li><strong>AAD Object ID:</strong> In the <ExternalA href="https://portal.azure.com">Azure portal</ExternalA>, go to <strong>Microsoft Entra ID &rarr; Users</strong>, click your account, and copy the <strong>Object ID</strong>.</li>
      </ol>
    ),
  },
  {
    title: 'Configure Argus',
    body: (
      <>
        <p className="text-sm text-gray-600 mb-2">Open the Argus Settings dialog and go to the <strong>Microsoft Teams</strong> section. Enter:</p>
        <ul className="space-y-1 text-sm text-gray-600 list-disc pl-4 mb-3">
          <li><strong>Team ID</strong> and <strong>Channel ID</strong> from your Teams workspace</li>
          <li><strong>Owner AAD Object ID</strong> (your Azure AD user object ID)</li>
          <li><strong>Client ID</strong>, <strong>Client Secret</strong>, and <strong>Tenant ID</strong> from the bot create command</li>
        </ul>
        <p className="text-sm text-gray-600">Click <strong>Save</strong>, then restart Argus.</p>
      </>
    ),
  },
  {
    title: 'Verify the connection',
    body: (
      <>
        <p className="text-sm text-gray-600 mb-1">Check the server logs on startup for:</p>
        <CodeBlock value="teams: configured, subscribing to session events" />
        <p className="text-sm text-gray-600 mt-3 mb-1">Mention the bot in the channel to confirm it is reachable:</p>
        <CodeBlock value="@Argus help" />
      </>
    ),
  },
];

const TEAMS_PREREQUISITES = (
  <ul className="space-y-1.5 text-sm text-gray-600 list-disc pl-4">
    <li><ExternalA href="https://microsoft.github.io/teams-sdk/">Teams CLI</ExternalA> installed: <Mono>npm install -g @microsoft/teams.cli@preview</Mono></li>
    <li>A Microsoft Teams workspace where you are a team owner or admin. Get <ExternalA href="https://www.microsoft.com/en-us/microsoft-teams/essentials">Teams Essentials</ExternalA> or an <ExternalA href="https://www.microsoft.com/en-us/microsoft-365/business/microsoft-365-plans-and-pricing">M365 tenant</ExternalA> if you don't have one.</li>
    <li>For local dev: <ExternalA href="https://learn.microsoft.com/en-us/azure/developer/dev-tunnels/">Azure Dev Tunnels CLI</ExternalA> — <Mono>winget install Microsoft.DevTunnel</Mono> or <Mono>brew install devtunnel</Mono>.</li>
  </ul>
);

const TEAMS_TROUBLESHOOTING: { symptom: string; fix: React.ReactNode }[] = [
  {
    symptom: 'Bot not receiving messages / no webhook calls',
    fix: <>Check that <Mono>devtunnel host argus-tunnel</Mono> is running. The tunnel URL in the bot registration must match the one currently printed by devtunnel. Re-run <Mono>teams app create</Mono> if the URL changed.</>,
  },
  {
    symptom: 'teams: not configured, skipping event subscriptions',
    fix: <>All six fields (Team ID, Channel ID, Owner AAD Object ID, Client ID, Client Secret, Tenant ID) must be saved in Settings. Restart Argus after saving.</>,
  },
  {
    symptom: '401 Unauthorized in server logs',
    fix: <>Client ID or Client Secret is wrong or expired. Re-run <Mono>teams app create</Mono> or regenerate the secret in the Azure App Registration.</>,
  },
  {
    symptom: 'Thread is created but messages stop appearing',
    fix: <>The client secret may have expired (default lifetime is 6 months). Regenerate it in the Azure portal under App Registrations &rarr; Certificates &amp; secrets, update it in Settings, and restart Argus.</>,
  },
  {
    symptom: 'Bot installed but not visible in the channel',
    fix: <>Make sure the bot was installed to the correct team via the install link printed by <Mono>teams app create</Mono>. The Team ID must match the team where the bot is installed.</>,
  },
];

// ---------------------------------------------------------------------------
// Slack content
// ---------------------------------------------------------------------------

const SCOPES = [
  ['chat:write',        'Post messages and thread replies'],
  ['channels:read',     'Look up channel information'],
  ['app_mentions:read', 'Receive @mention events'],
  ['im:history',        'Receive direct messages'],
] as const;

const LOG_BLOCK = `[SlackNotifier] Initialized, posting to channel C01234ABCDE
[SlackListener] Socket Mode connected, listening for app mentions and DMs`;

const SLACK_STEPS: SetupStep[] = [
  {
    title: 'Create the app',
    body: (
      <ol className="space-y-1.5 text-sm text-gray-600 list-decimal pl-4">
        <li>Go to <ExternalA href="https://api.slack.com/apps">api.slack.com/apps</ExternalA> and sign in.</li>
        <li>Click <strong>Create New App</strong> &rarr; <strong>From scratch</strong>.</li>
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
          <li>Scroll to <strong>Scopes &rarr; Bot Token Scopes</strong> and add these four:</li>
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
          <li>Create an App-level token: name it (e.g. <Mono>argus-socket</Mono>), add scope <Mono>connections:write</Mono>, click <strong>Generate</strong>.</li>
          <li>Copy the <Mono>xapp-...</Mono> token — this is your <strong>App Token</strong>.</li>
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
        <li>Copy the <strong>Bot User OAuth Token</strong> (<Mono>xoxb-...</Mono>) — this is your <strong>Bot Token</strong>.</li>
      </ol>
    ),
  },
  {
    title: 'Get your channel ID',
    body: (
      <>
        <ol className="space-y-1.5 text-sm text-gray-600 list-decimal pl-4 mb-2">
          <li>Open the channel you want Argus to post to.</li>
          <li>Right-click the channel name &rarr; <strong>View channel details</strong>.</li>
          <li>Scroll to the bottom and copy the Channel ID (format: <Mono>C01234ABCDE</Mono>).</li>
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
        <p className="text-sm text-gray-600 mb-2">Open the Argus Settings dialog and go to the <strong>Slack</strong> section. Enter:</p>
        <ul className="space-y-1 text-sm text-gray-600 list-disc pl-4 mb-3">
          <li><strong>Bot Token</strong> (<Mono>xoxb-...</Mono>) from the OAuth &amp; Permissions page</li>
          <li><strong>Channel ID</strong> of the channel where Argus will post</li>
          <li><strong>App Token</strong> (<Mono>xapp-...</Mono>) for inbound commands via Socket Mode (optional)</li>
        </ul>
        <p className="text-sm text-gray-600">Click <strong>Save</strong>.</p>
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

const SLACK_PREREQUISITES = (
  <ul className="space-y-1.5 text-sm text-gray-600 list-disc pl-4">
    <li>A Slack workspace — free tier is sufficient. <ExternalA href="https://slack.com/help/articles/206845317-Create-a-Slack-workspace">Create one</ExternalA> if you don't have one.</li>
    <li>Admin access to the workspace, or permission to install apps.</li>
  </ul>
);

const SLACK_TROUBLESHOOTING: { symptom: string; fix: React.ReactNode }[] = [
  {
    symptom: 'No messages appearing in Slack',
    fix: <>Check that Bot Token and Channel ID are saved in Settings and Argus has been restarted. Confirm the bot has been invited to the channel with <Mono>/invite @Argus</Mono>. Check the server logs for <Mono>[SlackNotifier]</Mono> warning lines.</>,
  },
  {
    symptom: 'Bot not responding to @mentions or DMs',
    fix: <>Confirm the App Token (<Mono>xapp-...</Mono>) is saved and Socket Mode is enabled in the Slack app settings. Check server logs for <Mono>[SlackListener]</Mono> errors.</>,
  },
  {
    symptom: 'invalid_auth or account_inactive error',
    fix: <>The Bot Token has been revoked. Re-install the app to your workspace (OAuth and Permissions &rarr; Install to Workspace) to generate a new token, update it in Settings, and restart Argus.</>,
  },
  {
    symptom: 'App Token connection closes repeatedly',
    fix: <>The App Token may be expired or have insufficient scope. Delete it in <strong>Basic Information &rarr; App-Level Tokens</strong> and regenerate with the <Mono>connections:write</Mono> scope. Update in Settings and restart Argus.</>,
  },
  {
    symptom: 'Messages posted to wrong channel',
    fix: <>Verify the Channel ID in Settings. Use the channel ID (e.g. <Mono>C01234ABCDE</Mono>), not the channel name. Right-click the channel &rarr; <strong>View channel details</strong> to find it.</>,
  },
];

// ---------------------------------------------------------------------------
// How it works content
// ---------------------------------------------------------------------------

function HowItWorksContent() {
  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-lg px-6 py-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">What Argus sends</h2>
        <p className="text-sm text-gray-600 mb-3">Argus monitors Claude Code and GitHub Copilot sessions on your machine and posts a message thread for each session. Updates are posted into the same thread as the session progresses.</p>
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left font-medium text-gray-500 py-1.5 pr-8 w-1/3">Event</th>
              <th className="text-left font-medium text-gray-500 py-1.5">What is posted</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['Session started',   'Repo, branch, tool (Claude Code / Copilot), mode, model, PID, session ID'],
              ['Session updated',   'Only the fields that changed: status, model, Yolo mode, PID'],
              ['Action required',   'Clickable choice buttons so you can respond from Teams or Slack'],
              ['Output streamed',   'Assistant output posted in the thread'],
              ['Session ended',     'Final status and timestamp'],
            ].map(([event, content]) => (
              <tr key={event} className="border-b border-gray-100">
                <td className="py-1.5 pr-8 font-medium text-gray-800">{event}</td>
                <td className="py-1.5 text-gray-600">{content}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg px-6 py-5">
          <div className="flex items-center gap-2 mb-3">
            <img src={teamsUrl} alt="" width={16} height={16} aria-hidden="true" />
            <h2 className="text-sm font-semibold text-gray-900">How Teams works</h2>
          </div>
          <p className="text-sm text-gray-600 mb-3">Teams uses an inbound webhook model. Microsoft sends HTTPS POST requests to Argus, and Argus replies via the Bot Framework API.</p>
          <div className="bg-gray-50 border border-gray-200 rounded-md px-3 py-2.5 font-mono text-xs text-gray-700 space-y-1">
            <div>Teams &rarr; HTTPS POST &rarr; Argus tunnel</div>
            <div>Argus &rarr; Bot Framework API &rarr; Teams</div>
          </div>
          <p className="text-sm text-gray-600 mt-3">Because Teams initiates the connection to Argus, a dev tunnel is required to make your local machine reachable. Use <Mono>devtunnel</Mono> to create a stable HTTPS URL that forwards to Argus on port 7411.</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg px-6 py-5">
          <div className="flex items-center gap-2 mb-3">
            <img src={slackUrl} alt="" width={16} height={16} aria-hidden="true" />
            <h2 className="text-sm font-semibold text-gray-900">How Slack works</h2>
          </div>
          <p className="text-sm text-gray-600 mb-3">Slack uses an outbound model via Socket Mode. Argus opens a WebSocket connection to Slack — no public endpoint required.</p>
          <div className="bg-gray-50 border border-gray-200 rounded-md px-3 py-2.5 font-mono text-xs text-gray-700 space-y-1">
            <div>Argus &rarr; Slack API (post messages)</div>
            <div>Argus &rarr; WebSocket &rarr; Slack (receive events)</div>
          </div>
          <p className="text-sm text-gray-600 mt-3">Argus uses the <strong>Bot Token</strong> (<Mono>xoxb-</Mono>) to post messages and the <strong>App Token</strong> (<Mono>xapp-</Mono>) to keep the Socket Mode tunnel open for receiving @mentions and direct messages. No port forwarding or tunnel required.</p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg px-6 py-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Responding to sessions</h2>
        <p className="text-sm text-gray-600 mb-3">When a session is waiting for input, Argus posts a message with the available choices. You can respond directly from Teams or Slack:</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
          <div>
            <p className="font-medium text-gray-800 mb-1">Teams</p>
            <p>Argus posts an Adaptive Card with clickable buttons. Tap a button to send your choice back to the running session.</p>
          </div>
          <div>
            <p className="font-medium text-gray-800 mb-1">Slack</p>
            <p>Reply in the session thread or send a DM to the bot. Supported commands: <Mono>sessions</Mono>, <Mono>status &lt;id&gt;</Mono>, <Mono>help</Mono>.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared components
// ---------------------------------------------------------------------------

function TroubleshootingCard({ items }: { items: { symptom: string; fix: React.ReactNode }[] }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-6 py-5 mt-4">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Troubleshooting</h2>
      <div className="space-y-4">
        {items.map(({ symptom, fix }) => (
          <div key={symptom} className="flex gap-4">
            <div className="shrink-0 mt-0.5">
              <span className="inline-block w-2 h-2 rounded-full bg-amber-400 mt-1" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-800 mb-0.5">{symptom}</p>
              <p className="text-sm text-gray-600">{fix}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StepList({ steps }: { steps: SetupStep[] }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-6 py-5">
      {steps.map((step, i) => (
        <div key={step.title} className="flex gap-4">
          <div className="flex flex-col items-center">
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-semibold shrink-0">
              {i + 1}
            </div>
            {i < steps.length - 1 && <div className="w-px flex-1 bg-gray-100 my-1.5" />}
          </div>
          <div className={`flex-1 ${i < steps.length - 1 ? 'pb-6' : 'pb-0'}`}>
            <h2 className="text-sm font-semibold text-gray-900 mb-2 leading-6">{step.title}</h2>
            {step.body}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab config
// ---------------------------------------------------------------------------

type TabId = 'overview' | 'teams' | 'slack';

interface Tab {
  id: TabId;
  label: string;
  path: string;
  logoSrc?: string;
}

const TABS: Tab[] = [
  { id: 'overview', label: 'How it works',    path: '/setup/integrations' },
  { id: 'teams',    label: 'Microsoft Teams', path: '/setup/teams',        logoSrc: teamsUrl },
  { id: 'slack',    label: 'Slack',           path: '/setup/slack',        logoSrc: slackUrl },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function IntegrationsSetupPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const activeTab = TABS.find(t => t.path === location.pathname) ?? TABS[0];

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-12">
      <div className="mx-auto max-w-5xl">

        <div className="mb-8">
          <button onClick={() => navigate('/')} className="icon-btn text-sm text-gray-600 hover:text-blue-600 mb-6 flex items-center gap-1.5">
            <ArrowLeft size={14} aria-hidden="true" /> Back
          </button>
          <div className="flex items-center gap-2.5 mb-1">
            <ArgusLogo size={24} />
            <h1 className="text-xl font-semibold text-gray-900">Integrations</h1>
          </div>
          <p className="text-sm text-gray-500">Connect Argus to Microsoft Teams or Slack.</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-gray-200">
          {TABS.map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => navigate(tab.path)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400 ${
                tab.id === activeTab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.logoSrc && <img src={tab.logoSrc} alt="" width={16} height={16} aria-hidden="true" />}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab.id === 'overview' && <HowItWorksContent />}

        {activeTab.id === 'teams' && (
          <>
            <div className="bg-white border border-gray-200 rounded-lg px-6 py-5 mb-4">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Prerequisites</h2>
              {TEAMS_PREREQUISITES}
            </div>
            <StepList steps={TEAMS_STEPS} />
            <TroubleshootingCard items={TEAMS_TROUBLESHOOTING} />
          </>
        )}

        {activeTab.id === 'slack' && (
          <>
            <div className="bg-white border border-gray-200 rounded-lg px-6 py-5 mb-4">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Prerequisites</h2>
              {SLACK_PREREQUISITES}
            </div>
            <StepList steps={SLACK_STEPS} />
            <TroubleshootingCard items={SLACK_TROUBLESHOOTING} />
          </>
        )}

        <div className="mt-6">
          <button onClick={() => navigate('/')} className="icon-btn text-sm text-gray-500 hover:text-blue-600 flex items-center gap-1.5">
            <ArrowLeft size={13} aria-hidden="true" /> Back to Argus
          </button>
        </div>

      </div>
    </div>
  );
}

