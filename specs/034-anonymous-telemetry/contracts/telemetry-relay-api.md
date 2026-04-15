# Contract: Telemetry Relay API

**Endpoint**: `POST /api/v1/telemetry/event`
**Bound to**: `127.0.0.1:7411` (localhost only)
**Auth**: None (localhost-bound single-user tool; §VI exception applies)

## Purpose

Accepts UI-side telemetry events from the frontend and relays them to the external collector. The backend appends installation ID, app version, and timestamp before forwarding.

## Request

```
POST /api/v1/telemetry/event
Content-Type: application/json

{
  "type": "compare_view_opened"
}
```

### Request fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `string` | Yes | Must be a valid `TelemetryEventType` value |

The frontend MUST only send event types that cannot be observed by the backend (currently: `compare_view_opened`). Backend-observable events (session lifecycle, prompt sent) are instrumented server-side and MUST NOT be sent via this endpoint to avoid double-counting.

## Response

### 204 No Content
Event accepted and relay dispatched (fire-and-forget — relay success is not guaranteed).

### 400 Bad Request
```json
{ "error": "INVALID_EVENT_TYPE", "message": "Unknown event type", "requestId": "..." }
```

### 503 Service Unavailable
```json
{ "error": "TELEMETRY_DISABLED", "message": "Telemetry is disabled", "requestId": "..." }
```
Returned when `telemetryEnabled` is `false`. Frontend SHOULD suppress calls when it knows telemetry is disabled, but this provides a safe fallback.

## External Collector Payload

The backend forwards the following JSON body via HTTP POST to the configured external endpoint:

```json
{
  "installationId": "550e8400-e29b-41d4-a716-446655440000",
  "type": "compare_view_opened",
  "appVersion": "1.0.0",
  "timestamp": "2026-04-13T10:00:00.000Z"
}
```

For `session_started` events only, an additional field is included:

```json
{
  "installationId": "550e8400-e29b-41d4-a716-446655440000",
  "type": "session_started",
  "sessionType": "claude-code",
  "appVersion": "1.0.0",
  "timestamp": "2026-04-13T10:00:00.000Z"
}
```

## Failure Modes

| Failure | Behaviour |
|---------|-----------|
| External endpoint unreachable | Silent drop, no retry |
| External endpoint returns non-2xx | Silent drop, no retry |
| Send times out (>2s) | Silent drop |
| `telemetryEnabled` is false | Return 503, no relay |
| Unknown `type` in request | Return 400, no relay |
