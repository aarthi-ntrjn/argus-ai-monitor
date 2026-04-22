import { SetupPage, CodeBlock, Mono, ExternalA } from '../components/SetupPage/SetupPage';
import type { SetupStep } from '../components/SetupPage/SetupPage';
import slackUrl from '../images/slack.svg?url';

const SCOPES = [
  ['chat:write',        'Post messages and thread replies'],
  ['channels:read',     'Look up channel information'],
  ['app_mentions:read', 'Receive @mention events'],
  ['im:history',        'Receive direct messages'],
] as const;

const ENV_BLOCK = `SLACK_BOT_TOKEN=xoxb-...        # required
SLACK_CHANNEL_ID=C01234ABCDE    # required
SLACK_APP_TOKEN=xapp-...        # optional — enables inbound commands`;

const LOG_BLOCK = `[SlackNotifier] Initialized, posting to channel C01234ABCDE
[SlackListener] Socket Mode connected, listening for app mentions and DMs`;

const STEPS: SetupStep[] = [
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

const PREREQUISITES = (
  <ul className="space-y-1.5 text-sm text-gray-600 list-disc pl-4">
    <li>A Slack workspace — free tier is sufficient. <ExternalA href="https://slack.com/help/articles/206845317-Create-a-Slack-workspace">Create one</ExternalA> if you don't have one.</li>
    <li>Admin access to the workspace, or permission to install apps.</li>
  </ul>
);

export default function SlackSetupPage() {
  return (
    <SetupPage
      title="Slack Setup"
      subtitle="Connect Argus to a Slack channel in 8 steps."
      logoSrc={slackUrl}
      prerequisites={PREREQUISITES}
      steps={STEPS}
    />
  );
}
