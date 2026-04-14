# Data Model: Anonymous Usage Telemetry

**Branch**: `034-anonymous-telemetry` | **Date**: 2026-04-13

## Entities

### TelemetryEvent (outbound payload)

Transmitted to the external collector. Never stored locally beyond the in-flight request.

| Field | Type | Constraints |
|-------|------|-------------|
| `installationId` | `string` (UUID v4) | Required. Must not be null or empty. |
| `type` | `TelemetryEventType` | Required. Must be one of the allowed event types. |
| `appVersion` | `string` | Required. Read from `package.json`. Fallback: `"unknown"`. |
| `timestamp` | `string` (ISO 8601 UTC) | Required. Set at dispatch time. |

No other fields are permitted.

### TelemetryEventType (enum)

```
app_started
session_started        // payload: sessionType ('claude-code' | 'copilot-cli')
session_ended
prompt_sent
session_stopped
compare_view_opened
```

`session_started` carries `sessionType` as an additional field (the only event with an extra field). All other events carry only the four base fields.

### InstallationId (persisted locally)

Stored as a plain UUID string in `~/.argus/telemetry-id` (single line, no JSON wrapper).

| Property | Description |
|----------|-------------|
| Value | UUID v4 string |
| Location | `~/.argus/telemetry-id` |
| Scope | Per OS user profile |
| Lifecycle | Generated once on first backend startup; never rotated unless file is deleted |

### ArgusConfig additions

Two new fields added to the existing `ArgusConfig` interface and `~/.argus/config.json`:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `telemetryEnabled` | `boolean` | `true` | Whether the backend dispatches telemetry events |
| `telemetryPromptSeen` | `boolean` | `false` | Whether the first-launch banner has been shown and dismissed |

Both are user-settable via `PATCH /api/v1/settings`.

## State Transitions

```
telemetryPromptSeen: false
  → user sees banner on first load
  → user dismisses banner (accept or decline)
  → PATCH /api/v1/settings { telemetryPromptSeen: true, telemetryEnabled: <choice> }
  → telemetryPromptSeen: true (banner never shown again)

telemetryEnabled: true  →  events dispatched on instrumented actions
telemetryEnabled: false →  events silently suppressed
```

## Validation Rules

- `installationId` must be a valid UUID v4 format; if corrupt, regenerate.
- `type` is validated server-side against the `TelemetryEventType` enum; unknown types are rejected with 400 (relay endpoint) and never forwarded.
- `appVersion` must be a non-empty string; fall back to `"unknown"` rather than sending null.
- `telemetryEnabled` and `telemetryPromptSeen` follow the same boolean coercion rules as other `ArgusConfig` booleans.
