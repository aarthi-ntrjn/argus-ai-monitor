# Teams App Setup

Argus posts session notifications to a Microsoft Teams channel via an inbound webhook. Microsoft sends HTTPS POSTs to Argus; Argus replies via the Bot Framework API.

```
Teams  →  HTTPS POST  →  https://your-host/api/v1/teams/webhook  →  Argus
Argus  →  Bot Framework API  →  Teams
```

## Prerequisites

- [Teams CLI](https://microsoft.github.io/teams-sdk/) installed (`npm install -g @microsoft/teams.cli@preview`)
- A Microsoft Teams workspace where you are a team owner or admin
- For local dev: [Azure Dev Tunnels CLI](https://learn.microsoft.com/en-us/azure/developer/dev-tunnels/) (`winget install Microsoft.DevTunnel` or `brew install devtunnel`)

## Step 1: Set up a tunnel (local dev only)

Skip this if Argus is deployed on a server with a public HTTPS domain.

Create a persistent tunnel (one-time):

```bash
devtunnel login
devtunnel create argus-tunnel --allow-anonymous
devtunnel port create argus-tunnel -p 7411 --protocol auto
```

Start it (each session):

```bash
devtunnel host argus-tunnel
```

Note the URL printed, e.g. `https://<tunnel-id>-7411.<region>.devtunnels.ms`. This is your `<endpoint>` below.

## Step 2: Create the bot

```bash
teams login
teams app create --name "Argus" \
  --endpoint "https://<endpoint>/api/v1/teams/webhook" \
  --env .env \
  --json
```

This registers the bot, generates credentials (`CLIENT_ID`, `CLIENT_SECRET`, `TENANT_ID`), writes them to `.env`, and prints an install link. Open the install link to add the bot to your team.

> Use your tunnel URL for `<endpoint>` during local dev, or your server's public domain in production.

## Step 3: Get your Team ID, Channel ID, and AAD Object ID

**Team ID:** Right-click the team name in Teams > **Get link to team**. The `groupId` parameter is your `TEAMS_TEAM_ID`.

**Channel ID:** Right-click the channel > **Get link to channel**. The decoded value starting with `19:` is your `TEAMS_CHANNEL_ID` (format: `19:xxxxxxxx@thread.tacv2`).

**AAD Object ID:** In the [Azure portal](https://portal.azure.com), go to **Microsoft Entra ID** > **Users** > click your account > copy the **Object ID**. This is your `TEAMS_OWNER_AAD_OBJECT_ID`.

## Step 4: Configure Argus

Add the channel config to `.env` (the bot credentials from Step 2 are already there):

```bash
# Teams channel target
TEAMS_ENABLED=true
TEAMS_TEAM_ID=<Team ID>
TEAMS_CHANNEL_ID=<Channel ID>
TEAMS_OWNER_AAD_OBJECT_ID=<Your AAD Object ID>
```

Restart Argus.

## Step 5: Verify

Check logs on startup for:

```
teams: configured, subscribing to session events
```

Mention the bot in the channel to confirm it's reachable:

```
@Argus help
```

## What Argus Posts

One thread per session:

| Event | Content |
| ----- | ------- |
| Session started | Repo, branch, type, mode, model, Yolo, PID, session ID |
| Session updated | Changed fields only (status, model, Yolo, PID) |
| Action required | Adaptive Card with clickable choice buttons |
| Output streamed | Assistant output posted in the thread |
| Session ended | Final status and timestamp |

## Troubleshooting

| Symptom | Fix |
| ------- | --- |
| `teams: not configured, skipping event subscriptions` | Check all env vars are set and `TEAMS_ENABLED=true` (not `1`). Restart Argus. |
| Messages not appearing | Confirm the bot is installed in the target team. Check `TEAMS_TEAM_ID` and `TEAMS_CHANNEL_ID` match. |
| `teams.thread.create.failed` | Client secret may have expired. Regenerate via `teams app get` or the Azure portal. Check the messaging endpoint is reachable. |
| `401 Unauthorized` | `CLIENT_ID` or `CLIENT_SECRET` is wrong. Re-run `teams app create` or check the Azure App Registration. |

## Manual setup (alternative)

If you prefer not to use the Teams CLI, you can register the bot manually through the Azure portal:

1. **App Registration**: Azure portal > Microsoft Entra ID > App registrations > New registration (Multitenant). Copy the client ID, tenant ID, and create a client secret.
2. **Azure Bot**: Azure portal > create Azure Bot resource (F0 tier), use the app registration from above, set messaging endpoint to `https://<host>/api/v1/teams/webhook`.
3. **Enable Teams channel**: In the Bot resource > Channels > add Microsoft Teams.
4. **Install**: Upload a custom app manifest or mention the bot in a channel.
