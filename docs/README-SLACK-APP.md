# Slack App Setup

This guide walks through creating and configuring the Slack App that Argus uses to post session notifications and respond to questions.

## Prerequisites

- A Slack workspace (free tier is sufficient)
- Admin access to the workspace, or permission to install apps

---

## Step 1: Create the App

1. Go to [api.slack.com/apps](https://api.slack.com/apps) and sign in with your workspace account.
2. Click **Create New App** > **From scratch**.
3. Name the app (e.g. `Argus`) and select your workspace.
4. Click **Create App**.

---

## Step 2: Add Bot Token Scopes

1. In the left sidebar, click **OAuth and Permissions**.
2. Scroll down to **Scopes** > **Bot Token Scopes**.
3. Click **Add an OAuth Scope** and add all four:

   | Scope | Purpose |
   | ----- | ------- |
   | `chat:write` | Post messages and thread replies |
   | `channels:read` | Look up channel information |
   | `app_mentions:read` | Receive @mention events |
   | `im:history` | Receive direct messages |

---

## Step 3: Enable Socket Mode

Socket Mode lets Argus receive incoming Slack messages without exposing a public HTTP endpoint. Argus connects outbound to Slack, so this works on a local machine with no port forwarding required.

1. In the left sidebar, click **Socket Mode**.
2. Toggle **Enable Socket Mode** on.
3. When prompted, create an App-level token:
   - Name it anything (e.g. `argus-socket`).
   - Add the scope `connections:write`.
   - Click **Generate**.
4. Copy the `xapp-...` token. This is your `SLACK_APP_TOKEN`.

> Socket Mode is only required for the Slack-to-Argus routing feature (asking the bot questions). If you only want outbound notifications, you can skip this step and omit `SLACK_APP_TOKEN`.

---

## Step 4: Subscribe to Bot Events

1. In the left sidebar, click **Event Subscriptions**.
2. Toggle **Enable Events** on.
3. Under **Subscribe to bot events**, add:
   - `app_mention` - fires when a user @mentions the bot in a channel
   - `message.im` - fires when a user sends the bot a direct message
4. Click **Save Changes**.

---

## Step 5: Install to Your Workspace

1. In the left sidebar, click **OAuth and Permissions**.
2. Scroll to the top and click **Install to Workspace**.
3. Review the permissions and click **Allow**.
4. Copy the **Bot User OAuth Token** (`xoxb-...`). This is your `SLACK_BOT_TOKEN`.

---

## Step 6: Get Your Channel ID

Argus needs the channel ID (not the channel name) to post messages.

1. In Slack, open the channel you want Argus to post to.
2. Right-click the channel name in the sidebar and select **View channel details**.
3. Scroll to the bottom of the popup. The Channel ID is displayed there (format: `C01234ABCDE`).
4. Copy the ID. This is your `SLACK_CHANNEL_ID`.
5. Invite the bot to the channel by typing in the channel:
   ```
   /invite @Argus
   ```

---

## Step 7: Configure Argus

Add the three values to `backend/.env`:

```bash
# Required: Bot User OAuth Token from Step 5
SLACK_BOT_TOKEN=xoxb-...

# Required: target channel ID from Step 6
SLACK_CHANNEL_ID=C01234ABCDE

# Optional: App-level token from Step 3 (enables Slack-to-Argus routing)
SLACK_APP_TOKEN=xapp-...
```

Alternatively, add a `slack` section to `~/.argus/config.json`:

```json
{
  "slack": {
    "botToken": "xoxb-...",
    "channelId": "C01234ABCDE",
    "appToken": "xapp-..."
  }
}
```

Environment variables take precedence over the config file.

---

## Step 8: Verify the Connection

Restart Argus. You should see these lines in the server logs:

```
[SlackNotifier] Initialized, posting to channel C01234ABCDE
[SlackListener] Socket Mode connected, listening for app mentions and DMs
```

To confirm the bot is working, type this in your Slack channel:

```
@Argus help
```

The bot should reply with a list of supported commands.

---

## How Socket Mode Works (No Public Endpoint Required)

Normally, Slack delivers events by making HTTP POST requests to a URL you provide. That requires your server to be publicly reachable on the internet.

**Socket Mode flips this around.** Instead of Slack calling you, Argus opens an outbound WebSocket connection to Slack's servers. The flow is:

```
Argus (your machine)  →  opens WebSocket  →  Slack's servers
                      ←  events pushed back over that connection  ←
```

Since Argus initiates the connection (outbound on port 443), it works anywhere outbound HTTPS traffic is allowed: your laptop, a home server, a company network behind a firewall, or a Docker container with no exposed ports. No ngrok, no domain name, no port forwarding required.

### What the two tokens do

| Token | Prefix | Purpose |
| ----- | ------ | ------- |
| `SLACK_BOT_TOKEN` | `xoxb-` | Authenticates API calls: posting messages, replying in threads, looking up channel info |
| `SLACK_APP_TOKEN` | `xapp-` | Authenticates the Socket Mode WebSocket connection. Keeps the tunnel open so Slack can push events to Argus |

The Bot token does the work. The App token is purely the key that keeps the outbound tunnel alive.

### What happens at startup

When Argus starts with both tokens set:

1. `SlackNotifier` creates an API client using your Bot token.
2. `SlackListener` opens a WebSocket to Slack using your App token.
3. Slack sends a hello handshake. From that point on, any `app_mention` or `message.im` event is pushed down that connection to Argus in real time.

The only network requirement is outbound HTTPS/WSS access to `*.slack.com` on port 443.

---

## Filtering Event Types

By default, all session events are forwarded to Slack. To limit which events post messages, set `enabledEventTypes` in your config or via the API:

```bash
curl -X PATCH http://localhost:7411/api/v1/settings/slack \
  -H "Content-Type: application/json" \
  -d '{"enabledEventTypes": ["session.created", "session.ended"]}'
```

Available event types: `session.created`, `session.updated`, `session.ended`, `repository.added`, `repository.removed`.

Changes take effect immediately without restarting Argus.

---

## Bot Commands

Once the app is connected, you can ask it questions in any channel the bot is in, or via direct message:

| Command | Response |
| ------- | -------- |
| `@Argus sessions` | Lists all active AI sessions |
| `@Argus status <sessionId>` | Shows details for a specific session |
| `@Argus help` | Lists available commands |

You can use a partial session ID (first 8 characters) with the `status` command.

---

## Troubleshooting

**No messages appearing in Slack**
- Check that `SLACK_BOT_TOKEN` and `SLACK_CHANNEL_ID` are set and the server has been restarted.
- Confirm the bot has been invited to the channel (`/invite @Argus`).
- Check the Argus server logs for `[SlackNotifier]` warning lines.

**Bot not responding to messages**
- Confirm `SLACK_APP_TOKEN` (`xapp-...`) is set and Socket Mode is enabled in the Slack App settings.
- Check the logs for `[SlackListener]` lines. If Socket Mode failed to connect, the error will appear there.

**Token was revoked**
- Re-install the app to your workspace (Step 5) to generate a new Bot token.
- For the App token, go to **Basic Information** > **App-Level Tokens** and regenerate it.
