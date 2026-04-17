# Teams App Setup

This guide walks through registering and configuring the Azure Bot that Argus uses to post session notifications to a Microsoft Teams channel.

## How it works

Unlike the Slack integration (which uses Socket Mode, where Argus opens an outbound connection), the Teams integration uses an **inbound webhook**. Microsoft calls your Argus server at a public HTTPS endpoint when the bot receives a message. This means Argus must be reachable from the internet, or you must run a tunnel (such as VS Code Dev Tunnels or ngrok) during local development.

```
Microsoft Teams  →  HTTPS POST  →  https://your-server/api/v1/teams/webhook  →  Argus
Argus            →  Bot Framework API  →  Microsoft Teams
```

---

## Prerequisites

- An Azure account with permission to create App Registrations and Bot Services
- A Microsoft Teams workspace where you are a team owner or admin
- Argus running and accessible over HTTPS (a public server, or a tunnel for local dev)

---

## Step 1: Register an Azure AD App

This provides the identity (`CLIENT_ID`, `CLIENT_SECRET`, `TENANT_ID`) the bot uses to call the Bot Framework API.

1. Sign in to the [Azure portal](https://portal.azure.com).
2. Go to **Azure Active Directory** > **App registrations** > **New registration**.
3. Fill in the form:
   - **Name**: `Argus` (or any name you prefer)
   - **Supported account types**: select **Accounts in any organizational directory (Multitenant)**
   - **Redirect URI**: leave blank
4. Click **Register**.
5. On the app overview page, copy:
   - **Application (client) ID** — this is your `CLIENT_ID`
   - **Directory (tenant) ID** — this is your `TENANT_ID`
6. In the left sidebar, click **Certificates and secrets** > **New client secret**.
7. Add a description, set an expiry, and click **Add**.
8. Copy the **Value** immediately (it won't be shown again). This is your `CLIENT_SECRET`.

---

## Step 2: Create an Azure Bot

1. In the Azure portal, search for **Azure Bot** and click **Create**.
2. Fill in the form:
   - **Bot handle**: `argus-bot` (or any unique name)
   - **Subscription / Resource group**: choose your subscription
   - **Pricing tier**: F0 (Free) is sufficient for personal use
   - **Type of App**: select **Multi Tenant**
   - **Creation type**: select **Use existing app registration**
   - **App ID**: paste your `CLIENT_ID` from Step 1
3. Click **Review + create**, then **Create**.
4. Once deployed, go to the Bot resource > **Configuration**.
5. Set the **Messaging endpoint** to:
   ```
   https://<your-argus-host>/api/v1/teams/webhook
   ```
   Replace `<your-argus-host>` with your server hostname (or tunnel URL, e.g. `https://xyz.devtunnel.ms`).
6. Click **Apply**.

---

## Step 3: Enable the Teams Channel

1. In the Azure Bot resource, go to **Channels** in the left sidebar.
2. Click the **Microsoft Teams** channel icon.
3. Accept the terms and click **Agree**.
4. Click **Apply**.

The bot is now connected to Teams. It will appear in Teams after it is installed in your team (Step 5).

---

## Step 4: Get Your Team and Channel IDs

Argus needs the internal IDs, not the display names.

**Team ID:**

1. In Teams, right-click the team name in the sidebar and choose **Get link to team**.
2. The link looks like:
   ```
   https://teams.microsoft.com/l/team/19%3A.../conversations?groupId=<TEAM_ID>&tenantId=...
   ```
3. The `groupId` value is your `TEAMS_TEAM_ID`.

**Channel ID:**

1. Right-click the channel name and choose **Get link to channel**.
2. The link contains a `channel` parameter, URL-encoded. The decoded value starting with `19:` is your `TEAMS_CHANNEL_ID`.

   Alternatively, open the channel in Teams desktop app, click **...** > **Get link to channel**. The channel ID in the URL has the format:
   ```
   19:xxxxxxxx@thread.tacv2
   ```

---

## Step 5: Get Your AAD Object ID

Argus uses the owner's AAD Object ID when creating threads so the bot can post on behalf of the owner.

1. In the Azure portal, go to **Azure Active Directory** > **Users**.
2. Search for and click your own user account.
3. Copy the **Object ID**. This is your `TEAMS_OWNER_AAD_OBJECT_ID`.

---

## Step 6: Install the Bot in Your Team

1. In Teams, go to the team where you want Argus to post.
2. Click **...** next to the team name > **Manage team** > **Apps** tab > **More apps**.
3. In the Apps store, search for your bot name or use **Upload a custom app** if you have a manifest.
4. Alternatively, mention the bot in any channel to trigger an install prompt:
   ```
   @Argus
   ```

For a programmatic install (no App Store listing required), you can upload a custom app manifest. See [Microsoft docs on bot manifests](https://learn.microsoft.com/en-us/microsoftteams/platform/bots/how-to/create-a-bot-for-teams) for details.

---

## Step 7: Set Up a Tunnel (Local Development Only)

If Argus is running on your local machine, Microsoft cannot reach it directly. Use VS Code Dev Tunnels or ngrok.

**Azure Dev Tunnels CLI:**

Install the CLI if you haven't already:

```bash
winget install Microsoft.DevTunnel
```

Log in once:

```bash
devtunnel login
```

Create a persistent tunnel named `argus-tunnel` and host it on port 7411:

```bash
devtunnel create argus-tunnel
devtunnel access create argus-tunnel --anonymous
devtunnel port create argus-tunnel -p 7411
devtunnel host argus-tunnel
```

The CLI prints your tunnel URL in the format:

```
Connect via browser: https://<tunnel-id>-7411.<region>.devtunnels.ms
```

Update your Azure Bot **Messaging endpoint** (Step 2, item 5) to:

```
https://<tunnel-id>-7411.<region>.devtunnels.ms/api/v1/teams/webhook
```

The tunnel ID is stable across restarts as long as you reuse the same named tunnel. To reuse it in a later session:

```bash
devtunnel host argus-tunnel
```

**ngrok (alternative):**

```bash
ngrok http 7411
```

Copy the `https://` forwarding URL and update the Bot messaging endpoint to point to `/api/v1/teams/webhook`.

> Tunnels are only needed for local development. On a hosted server with a fixed domain, the public URL is used directly.

---

## Step 8: Configure Argus

Add all six values to `backend/.env`:

```bash
# Azure AD app credentials (Teams SDK auth)
CLIENT_ID=<Application (client) ID from Step 1>
CLIENT_SECRET=<Client secret value from Step 1>
TENANT_ID=<Directory (tenant) ID from Step 1>

# Teams channel target
TEAMS_ENABLED=true
TEAMS_TEAM_ID=<Team ID from Step 4>
TEAMS_CHANNEL_ID=<Channel ID from Step 4>
TEAMS_OWNER_AAD_OBJECT_ID=<Your AAD Object ID from Step 5>
```

Restart Argus after saving the file.

---

## Step 9: Verify the Connection

Check the Argus server logs on startup. You should see:

```
teams: configured, subscribing to session events
```

If you see `teams: not configured, skipping event subscriptions`, check that all seven variables are set and `TEAMS_ENABLED=true`.

To confirm the bot is reachable, send a message to the channel or mention the bot:

```
@Argus hello
```

The bot should reply in the channel thread.

---

## What Argus Posts

Argus creates one Teams thread per session. Each thread contains:

| Event | Content |
| ----- | ------- |
| Session started | Repo name, path, branch, type, mode, model, Yolo flag, PID, session ID |
| Session updated | Changed fields only (status, model, Yolo, PID, task summary) |
| Output streamed | Assistant output buffered and posted (or updated) in the thread every 3 seconds |
| Session ended | Final status and ended timestamp |

---

## Troubleshooting

**`teams: not configured, skipping event subscriptions`**
- Confirm all seven env vars are set and Argus has been restarted.
- Check that `TEAMS_ENABLED=true` (the literal string `true`, not `1`).

**Messages not appearing in Teams**
- Confirm the bot is installed in the target team (Step 6).
- Confirm the `TEAMS_TEAM_ID` and `TEAMS_CHANNEL_ID` match the team and channel where the bot is installed.
- Confirm the **Messaging endpoint** in the Azure Bot resource points to your running Argus instance.

**`teams.thread.create.failed` error in logs**
- The Bot Framework is returning an error. Common causes: the client secret has expired (regenerate in Step 1), the bot is not installed in the team, or the channel ID is wrong.
- Check that your Azure Bot messaging endpoint is reachable (HTTPS with a valid certificate; Dev Tunnels and ngrok provide this automatically).

**Client secret expired**
- In the Azure portal, go to **App Registrations** > your app > **Certificates and secrets**.
- Delete the old secret, create a new one, and update `CLIENT_SECRET` in `backend/.env`.

**`401 Unauthorized` from Bot Framework API**
- The `CLIENT_ID` or `CLIENT_SECRET` is wrong, or the app registration type is not Multitenant.
- Re-check Step 1 and confirm the **Supported account types** is set to Multitenant.
