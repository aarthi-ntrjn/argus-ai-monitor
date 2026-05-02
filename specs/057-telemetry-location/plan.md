# Implementation Plan: Telemetry Location Enrichment

**Branch**: `057-telemetry-location` | **Date**: 2026-04-25 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/057-telemetry-location/spec.md`

## Summary

Enable country (and best-effort region) location enrichment in PostHog telemetry by removing the existing GeoIP suppression flags (`$geoip_disable: true`, `$ip: ''`) and relying on PostHog's native GeoIP enrichment pipeline. PostHog automatically enriches events with country and region using the connection IP of each incoming HTTP request. The raw IP is not stored in event records when the PostHog project is configured with "Capture no IP" (Settings → Project → General → IP data capture configuration). This eliminates the need for any client-side IP detection, masking, or caching, and removes the `lan-network` dependency. The TelemetryPage and TelemetryBanner are updated to accurately reflect the updated data collection policy.

> **Implementation note**: An earlier design planned to use `lan-network` for outbound IP detection and set a subnet-masked `$ip` property on each PostHog event. During implementation, this was superseded by the simpler PostHog-native approach above.

## Technical Context

**Language/Version**: TypeScript 5.9, Node.js ESM (tsx/tsc)
**Primary Dependencies**: Fastify 5, Node.js built-in `net` module, PostHog via HTTP fetch
**Storage**: N/A (no new in-memory state or persistence)
**Testing**: Vitest 3 (unit: `backend/tests/unit/`, contract: `backend/tests/contract/`)
**Target Platform**: Cross-platform server (Windows, macOS, Linux)
**Project Type**: Web service (Fastify backend + React/Vite frontend)
**Performance Goals**: Zero per-event overhead (no IP detection; no extra computation on the hot path)
**Constraints**: No client-side IP transmission to PostHog; no new npm dependencies; PostHog "Capture no IP" project setting required (manual dashboard step); no new config surface
**Scale/Scope**: Single-user localhost developer tool

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| § | Principle | Status | Notes |
|---|-----------|--------|-------|
| §I | Reliable, observable, debuggable | PASS | Warning logged on IP detection failure |
| §III | Structured logging | PASS | Existing `console.info/error` tagged with `[telemetry]` prefix |
| §IV | Test-first | PASS | Tests written before implementation per constitution |
| §V | Unit + integration tests | PASS | Unit test for `IpMaskingService`; existing contract tests updated |
| §VI | Auth/audit | PASS | No new endpoints; no new auth surface |
| §VII | Observability | PASS | Failure logged; no silent swallowing |
| §VIII | Performance | PASS | Single-user tool; IP detection is one-time startup cost |
| §X | DoD | PASS | Code, tests, docs, README update all included |
| §XI | Documentation | PASS | README.md telemetry section must be updated in same PR |
| §XII | Error handling | PASS | IP detection failure logged with context; never surfaced to user |

> **§XI Documentation**: A README.md update task is included in tasks.md to document the change in telemetry data collection.

**Post-design re-check**: No violations introduced by Phase 1 design.

## Project Structure

### Documentation (this feature)

```text
specs/057-telemetry-location/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
backend/
├── src/
│   └── services/
│       └── telemetry-service.ts     # Modified: removed $geoip_disable and $ip; PostHog uses connection IP natively
└── tests/
    ├── unit/
    │   └── telemetry-service.test.ts     # Modified: assert $geoip_disable absent, $ip never present
    └── contract/
        └── telemetry.test.ts             # Modified: assert $ip is never present in payload

frontend/
└── src/
    ├── pages/
    │   └── TelemetryPage.tsx             # Modified: updated location disclosure; IP transient use described
    └── components/
        └── TelemetryBanner/
            └── TelemetryBanner.tsx       # No change required (existing text remained accurate)
```

**Structure Decision**: Web application (Option 2). No new source directories; changes are isolated to the existing `services/` layer (backend) and two existing frontend components.
