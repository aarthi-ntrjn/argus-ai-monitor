# Data Model: Telemetry Location Enrichment

**Branch**: `057-telemetry-location` | **Date**: 2026-04-25 | **Updated**: 2026-05-01

## Entities

### ~~IpMaskingService~~ *(Superseded)*

Originally planned as a new backend service class for outbound IP detection, masking, and caching. Removed during implementation after the design pivot to PostHog-native GeoIP enrichment. See research.md R-001.

---

### TelemetryEvent (modified — existing type)

PostHog event payload shape. Loses `$geoip_disable` and `$ip`. PostHog uses the connection IP natively for GeoIP enrichment.

**Before**:
```ts
{
  api_key: string,
  distinct_id: string,       // installation ID
  event: TelemetryEventType,
  properties: {
    appVersion: string,
    $geoip_disable: true,    // REMOVED
    $ip: '',                 // REMOVED
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
    // No $ip property — PostHog uses connection IP for GeoIP enrichment
    // No $geoip_disable — PostHog GeoIP pipeline is active
    ...integrationProps,
    ...extra
  },
  timestamp: string,
}
```

**Validation rules**:
- `$ip` must not appear in any payload (its presence overrides the connection IP).
- `$geoip_disable` must not appear in any payload (its presence suppresses GeoIP enrichment).

---

### TelemetryService (modified — existing class)

Removed dependency on `IpMaskingService`. `sendEvent` constructs properties as `{ appVersion, ...integrationProps, ...extra }`. No IP lookup or `$ip` injection on the hot path.

**Constructor**: Takes no parameters (unchanged public API).

**Properties payload** (simplified):
```ts
properties: { appVersion, ...integrationProps, ...extra }
```

---

### TelemetrySettings (no change)

`telemetryEnabled: boolean` remains the only control. No `locationEnabled` flag.

---

## No New Storage

All changes are removals. No new database tables, files, config keys, or in-memory state are added.

## Frontend Disclosure Model

No new frontend types. `TelemetryPage.tsx` is a content-only update (static JSX strings). No API or prop shape changes. `TelemetryBanner.tsx` required no changes.
