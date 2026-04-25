# Research: Telemetry Location Enrichment

**Branch**: `057-telemetry-location` | **Date**: 2026-04-25

## R-001: Outbound IP Detection in Node.js (Cross-Platform)

**Decision**: Use `lan-network` npm package for IP detection. It uses UDP sockets with 3 fallback strategies (gateway socket, broadcast socket, and raw socket) to reliably find the outbound IP — the same approach as a raw `net.Socket` probe but with more robust error handling.

**Package**: `lan-network` v0.2.1 — MIT, 13.9M monthly downloads, actively maintained by @kitten (Phil Pluckthun). Zero production dependencies.

**Rationale**: `lan-network` uses the same fundamental UDP socket trick (select interface by routing to a public address) but handles more edge cases (multiple interfaces, socket errors, fallbacks). It is already used by popular tools in the ecosystem, explaining its high download count.

**Approach**:
```ts
import { lanNetwork } from 'lan-network';

async function detectOutboundIp(): Promise<string | null> {
  const result = await lanNetwork();
  // lan-network falls back to 127.0.0.1 (internal: true) if no external route found
  if (result.internal) return null;
  return result.address;
}
```

**Alternatives considered**:
- Raw `net.Socket` probe to `8.8.8.8:53`: works but has no fallbacks — a single socket error fails detection entirely. `lan-network` is strictly more robust.
- `os.networkInterfaces()`: returns all interface IPs but cannot determine which one is used for outbound traffic. Fails in multi-homed environments.
- External HTTP service (e.g., `api.ipify.org`): adds a network round-trip, external dependency, and latency. Fails in air-gapped installs.
- DNS lookup of hostname: unreliable; loopback or LAN IPs may be returned.

---

## R-002: IPv4 Last-Octet Masking

**Decision**: Zero the last octet of the detected IPv4 address (`x.x.x.0`). For IPv6, send an empty string (no masking logic implemented for IPv6 in v1).

**Rationale**: A /24 subnet mask preserves country and region/state resolution in all major GeoIP databases including MaxMind (used by PostHog). The first three octets locate the ISP block, which is sufficient for geographic attribution. IPv6 GeoIP is less reliable and Argus is primarily used on developer machines where IPv4 is the outbound address.

**Implementation**:
```ts
function maskIpLastOctet(ip: string): string {
  const parts = ip.split('.');
  if (parts.length === 4) {
    parts[3] = '0';
    return parts.join('.');
  }
  return ''; // IPv6 or unexpected format: omit $ip
}
```

**Alternatives considered**:
- Mask last two octets (`x.x.0.0`): reduces to country-only resolution; loses region/state. Rejected per spec FR-002.
- No masking (full IP): violates the explicit privacy requirement agreed in clarification Q1.

---

## R-003: Cache Refresh Strategy for Network Changes

**Decision**: Cache the masked IP in memory at startup. Refresh by polling `os.networkInterfaces()` every 60 minutes and comparing the result to the cached value. If the outbound-eligible interface set changes, re-run `lan-network.getNetworkIP()` to get the new IP.

**Rationale**: No well-maintained, cross-platform npm package exists for network-change events in Node.js. After exhaustive npm search, all candidates either target browsers (Web Network API), mobile (Capacitor), or are unmaintained. The pragmatic zero-dependency alternative — polling `os.networkInterfaces()` every 60 minutes and diffing — is simple, cross-platform, and sufficient for the use case (VPN connect/disconnect, network switch). Hourly polling is acceptable lag for a background telemetry service.

**Implementation note**: At startup, snapshot `os.networkInterfaces()`. Start a `setInterval` at 60 minutes (3600000ms). On each tick, compare current interfaces to the snapshot.If any IPv4 non-internal interface has changed (added, removed, or address changed), re-run `getNetworkIP()`. If re-detection succeeds, update `maskedIp`. If it fails, retain the previous cached value (degraded mode). On success, update the snapshot. Stop the interval on `destroy()`.

**Alternatives considered**:
- Dedicated npm package for network-change events: no suitable cross-platform package exists in the npm ecosystem (researched April 2026).
- Platform-specific native APIs (Windows `NotifyIpInterfaceChange`, macOS `SCDynamicStore`, Linux `netlink`): no new npm deps, but requires OS-conditional code branches. Rejected as overly complex.
- No refresh (detect once only): fails for VPN users who connect mid-session. Rejected.

---

## R-004: PostHog `$ip` Property Behavior

**Decision**: Set `$ip` to the subnet-masked value on every event. Remove `$geoip_disable: true` entirely.

**Rationale**: PostHog's ingestion pipeline uses the `$ip` event property (if present and non-empty) as the IP for GeoIP enrichment, overriding the connection IP. Setting `$ip: "x.x.x.0"` gives PostHog a valid IP to resolve. Removing `$geoip_disable: true` re-enables PostHog's GeoIP enrichment pipeline. The combination of both changes is required: removing only `$geoip_disable` would send the actual outbound IP; setting only `$ip` without removing `$geoip_disable` would still suppress enrichment.

**Current code** (`telemetry-service.ts` line 81):
```ts
properties: { appVersion, $geoip_disable: true, $ip: '', ...extra }
```

**Target**:
```ts
properties: { appVersion, ...(maskedIp ? { $ip: maskedIp } : {}), ...extra }
```

**Alternatives considered**:
- PostHog project-level "Anonymize IPs" setting: full IP still travels to PostHog on the wire. Rejected (violates privacy requirement).
- Setting `$ip` to empty string and removing `$geoip_disable`: PostHog falls back to connection IP (full IP). Rejected.

---

## R-005: Frontend Privacy Disclosure Updates

**Decision**: Update two locations in the frontend:
1. `TelemetryPage.tsx`: Add "Approximate location" to the "What is included" list. Remove "IP address or hostname" from "What is never collected". Add a note explaining the /24 subnet masking.
2. `TelemetryBanner.tsx`: The current text "No coding or personal information is sent" remains accurate (location is not personal information at /24 granularity), but should be updated to proactively mention location to avoid surprise. Change to: "Argus collects anonymous usage data including approximate location."

**Rationale**: FR-003, FR-004, FR-005 all require disclosure updates. The TelemetryPage change is the primary disclosure surface. The banner update is a secondary notice for users who never navigate to the full page.
