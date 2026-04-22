import { SetupPage, CodeBlock, Mono, ExternalA } from '../components/SetupPage/SetupPage';
import type { SetupStep } from '../components/SetupPage/SetupPage';
import teamsUrl from '../images/microsoft-teams.svg?url';

const TUNNEL_CREATE = `devtunnel login
devtunnel create argus-tunnel --allow-anonymous
devtunnel port create argus-tunnel -p 7411`;

const BOT_CREATE = `teams login
teams app create --name "Argus" \\
  --endpoint "https://<endpoint>/api/v1/teams/webhook" \\
  --env .env`;

const ENV_BLOCK = `TEAMS_ENABLED=true
TEAMS_TEAM_ID=<Team ID>
TEAMS_CHANNEL_ID=<Channel ID>
TEAMS_OWNER_AAD_OBJECT_ID=<Your AAD Object ID>`;

const STEPS: SetupStep[] = [
  {
    title: 'Set up a tunnel',
    body: (
      <>
        <p className="text-sm text-gray-600 mb-3">Teams delivers webhook events to Argus over HTTPS. Since Argus runs on your local machine, use a dev tunnel to expose it.</p>
        <p className="text-sm text-gray-600 mb-1">Create a persistent tunnel (one-time):</p>
        <CodeBlock value={TUNNEL_CREATE} />
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
        <p className="text-sm text-gray-600 mt-3">This registers the bot, generates credentials (<Mono>CLIENT_ID</Mono>, <Mono>CLIENT_SECRET</Mono>, <Mono>TENANT_ID</Mono>), writes them to <Mono>.env</Mono>, and prints an install link. Open the install link to add the bot to your team.</p>
        <p className="text-xs text-gray-400 mt-2">Use your tunnel URL for <Mono>{'<endpoint>'}</Mono> during local dev, or your server's public domain in production.</p>
      </>
    ),
  },
  {
    title: 'Get your Team ID, Channel ID, and AAD Object ID',
    body: (
      <ol className="space-y-3 text-sm text-gray-600 list-decimal pl-4">
        <li><strong>Team ID:</strong> Right-click the team name in Teams -&gt; <strong>Get link to team</strong>. The <Mono>groupId</Mono> parameter is your <Mono>TEAMS_TEAM_ID</Mono>.</li>
        <li><strong>Channel ID:</strong> Right-click the channel -&gt; <strong>Get link to channel</strong>. The decoded value starting with <Mono>19:</Mono> is your <Mono>TEAMS_CHANNEL_ID</Mono> (format: <Mono>{'19:xxxxxxxx@thread.tacv2'}</Mono>).</li>
        <li><strong>AAD Object ID:</strong> In the <ExternalA href="https://portal.azure.com">Azure portal</ExternalA>, go to <strong>Microsoft Entra ID -&gt; Users</strong>, click your account, and copy the <strong>Object ID</strong>. This is your <Mono>TEAMS_OWNER_AAD_OBJECT_ID</Mono>.</li>
      </ol>
    ),
  },
  {
    title: 'Configure Argus',
    body: (
      <>
        <p className="text-sm text-gray-600 mb-1">Add to <Mono>backend/.env</Mono> (bot credentials from step 2 are already there):</p>
        <CodeBlock value={ENV_BLOCK} />
        <p className="text-sm text-gray-600 mt-3">Restart Argus.</p>
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

const PREREQUISITES = (
  <ul className="space-y-1.5 text-sm text-gray-600 list-disc pl-4">
    <li><ExternalA href="https://microsoft.github.io/teams-sdk/">Teams CLI</ExternalA> installed: <Mono>npm install -g @microsoft/teams.cli@preview</Mono></li>
    <li>A Microsoft Teams workspace where you are a team owner or admin. Get <ExternalA href="https://www.microsoft.com/en-us/microsoft-teams/essentials">Teams Essentials</ExternalA> or an <ExternalA href="https://www.microsoft.com/en-us/microsoft-365/business/microsoft-365-plans-and-pricing">M365 tenant</ExternalA> if you don't have one.</li>
    <li>For local dev: <ExternalA href="https://learn.microsoft.com/en-us/azure/developer/dev-tunnels/">Azure Dev Tunnels CLI</ExternalA> -- <Mono>winget install Microsoft.DevTunnel</Mono> or <Mono>brew install devtunnel</Mono>.</li>
  </ul>
);

export default function TeamsSetupPage() {
  return (
    <SetupPage
      title="Teams Setup"
      subtitle="Connect Argus to a Microsoft Teams channel in 5 steps."
      logoSrc={teamsUrl}
      prerequisites={PREREQUISITES}
      steps={STEPS}
    />
  );
}
