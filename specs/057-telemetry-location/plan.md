# Implementation Plan: Telemetry Location Enrichment

**Branch**: `057-telemetry-location` | **Date**: 2026-04-25 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/057-telemetry-location/spec.md`

## Summary

Enable country (and best-effort region) location enrichment in PostHog telemetry by replacing the existing GeoIP suppression flags with a subnet-masked IP. The Argus backend detects its outbound IP at startup using `lan-network` (UDP socket with 3 fallback strategies), zeros the last octet, caches the result, and refreshes it hourly by diffing `os.networkInterfaces()`. If detection fails, a warning is logged and events proceed without `$ip`. One new npm dependency (`lan-network`) is added to the backend. The TelemetryPage and TelemetryBanner are updated to accurately reflect the updated data collection policy.

## Technical Context

**Language/Version**: TypeScript 5.9, Node.js ESM (tsx/tsc)
**Primary Dependencies**: Fastify 5, Node.js built-in `net` module (outbound IP probe), PostHog via HTTP fetch
**Storage**: N/A (masked IP cached in-memory only; no new persistence)
**Testing**: Vitest 3 (unit: `backend/tests/unit/`, contract: `backend/tests/contract/`)
**Target Platform**: Cross-platform server (Windows, macOS, Linux)
**Project Type**: Web service (Fastify backend + React/Vite frontend)
**Performance Goals**: IP detection < 200ms at startup (one-time); per-event overhead: zero (cached value reused)
**Constraints**: Full IP must never be transmitted to PostHog; one new npm dependency (`lan-network` for outbound IP detection); hourly `os.networkInterfaces()` polling for change detection; no new config surface
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
│       ├── telemetry-service.ts     # Modify: remove $geoip_disable, inject masked $ip
│       └── ip-masking-service.ts    # New: outbound IP detection, masking, caching
└── tests/
    ├── unit/
    │   ├── telemetry-service.test.ts     # Modify: assert $geoip_disable absent, $ip format
    │   └── ip-masking-service.test.ts    # New: unit tests for masking logic
    └── contract/
        └── telemetry.test.ts             # Modify: assert location payload shape

frontend/
└── src/
    ├── pages/
    │   └── TelemetryPage.tsx             # Modify: add location to collected, remove IP from never-collected
    └── components/
        └── TelemetryBanner/
            └── TelemetryBanner.tsx       # Modify: update summary text to reflect location
```

**Structure Decision**: Web application (Option 2). No new source directories; changes are isolated to the existing `services/` layer (backend) and two existing frontend components.
