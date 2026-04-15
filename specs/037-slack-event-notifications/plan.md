# Implementation Plan: Slack Event Notifications

**Feature Branch**: `037-slack-event-notifications`
**Created**: 2026-04-14
**Spec**: [spec.md](spec.md)

## Technical Context

### Existing Stack

| Concern | Detail |
|---------|--------|
| Runtime | Node.js 22+, TypeScript 5.x strict, ESM (`NodeNext`) |
| HTTP server | Fastify 5.x |
| Database | SQLite via `better-sqlite3` |
| Event bus | `SessionMonitor extends EventEmitter` in `backend/src/services/session-monitor.ts` |
| Config | `~/.argus/config.json` loaded by `backend/src/config/config-loader.ts`; `.env` via dotenv |
| Logging | Pino via `backend/src/utils/logger.ts` |

### Session Monitor Events (all emitted by `SessionMonitor`)

| Event name | Payload |
|------------|---------|
| `session.created` | `Session` object |
| `session.updated` | `Session` object |
| `session.ended` | `Session` object |
| `repository.added` | `Repository` object |
| `repository.removed` | `Repository` object |

### New npm Dependencies (backend workspace only)

| Package | Purpose |
|---------|---------|
| `@slack/web-api` | Post messages via Slack Bot token (`chat.postMessage`) |
| `@slack/socket-mode` | Receive inbound Slack events via outbound WebSocket (no public endpoint required) |

### New Files

| File | Purpose |
|------|---------|
| `backend/src/services/slack-notifier.ts` | Subscribes to `SessionMonitor` events, formats and posts Slack messages, manages thread-per-session map |
| `backend/src/services/slack-listener.ts` | Socket Mode client: receives inbound Slack messages, routes to query handlers |
| `backend/src/constants/slack-events.ts` | Named string constants for all `SessionMonitor` event names used by the Slack integration |

### Modified Files

| File | Change |
|------|--------|
| `backend/package.json` | Add `@slack/web-api`, `@slack/socket-mode` |
| `backend/src/models/index.ts` | Add `SlackConfig` interface and `SlackEventType` enum |
| `backend/src/config/config-loader.ts` | Add `slack` config section; read `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN`, `SLACK_CHANNEL_ID` from env |
| `backend/src/api/routes/settings.ts` | Add `GET /api/settings/slack` and `PATCH /api/settings/slack` routes |
| `backend/src/api/routes/health.ts` | Add Slack connection status field to health response |
| `backend/src/server.ts` | Wire `SlackNotifier` and `SlackListener` into startup/shutdown |
| `.env.example` | Document `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN`, `SLACK_CHANNEL_ID` |

---

## Architecture Decisions

### 1. Thread-per-session model

`SlackNotifier` holds an in-memory `Map<sessionId, string>` mapping each session ID to its Slack message timestamp (`ts`). When `session.created` fires, the service calls `chat.postMessage` (no `thread_ts`) and stores the returned `ts`. All subsequent events for that session call `chat.postMessage` with `thread_ts` set to the stored value.

The map is in-memory only; if Argus restarts mid-session, subsequent events for sessions that were in progress will post as new top-level messages rather than thread replies. This is acceptable for the current scope.

### 2. Delivery failure: discard on first error

All `chat.postMessage` calls are wrapped in `try/catch`. On any error (network, rate limit, invalid token), the service logs the failure with full context (session ID, event type, HTTP status, error body) and discards the message. No retry, no persistent queue. This keeps the integration simple and non-blocking.

### 3. Rate-limit queue

A simple async FIFO queue chains each send as a Promise that resolves after a minimum 1100ms interval. If the queue depth exceeds 50 entries, the oldest pending item is dropped with a log warning before enqueuing the new one.

### 4. Socket Mode for inbound messages (US4)

`SlackListener` uses `@slack/socket-mode`'s `SocketModeClient` to open an outbound WebSocket connection to Slack. Argus connects TO Slack, so no inbound port or public URL is required. This works on Slack free tier.

Requires a Slack App-level token (`xapp-...`) in addition to the Bot token. The App token is configured separately via `SLACK_APP_TOKEN` env var or `config.json`.

### 5. Graceful degradation

If `SLACK_BOT_TOKEN` or `SLACK_CHANNEL_ID` is absent at startup, `SlackNotifier` logs a single warning (`[SlackNotifier] Slack integration disabled: missing botToken or channelId`) and all methods become no-ops. If `SLACK_APP_TOKEN` is absent, `SlackListener` is skipped (inbound routing disabled, outbound notifications still work).

### 6. Non-blocking guarantee

`SlackNotifier` event handlers are always `async` functions that `catch` all errors internally. They are registered as `sessionMonitor.on('session.created', async (session) => { ... })`. Errors never propagate to `SessionMonitor` callers.

### 7. Configuration model

```jsonc
// ~/.argus/config.json
{
  "slack": {
    "botToken": "xoxb-...",        // or SLACK_BOT_TOKEN env var
    "appToken": "xapp-...",        // or SLACK_APP_TOKEN env var (optional, for Socket Mode)
    "channelId": "C...",           // or SLACK_CHANNEL_ID env var
    "enabled": true,
    "enabledEventTypes": [         // omit to enable all; list to whitelist
      "session.created",
      "session.updated",
      "session.ended"
    ]
  }
}
```

---

## Implementation Phases

### Phase 1: Setup
Install `@slack/web-api` and `@slack/socket-mode` in the backend workspace. Add env var documentation to `.env.example`.

### Phase 2: Foundation
Define `SlackConfig` and `SlackEventType` in `backend/src/models/index.ts`. Create named constants in `backend/src/constants/slack-events.ts`. Extend `config-loader.ts` to read the `slack` section from config file and env vars. Create `SlackNotifier` stub with `initialize()` / `shutdown()` / no-op stubs. Wire into `server.ts`.

### Phase 3: US1 — Session Lifecycle Notifications
Implement `postSessionStart()` and `postSessionEnd()` in `SlackNotifier`. Subscribe to `session.created` and `session.ended`. Verify thread anchors are stored and retrieved correctly.

### Phase 4: US2 — All-Event Notifications
Implement `postEvent()` for `session.updated` and any future event types. Add per-event-type filtering (check against `enabledEventTypes`). Add rate-limit queue.

### Phase 5: US3 — Notification Configuration
Add `GET /api/settings/slack` and `PATCH /api/settings/slack` to `settings.ts`. Implement `reconfigure(newConfig)` on `SlackNotifier` for hot-reload. Add Slack status to health endpoint.

### Phase 6: US4 — Slack-to-Argus Routing
Create `SlackListener` with Socket Mode client. Implement app-mention and DM event handler. Implement `handleArgusQuery()` for "sessions", "status", and "help" commands. Wire into `server.ts`.

---

## Slack App Setup (Manual, One-Time)

The developer must perform these steps in the Slack App dashboard before running the integration:

1. Create a Slack App at `api.slack.com/apps` in the target workspace.
2. Under **OAuth & Permissions**, add Bot Token Scopes: `chat:write`, `channels:read`, `app_mentions:read`, `im:history`.
3. Enable **Socket Mode** under **Socket Mode** settings; generate an App-level token with `connections:write` scope.
4. Under **Event Subscriptions**, subscribe to bot events: `app_mention`, `message.im`.
5. Install the app to the workspace; copy the **Bot User OAuth Token** (`xoxb-...`) and the **App Token** (`xapp-...`).
6. Invite the bot to the target channel: `/invite @ArgusBot`.
7. Add `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN`, and `SLACK_CHANNEL_ID` to `.env` or `~/.argus/config.json`.
