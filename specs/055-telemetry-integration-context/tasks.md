# Tasks: Telemetry Integration Context

**Input**: User request + codebase analysis of `backend/src/services/telemetry-service.ts`, `backend/src/api/routes/integrations.ts`, `backend/src/models/index.ts`
**Branch**: `integration/teams-slack`

## Summary

Two goals:
1. **US1**: Every telemetry event sent to PostHog must include integration status properties (`teams_enabled`, `slack_enabled`) so the maintainer can segment usage by which integrations are active.
2. **US2**: Fire `integration_started` / `integration_stopped` events when integrations start and stop. **Already implemented** — `integrations.ts` lines 71, 80, 89, 98 already call `telemetryService.sendEvent('integration_started'/'integration_stopped', { platform })`. US2 tasks verify correctness and add enrichment.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story ([US1], [US2])

---

## Phase 1: Setup

**Purpose**: Understand the current call graph and confirm no regressions before changes.

- [ ] T001 Read `backend/src/services/telemetry-service.ts` and `backend/src/api/routes/integrations.ts` to confirm all `sendEvent` call sites and integration start/stop handlers

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Extend `TelemetryService` with an integration status registry so every event payload automatically includes integration state.

**⚠️ CRITICAL**: US1 and US2 enrichment both depend on this phase.

- [ ] T002 Add `private integrationStatus: Record<string, boolean> = {}` field and `setIntegrationStatus(platform: string, running: boolean): void` method to `TelemetryService` in `backend/src/services/telemetry-service.ts`
- [ ] T003 In `TelemetryService.sendEvent`, merge `integrationStatus` into the event `properties` payload automatically — keys formatted as `{platform}_enabled` (e.g., `teams_enabled: true`) — so every event type gets this context without callers changing anything in `backend/src/services/telemetry-service.ts`

**Checkpoint**: Foundation ready — integration status now flows into every event.

---

## Phase 3: User Story 1 — Integration Context on All Events (Priority: P1) 🎯 MVP

**Goal**: Every event in PostHog (app_started, session_started, session_ended, etc.) carries `teams_enabled` and `slack_enabled` boolean properties, populated from live runtime state.

**Independent Test**: Start Argus with Slack enabled and Teams disabled, trigger a session, and verify the PostHog event has `slack_enabled: true, teams_enabled: false`.

### Implementation for User Story 1

- [ ] T004 [US1] In `backend/src/api/routes/integrations.ts`, call `telemetryService.setIntegrationStatus('slack', true)` after `slackNotifier.initialize()` succeeds and `telemetryService.setIntegrationStatus('slack', false)` after `slackNotifier.shutdown()` (alongside the existing `sendEvent` calls already there)
- [ ] T005 [US1] In `backend/src/api/routes/integrations.ts`, call `telemetryService.setIntegrationStatus('teams', true)` after `teamsNotifier.initialize()` succeeds and `telemetryService.setIntegrationStatus('teams', false)` after `teamsNotifier.shutdown()` (alongside the existing `sendEvent` calls already there)
- [ ] T006 [US1] In `backend/src/server.ts`, after all integrations are optionally initialized at startup, call `telemetryService.setIntegrationStatus('slack', slackNotifier?.isRunning === true)` and `telemetryService.setIntegrationStatus('teams', teamsNotifier?.isRunning === true)` so `app_started` carries the correct initial state

**Checkpoint**: US1 complete — open PostHog Live Events, confirm integration properties appear on every event type.

---

## Phase 4: User Story 2 — Integration Start/Stop Telemetry Verification (Priority: P1)

**Goal**: Confirm `integration_started` and `integration_stopped` events already fire correctly, and enrich them with the full integration context so they are consistent with all other events.

**Independent Test**: Start and stop the Slack integration via the UI, verify two PostHog events appear: `integration_started` with `{ platform: 'slack', slack_enabled: true }` and `integration_stopped` with `{ platform: 'slack', slack_enabled: false }`.

### Implementation for User Story 2

- [ ] T007 [US2] Verify that `integration_started` and `integration_stopped` events already fire correctly in `backend/src/api/routes/integrations.ts` (lines 71, 80, 89, 98) — no code change needed if correct, just confirm
- [ ] T008 [US2] Confirm that because `setIntegrationStatus` is called before `sendEvent` in T004/T005, the `integration_started` event will automatically include `teams_enabled`/`slack_enabled` in its payload via the T003 merge — verify ordering is correct in `backend/src/api/routes/integrations.ts`

**Checkpoint**: US2 complete — `integration_started`/`integration_stopped` events carry full integration context.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [ ] T009 [P] Build backend to confirm no TypeScript errors: `npm run build --workspace=backend`
- [ ] T010 [P] Run backend tests to confirm no regressions: `npm run test --workspace=backend`
- [ ] T011 Commit all changes with message: `feat(telemetry): add integration status context to all events`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1** (Setup): No dependencies
- **Phase 2** (Foundational): Depends on Phase 1 read
- **Phase 3** (US1): Depends on Phase 2 (T002, T003 must be done before T004-T006)
- **Phase 4** (US2): Depends on Phase 3 (T004/T005 must be done so ordering is confirmed)
- **Phase 5** (Polish): Depends on US1 and US2 complete

### Within Each Story

- T002 before T003 (field before usage)
- T003 before T004/T005/T006 (merge logic before callers set status)
- T004 and T005 can run in parallel (different platforms, same file — different handler functions)
- T007 is read-only verification, can run any time after T003

### Parallel Opportunities

```bash
# T004 and T005 touch different route handlers in the same file — do sequentially
# T009 and T010 (build + test) can run in parallel after T008
```

---

## Implementation Strategy

### MVP (US1 only)

1. Phase 1: Read and confirm call sites
2. Phase 2: Add registry to TelemetryService
3. Phase 3: Wire up start/stop callers + server.ts initialization
4. **STOP and VALIDATE**: Check PostHog Live Events for integration properties

### Full Delivery

1. Complete MVP above
2. Phase 4: Verify US2 ordering and enrichment
3. Phase 5: Build, test, commit

---

## Notes

- `integration_started`/`integration_stopped` events (US2) are ALREADY implemented. The only risk is ordering: `setIntegrationStatus` must be called before `sendEvent` so the merge in T003 picks up the new state.
- No new `TelemetryEventType` values are needed — the `extra` Record already supports arbitrary boolean properties.
- `setIntegrationStatus` must be idempotent — calling it multiple times with the same value is safe.
- Do NOT add `teams_enabled`/`slack_enabled` as hardcoded fields — keep the registry generic (`Record<string, boolean>`) so future integrations (e.g., a third platform) get picked up automatically.
