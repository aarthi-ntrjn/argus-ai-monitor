# Data Model: Telemetry Location Enrichment

**Branch**: `057-telemetry-location` | **Date**: 2026-04-25

## Entities

### IpMaskingService (new backend service class)

Responsible for detecting the Argus server's outbound IP, masking it, caching the result, and refreshing periodically.

| Field/Method | Type | Description |
|---|---|---|
| `maskedIp` | `string \| null` | Cached /24 subnet-masked IP (`x.x.x.0`). `null` if detection has not succeeded. |
| `initialize()` | `Promise<void>` | Detects outbound IP at startup, masks it, starts refresh interval. |
| `getMaskedIp()` | `string \| null` | Returns the current cached value. Safe to call any time after construction. |
| `destroy()` | `void` | Clears the refresh interval (used in tests and graceful shutdown). |

**State transitions**:
```
[uninitialized] --initialize()--> [detecting] --success--> [cached: "x.x.x.0"]
                                             --failure--> [no-ip: null, warning logged]
[cached] --network-change event--> [detecting] --success--> [cached: updated value]
                                               --failure--> [cached: previous value retained]
```

**Validation rules**:
- Masked IP must match `/^\d{1,3}\.\d{1,3}\.\d{1,3}\.0$/` if non-null.
- IPv6 or unrecognized format results in `null` (events sent without `$ip`).
- `initialize()` must be called once at server startup before any telemetry events are sent.

---

### TelemetryEvent (modified — existing type)

PostHog event payload shape. Gains an optional `$ip` property; loses `$geoip_disable`.

**Before**:
```ts
{
  api_key: string,
  distinct_id: string,       // installation ID
  event: TelemetryEventType,
  properties: {
    appVersion: string,
    $geoip_disable: true,    // REMOVED
    $ip: '',                 // CHANGED: now set to "x.x.x.0" when available
    ...extra
  },
  timestamp: string,
}
```

**After**:
```ts
{
  api_key: string,
  distinct_id: string,
  event: TelemetryEventType,
  properties: {
    appVersion: string,
    $ip?: string,            // "x.x.x.0" format when IP detected; omitted when null
    ...extra
  },
  timestamp: string,
}
```

**Validation rules**:
- `$ip` is omitted (not set to empty string) when `maskedIp` is `null` — sending an empty string causes PostHog to fall back to the connection IP.
- `$geoip_disable` must not appear in the payload.

---

### TelemetryService (modified — existing class)

Gains a dependency on `IpMaskingService`. The `sendEvent` method reads `getMaskedIp()` and injects it into the payload.

**Modified constructor/initialization flow**:
```
server.ts: IpMaskingService.initialize() → TelemetryService receives reference
```

**Dependency injection**: `TelemetryService` accepts `IpMaskingService` as a constructor parameter (or via a setter) to keep it testable.

---

### TelemetrySettings (no change)

`telemetryEnabled: boolean` remains the only control. No `locationEnabled` flag.

---

## No New Storage

All new state is in-memory only (`maskedIp` field on `IpMaskingService`). No new database tables, files, or config keys are added.

## Frontend Disclosure Model

No new frontend types. `TelemetryPage.tsx` and `TelemetryBanner.tsx` are content-only updates (static JSX strings). No API or prop shape changes.
