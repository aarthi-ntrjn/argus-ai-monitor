# Tasks: Telemetry Location Enrichment

**Input**: Design documents from `specs/057-telemetry-location/`
**Branch**: `057-telemetry-location`

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2)

---

## Phase 1: Setup

**Purpose**: Install the one new production dependency before any implementation begins.

- [ ] T001 Install `lan-network` in the backend workspace: `npm install lan-network --workspace=backend`

**Checkpoint**: `backend/package.json` lists `lan-network` as a dependency.

---

## Phase 2: User Story 1 — View Geographic Distribution (Priority: P1) 🎯 MVP

**Goal**: Replace the existing GeoIP suppression (`$geoip_disable: true`, `$ip: ''`) with a subnet-masked IP (`x.x.x.0`). The Argus backend detects its outbound IP at startup via `lan-network`, zeros the last octet, caches the result, and refreshes hourly by diffing `os.networkInterfaces()`.

**Independent Test**: Enable telemetry, start the server, trigger an `app_started` event. Confirm the outgoing PostHog payload contains `$ip: "x.x.x.0"` and does NOT contain `$geoip_disable`. Verify the PostHog dashboard shows a country attribution for that event.

### Tests for User Story 1

> Write these FIRST and confirm they FAIL before implementing.

- [ ] T002 [P] [US1] Write unit tests for the new `IpMaskingService` in `backend/tests/unit/ip-masking-service.test.ts`: cover `maskIpLastOctet` (valid IPv4 returns `x.x.x.0`, IPv6 returns `null`, malformed returns `null`), `getMaskedIp()` returns `null` before `initialize()`, and `destroy()` prevents further interval callbacks
- [ ] T003 [P] [US1] Update unit tests in `backend/tests/unit/telemetry-service.test.ts`: assert `$geoip_disable` is absent from every outgoing payload; assert `$ip` equals the mocked masked value when `IpMaskingService.getMaskedIp()` returns a value; assert `$ip` is entirely omitted (not empty string) when `getMaskedIp()` returns `null`
- [ ] T004 [P] [US1] Update contract tests in `backend/tests/contract/telemetry.test.ts`: assert the event payload shape no longer includes `$geoip_disable`, and that `$ip` when present matches the `/^\d{1,3}\.\d{1,3}\.\d{1,3}\.0$/` pattern

### Implementation for User Story 1

- [ ] T005 [US1] Create `backend/src/services/ip-masking-service.ts`: implement `IpMaskingService` class with `initialize()` (calls `lan-network`'s `getNetworkIP()`, masks last octet, snapshots `os.networkInterfaces()`, starts `setInterval` at `IP_REFRESH_INTERVAL_MS = 3_600_000`), `getMaskedIp()`, `destroy()`, and private `maskIpLastOctet(ip: string): string | null` (returns `null` for IPv6 or unexpected formats). Log `[TelemetryService] Warning: outbound IP detection failed` on failure; do not throw.
- [ ] T006 [US1] Modify `backend/src/services/telemetry-service.ts`: add `IpMaskingService` as a constructor parameter, remove `$geoip_disable: true` and `$ip: ''` from the properties object on line 81, replace with `...(this.ipMaskingService.getMaskedIp() ? { $ip: this.ipMaskingService.getMaskedIp() } : {})`
- [ ] T007 [US1] Modify `backend/src/server.ts`: instantiate `IpMaskingService`, call `await ipMaskingService.initialize()` before the server starts accepting requests, pass the instance to `TelemetryService`'s constructor, and call `ipMaskingService.destroy()` in the graceful shutdown handler

**Checkpoint**: Run `npm run test --workspace=backend`. All T002, T003, T004 tests pass. Server starts, logs confirm IP detection result (or warning if unresolvable).

---

## Phase 3: User Story 2 — Accurate Privacy Disclosure (Priority: P1)

**Goal**: Update the two frontend disclosure surfaces so users can make an informed choice about telemetry now that approximate location is collected.

**Independent Test**: Navigate to `/telemetry`. Verify the "What is included" section lists approximate location with a note about /24 subnet masking. Verify "IP address or hostname" is absent from the "What is never collected" section. Verify the `TelemetryBanner` summary text mentions location.

### Implementation for User Story 2

- [ ] T008 [P] [US2] Update `frontend/src/pages/TelemetryPage.tsx`: add "Approximate location (country and best-effort region, derived from your server's subnet-masked IP address — only the first three octets are sent)" to the "What is included" list; remove "IP address or hostname" from the "What is never collected" list; add a brief note that Argus transmits only the /24 subnet-masked IP, not the full address
- [ ] T009 [P] [US2] Update `frontend/src/components/TelemetryBanner/TelemetryBanner.tsx`: change the summary text from "No coding or personal information is sent" to "Argus collects anonymous usage data including approximate location. No personal or coding data is collected."

**Checkpoint**: Navigate to `/telemetry` in the running app. Both disclosure surfaces reflect the updated policy. The "never collected" section does not mention IP address.

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: Documentation requirement (§XI) and build validation.

- [ ] T010 Update `README.md` telemetry section: document that telemetry now includes approximate location derived from the server's outbound IP, explain /24 subnet masking (only `x.x.x.0` is sent), and note that full IP is never transmitted to PostHog
- [ ] T011 [P] Run `npm run build --workspace=frontend` and confirm it exits cleanly with no TypeScript or build errors

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (US1)**: Requires Phase 1 complete (lan-network must be installed)
- **Phase 3 (US2)**: Independent of Phase 2 — can run in parallel once Phase 1 is done
- **Phase 4 (Polish)**: Requires Phases 2 and 3 complete

### Within Phase 2 (US1)

- T002, T003, T004 are parallel (different test files) — write all before implementing
- T005 before T006 (TelemetryService imports IpMaskingService)
- T006 before T007 (server.ts wires up the constructor)

### Parallel Opportunities

```
Phase 1 complete →
  ├── Phase 2: T002 + T003 + T004 (all parallel)
  │              ↓
  │           T005 → T006 → T007
  └── Phase 3: T008 + T009 (parallel, independent of Phase 2)
```

---

## Implementation Strategy

### MVP (Both US1 and US2 are P1 — ship together)

1. Phase 1: Install `lan-network`
2. Phase 2: Implement `IpMaskingService` and wire into `TelemetryService` + `server.ts`
3. Phase 3: Update frontend disclosure (can be done in parallel with Phase 2)
4. Phase 4: README update + build check
5. Run full test suite: `npm run test --workspace=backend`
6. Build frontend: `npm run build --workspace=frontend`
7. Commit and push

---

## Notes

- `$ip` must be **omitted entirely** (not set to `''`) when `getMaskedIp()` returns `null` — an empty string causes PostHog to fall back to the real connection IP (see R-004 in research.md)
- `IP_REFRESH_INTERVAL_MS = 3_600_000` must be a named constant — do not inline the number
- Log prefix for all IpMaskingService messages: `[TelemetryService]` (it is initialized in that context; no separate tagged logger needed unless added later)
- `destroy()` must be called on graceful shutdown to prevent the `setInterval` from keeping the process alive
