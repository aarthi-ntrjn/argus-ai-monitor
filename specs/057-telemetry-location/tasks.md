# Tasks: Telemetry Location Enrichment

**Input**: Design documents from `specs/057-telemetry-location/`
**Branch**: `057-telemetry-location`
**Status**: All tasks complete. Implementation deviated from the original plan after a mid-session design pivot (see research.md R-001).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2)

---

## Phase 1: Setup

**Purpose**: Originally planned to install `lan-network`. Superseded — see pivot note below.

- [x] T001 ~~Install `lan-network` in the backend workspace~~ Superseded: `lan-network` was installed and then immediately uninstalled after the design pivot to PostHog-native GeoIP. No new production dependencies are added by this feature.

> **Design pivot**: After evaluating PostHog's native GeoIP capabilities, the `IpMaskingService` + `lan-network` approach was dropped in favour of relying on PostHog's connection IP enrichment with the "Capture no IP" project setting. All Phase 2 tasks reflect the revised implementation.

---

## Phase 2: User Story 1 — View Geographic Distribution (Priority: P1) 🎯 MVP

**Goal**: Remove the existing GeoIP suppression (`$geoip_disable: true`, `$ip: ''`) and let PostHog enrich events with country/region using its native GeoIP pipeline from the connection IP. No client-side IP detection is performed.

**Independent Test**: Enable telemetry, start the server, trigger an `app_started` event. Confirm the outgoing PostHog payload contains neither `$geoip_disable` nor `$ip`. Verify the PostHog dashboard shows a country attribution for that event (requires "Capture no IP" project setting to be enabled in PostHog).

### Tests for User Story 1

- [x] T002 [P] [US1] ~~Write unit tests for the new `IpMaskingService`~~ Superseded: `IpMaskingService` was not implemented. Removed corresponding test file.
- [x] T003 [P] [US1] Update unit tests in `backend/tests/unit/telemetry-service.test.ts`: assert `$geoip_disable` is absent from every outgoing payload; assert `$ip` is entirely absent (never present) from all payloads
- [x] T004 [P] [US1] Update contract tests in `backend/tests/contract/telemetry.test.ts`: assert `$geoip_disable` is absent; assert `$ip` is never present in any payload

### Implementation for User Story 1

- [x] T005 [US1] ~~Create `backend/src/services/ip-masking-service.ts`~~ Superseded: file was not created (and was deleted after the pivot). PostHog handles GeoIP natively.
- [x] T006 [US1] Modify `backend/src/services/telemetry-service.ts`: remove `$geoip_disable: true` and `$ip: ''` from the properties object; remove `IpMaskingService` import, field, constructor parameter, and `setIpMaskingService` method; properties payload is now `{ appVersion, ...integrationProps, ...extra }`
- [x] T007 [US1] Modify `backend/src/server.ts`: remove `IpMaskingService` import, instantiation, `initialize()` call, and `destroy()` calls from SIGTERM/SIGINT handlers

**Checkpoint**: Run `npm run test --workspace=backend` targeting telemetry tests. All 26 telemetry tests pass (15 unit, 11 contract).

---

## Phase 3: User Story 2 — Accurate Privacy Disclosure (Priority: P1)

**Goal**: Update the frontend disclosure surfaces so users understand that approximate location is now collected via PostHog's native GeoIP pipeline, and that raw IP is not stored in event records.

**Independent Test**: Navigate to `/telemetry`. Verify the "What is included" section describes approximate location via PostHog native GeoIP. Verify the "never collected" IP entry describes transient use. Verify the `TelemetryBanner` is consistent.

### Implementation for User Story 2

- [x] T008 [P] [US2] Update `frontend/src/pages/TelemetryPage.tsx`: updated "Approximate location" entry to reflect PostHog native GeoIP; updated the "never collected" IP entry to describe transient use for geolocation
- [x] T009 [P] [US2] `frontend/src/components/TelemetryBanner/TelemetryBanner.tsx`: no change required — existing text remained accurate

**Checkpoint**: Navigate to `/telemetry` in the running app. Disclosure accurately reflects the updated data collection policy.

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: Documentation (§XI) and build validation.

- [x] T010 Update `README.md` telemetry section: replaced subnet-masking description with PostHog native GeoIP description; noted that raw IP is not stored when "Capture no IP" is enabled
- [x] T011 [P] Run `npm run build --workspace=frontend` — exits cleanly with no TypeScript or build errors

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — superseded
- **Phase 2 (US1)**: No new dependencies (no `lan-network`)
- **Phase 3 (US2)**: Independent of Phase 2
- **Phase 4 (Polish)**: Requires Phases 2 and 3 complete

### Parallel Opportunities

```
Phase 2: T003 + T004 (parallel test updates)
           ↓
        T006 → T007

Phase 3: T008 (independent of Phase 2)
```

---

## Implementation Strategy

### MVP (Both US1 and US2 are P1 — shipped together)

1. Phase 2: Remove `$geoip_disable` and `$ip` from `TelemetryService`; remove `IpMaskingService` wiring from `server.ts`
2. Phase 3: Update frontend disclosure (parallel with Phase 2)
3. Phase 4: README update + build check
4. Run telemetry tests: `npm run test --workspace=backend -- telemetry`
5. Build frontend: `npm run build --workspace=frontend`
6. Commit and push

---

## Notes

- **Manual PostHog step required**: "Capture no IP" must be enabled in PostHog Settings → Project → General → IP data capture configuration. Without this, PostHog stores raw IP in event records. This is a dashboard action, not a code change.
- `$geoip_disable` must be absent from every payload (its presence suppresses PostHog GeoIP enrichment)
- `$ip` must be absent from every payload (setting it to empty string causes PostHog to fall back to connection IP with full IP; omitting it entirely is correct)
- No new npm dependencies are added by this feature
