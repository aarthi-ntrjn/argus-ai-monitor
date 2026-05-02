# Telemetry Design

## Overview

Argus collects anonymous usage telemetry to understand how the tool is used and where. The data flows to PostHog and is used exclusively by Argus maintainers to make informed decisions about features, stability, and geographic reach.

Telemetry is **opt-out** (enabled by default). The user can disable it at any time via Settings. When disabled, no events are sent and no network calls are made.

---

## Requirements

### What we need to know

- Is Argus being used, and how often?
- Which features (session control, todos, integrations, diff view) are used?
- Which session types (Claude Code, Copilot) are active?
- Are users running in yolo/allow-all mode?
- Roughly where in the world are installations located (country, region)?
- What version of Argus is running in the field?
- Are integrations (Slack, Teams) active on startup?

### What we must never know

- What prompts users send to their AI sessions.
- File paths, repository names, or code content.
- Usernames, account names, or any identity linked to a person.
- Full IP address (it must not appear in stored event records).
- OS or hardware fingerprints.

### Privacy constraints

- Telemetry must be fully opt-out with a single toggle.
- Raw IP addresses must not be stored in PostHog event records.
- The installation ID must be anonymous: a random UUID with no link to the user's identity or machine.
- Telemetry failure must never affect product behavior (fire-and-forget).

---

## Design

### Provider: PostHog

PostHog is used as the analytics backend. The PostHog API key is a write-only project key (it cannot read analytics data), so embedding it in the source is intentional and safe.

```
POSTHOG_API_KEY = phc_utcNEdTjgVREGCdpmyDeMWVwjDmL9LBZSFvhrNkPUZGr
POSTHOG_URL    = https://app.posthog.com/capture/
```

The URL can be overridden via the `TELEMETRY_URL` environment variable for testing.

### Anonymous Installation ID

On first run, a random UUID v4 is generated and written to `~/.argus/telemetry-id`. Subsequent runs reuse the same UUID. The path can be overridden via `ARGUS_TELEMETRY_ID_PATH`.

The UUID is:
- Not derived from any hardware or OS identifier.
- Not linked to any account or identity.
- Stable per installation (so usage patterns can be aggregated across restarts, but not attributed to a person).

### Event Payload Shape

Each event sent to PostHog has this shape:

```ts
{
  api_key: string,            // PostHog write-only project key
  distinct_id: string,        // installation UUID
  event: TelemetryEventType,
  properties: {
    appVersion: string,       // e.g. "0.3.1"
    ...eventProperties,       // event-specific properties (see table below)
  },
  timestamp: string,          // ISO 8601 UTC
}
```

Event-specific properties included in `properties`:

| Property | Type | Events |
|---|---|---|
| `slack_enabled` | `boolean` | `app_started` |
| `teams_enabled` | `boolean` | `app_started` |
| `sessionType` | `"claude-code" \| "copilot-cli"` | `session_started`, `session_ended`, `session_stopped`, `session_prompt_sent` |
| `sessionId` | `string` (UUID) | `session_started`, `session_ended`, `session_stopped`, `session_prompt_sent` |
| `launchMode` | `"connected" \| "readonly"` | `session_started`, `session_ended`, `session_stopped`, `session_prompt_sent` |
| `yoloMode` | `boolean` | `session_started`, `session_ended`, `session_stopped`, `session_prompt_sent` |
| `platform` | `"slack" \| "teams"` | `integration_started`, `integration_stopped` |

No `$ip` or `$geoip_disable` properties are set. PostHog derives location from the connection IP natively (see GeoIP section below).

### Event Types

| Event | Trigger |
|---|---|
| `app_started` | Backend server starts listening |
| `app_ended` | Backend shuts down (SIGTERM or SIGINT) |
| `session_started` | A new session is detected by the monitor |
| `session_ended` | A session ends (process exit or reconciliation) |
| `session_stopped` | User stops a session via the Stop button |
| `session_prompt_sent` | User sends a prompt to a session via Argus |
| `todo_added` | User adds a todo item |
| `repo_diff_opened` | User opens the "View diff on GitHub" button |
| `integration_started` | A Slack or Teams integration becomes active |
| `integration_stopped` | A Slack or Teams integration is deactivated |
| `request_error` | An unhandled server error occurs (5xx) |

### Opt-Out Mechanism

`TelemetryService.isTelemetryEnabled()` reads `telemetryEnabled` from `~/.argus/config.json`. The result is cached for 5 seconds to avoid disk reads on every event. If `telemetryEnabled` is `false`, `sendEvent` returns immediately and makes no network call.

The user sets this toggle in Settings (gear icon, top right of dashboard). The config is updated immediately; no restart is required.

### Fire-and-Forget

`sendEvent` is always asynchronous and never awaited by callers. Every fetch is wrapped in a `try/catch` with a 2-second timeout. A network failure, PostHog outage, or timeout is silently swallowed. Telemetry must never degrade or block the product.

### TelemetryService (backend singleton)

`TelemetryService` is a plain class instantiated once at module load (`export const telemetryService = new TelemetryService()`). It is imported directly by routes and services that need to emit events. There is no DI container.

It maintains:
- `installationId`: read from disk once, then cached in memory.
- `appVersion`: read from `package.json` once, then cached.
- `enabledCache`: 5-second TTL cache of `telemetryEnabled`.
- `integrationStatus`: map of `{ platform: boolean }` updated by integration routes.

---

## GeoIP Enrichment

### Requirement

We want country and best-effort region attribution per event so maintainers can understand the geographic spread of Argus installations. City-level granularity is not needed and would be a stronger privacy intrusion.

### Approach: PostHog Native GeoIP with "Capture no IP"

PostHog's ingestion pipeline automatically performs GeoIP enrichment using the connection IP of each incoming HTTP request. Country and region are stored in the event record. The raw IP is then discarded when the project has **"Capture no IP"** enabled.

**How to enable**: PostHog dashboard: Settings → Project → General → IP data capture configuration → "Capture no IP".

This is the only configuration step required. No code change is needed to enable GeoIP; the absence of both `$geoip_disable` and `$ip` in the payload is sufficient.

**Result**:
- Each event carries a country and region in the PostHog dashboard.
- The raw IP address does not appear in any stored event record.
- Argus sends no IP-related properties to PostHog.

---

## Frontend Disclosure

The Telemetry & Privacy page (`/telemetry`) lists:
- What is collected (location, installation ID, app version, session metadata).
- Each event and when it fires.
- What is never collected (prompts, file paths, identity, full IP).
- How to opt out.

The telemetry notice banner (shown on first launch on the empty dashboard) reads:

> Argus collects anonymous usage data to improve the product. No coding or personal information is sent. Country and region is captured.

---

## Options Considered and Discarded

### Client-side subnet IP masking (`lan-network`)

**Approach**: Detect the Argus server's outbound IP using the `lan-network` npm package, zero the last octet (`x.x.x.0`), and set `$ip` on every PostHog event. Refresh the cached IP hourly by diffing `os.networkInterfaces()`.

**Why discarded**: The `$ip` property override controls what PostHog uses for GeoIP enrichment, but PostHog still receives the actual connection IP at the TCP level regardless. Masking only the `$ip` property provides marginal privacy benefit for a self-hosted developer tool. The added complexity (new dependency, hourly timer, `initialize()`/`destroy()` lifecycle, vitest `resolve.alias` workaround for CJS compatibility) was not justified. PostHog's "Capture no IP" project setting achieves the same outcome with no client-side code.

### PostHog `before_send` hook for IP masking

**Approach**: Use PostHog's `before_send` callback to intercept events before they are transmitted and strip or mask the IP.

**Why discarded**: The `before_send` hook runs in the browser and cannot access the server's IP address. It has no ability to detect or mask the outbound IP of the Argus backend process. This approach would still require `lan-network` and provides no benefit over setting `$ip` directly.

### Alternative providers: Mixpanel

**Approach**: Use Mixpanel with `ip: false` to prevent IP-based geolocation.

**Why discarded**: `ip: false` in Mixpanel disables IP collection entirely, meaning no GeoIP enrichment is performed. This satisfies privacy but eliminates geographic insights, which is a core requirement. Mixpanel also charges per event at scale and requires a separate SDK. PostHog's free tier and native GeoIP with "Capture no IP" satisfies both requirements.

### Alternative providers: Plausible / Umami

**Approach**: Self-host Plausible or Umami for privacy-first analytics with built-in GeoIP.

**Why discarded**: Both are designed for website page-view analytics, not backend event tracking. They provide no backend SDK or HTTP API that matches our server-to-server event model. Neither offers the event property flexibility needed (session type, yolo mode, integration flags, etc.).

### Alternative providers: OpenTelemetry

**Approach**: Use OpenTelemetry to emit structured traces and metrics to a collector.

**Why discarded**: OpenTelemetry is an instrumentation framework, not an analytics product. It would require operating a collector and a downstream analytics store (e.g., Jaeger, Tempo, Prometheus). This is significant infrastructure for a lightweight developer tool. PostHog is a turn-key SaaS with no infrastructure to operate.

### Opt-in model

**Approach**: Require users to explicitly enable telemetry before any events are sent.

**Why discarded**: Opt-in telemetry produces a heavily biased sample (only the most engaged users enable it) and very low volume. The product is anonymous and non-commercial. Opt-out with transparent disclosure (the notice banner and the Telemetry & Privacy page) is the standard model for developer tools and strikes a better balance between insight and user burden.

### City-level GeoIP

**Approach**: Collect city alongside country and region.

**Why discarded**: City-level location is a stronger identifier than country or region and offers no meaningful insight for maintainer decisions. Country and region are sufficient to understand geographic distribution.

### Granular location opt-out

**Approach**: Let users disable location enrichment specifically, while keeping all other telemetry events active.

**Why discarded**: The implementation complexity (a second toggle in config and UI, conditional logic in the event pipeline) is not warranted for a feature with no current users. The main on/off toggle is the only control needed. If demand arises this can be added later.

### External HTTP IP detection (e.g., `api.ipify.org`)

**Approach**: Detect the outbound IP by making an HTTP request to a third-party service at startup.

**Why discarded**: Adds an external runtime dependency, a network round-trip at startup, and fails in air-gapped environments. This was evaluated as part of the initial subnet-masking approach and rejected in favour of `lan-network`. Both were ultimately superseded by the PostHog-native GeoIP approach.
