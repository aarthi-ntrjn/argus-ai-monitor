# Research: Telemetry Location Enrichment

**Branch**: `057-telemetry-location` | **Date**: 2026-04-25

## R-001: GeoIP Enrichment Strategy

**Decision**: Rely on PostHog's native GeoIP enrichment pipeline. Remove `$geoip_disable: true` and `$ip: ''` from the telemetry event properties. Do not add any `$ip` property; PostHog uses the connection IP of each incoming HTTP request for GeoIP enrichment automatically.

**Configure PostHog "Capture no IP"**: In PostHog Settings → Project → General → IP data capture configuration, set the project to "Capture no IP". PostHog will then perform GeoIP enrichment transiently (resolving country, region) and discard the raw IP rather than storing it in event records. This is a one-time manual dashboard step, not a code change.

**Rationale**: The earlier planned approach (detect outbound IP via `lan-network`, zero last octet, set `$ip` on each event) provided only marginal privacy benefit. PostHog already receives the real connection IP at the TCP level regardless of the `$ip` property value. The "Capture no IP" project setting achieves the same outcome (country/region stored, raw IP discarded) with no client-side complexity.

**Alternatives considered and superseded**:
- `lan-network` + subnet masking (`x.x.x.0`): removed. Added `lan-network` dependency, hourly refresh interval, `IpMaskingService` class, `initialize()`/`destroy()` lifecycle, and a vitest `resolve.alias` workaround — all for protection that PostHog's project setting provides natively.
- PostHog `before_send` hook: cannot access the machine's IP address; would still require `lan-network`. Rejected.
- `ip: false` (Mixpanel-style): drops IP entirely, providing no GeoIP at all. Rejected per FR-001.

---

## R-002: IPv4 Last-Octet Masking

**Status**: *Superseded by R-001.* No client-side masking is performed. PostHog handles GeoIP natively.

---

## R-003: Cache Refresh Strategy for Network Changes

**Status**: *Superseded by R-001.* No IP caching or refresh interval is needed. There is no `IpMaskingService`.

---

## R-004: PostHog `$ip` Property Behavior

**Decision**: Remove both `$geoip_disable: true` and `$ip: ''` from the properties object. Set neither field. PostHog's ingestion pipeline uses the connection IP for GeoIP enrichment when no `$ip` override is present and `$geoip_disable` is absent.

**Current code** (`telemetry-service.ts` before this feature):
```ts
properties: { appVersion, $geoip_disable: true, $ip: '', ...extra }
```

**Final implementation**:
```ts
properties: { appVersion, ...integrationProps, ...extra }
```

No `$ip`, no `$geoip_disable`. PostHog resolves country and region from the connection IP. Raw IP is discarded by PostHog when "Capture no IP" is enabled.

---

## R-005: Frontend Privacy Disclosure Updates

**Decision**: Update two locations in the frontend:
1. `TelemetryPage.tsx`: Updated "Approximate location" entry to describe PostHog's native GeoIP enrichment (connection IP used transiently; not stored in event records when "Capture no IP" is enabled). Updated "never collected" IP entry to clarify the IP is used transiently for geolocation but not stored.
2. `TelemetryBanner.tsx`: Existing text did not require changes (it accurately described that no personal information is sent).
