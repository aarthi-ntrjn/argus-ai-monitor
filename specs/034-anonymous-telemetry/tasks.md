# Tasks: Anonymous Usage Telemetry

**Branch**: `034-anonymous-telemetry` | **Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

---

## Phase 1: Setup — Config + Environment

**Goal**: Add telemetry fields to config model and expose env placeholders. No behaviour changes yet.

- [ ] T001 [P] Add `telemetryEnabled: boolean` (default `true`) and `telemetryPromptSeen: boolean` (default `false`) to `ArgusConfig` interface in `backend/src/models/index.ts`
- [ ] T002 [P] Add `telemetryEnabled: true` and `telemetryPromptSeen: false` to `DEFAULTS` in `backend/src/config/config-loader.ts`
- [ ] T003 [P] Add `telemetryEnabled` and `telemetryPromptSeen` to `ALLOWED_KEYS` in `backend/src/api/routes/settings.ts`
- [ ] T004 [P] Add `TELEMETRY_URL` and `TELEMETRY_API_KEY` entries to `.env.example` with placeholder values and inline comments explaining their purpose

---

## Phase 2: Foundational — TelemetryService (test-first)

**Goal**: Working telemetry service and relay endpoint with full test coverage before any instrumentation.

**Independent test**: Run `vitest run` — all telemetry tests pass. Relay endpoint returns 204 on valid request.

### Tests (write first — must be failing before Phase 2 implementation tasks run)

- [ ] T005 Write `backend/tests/unit/telemetry-service.test.ts`:
  - Installation ID is created and persisted when `~/.argus/telemetry-id` does not exist
  - Re-reading returns the same ID (idempotent)
  - Corrupt/empty file triggers regeneration
  - `readAppVersion()` returns a non-empty string
  - `sendEvent()` returns immediately without awaiting network
  - `sendEvent()` is a no-op when `TELEMETRY_URL` is empty
  - No exception propagates when fetch throws

- [ ] T006 Write `backend/tests/contract/telemetry.test.ts`:
  - `POST /api/v1/telemetry/event` with valid type returns 204
  - `POST /api/v1/telemetry/event` with unknown type returns 400 `{ error: "INVALID_EVENT_TYPE" }`
  - `POST /api/v1/telemetry/event` when `telemetryEnabled: false` returns 503 `{ error: "TELEMETRY_DISABLED" }`
  - `GET /api/v1/settings` returns `telemetryEnabled` and `telemetryPromptSeen` fields
  - `PATCH /api/v1/settings` updates `telemetryEnabled` and persists it

### Implementation

- [ ] T007 Create `backend/src/services/telemetry-service.ts`:
  - `loadOrCreateInstallationId(): string` — reads `~/.argus/telemetry-id`; generates UUID v4 if absent or corrupt; structured log on creation
  - `readAppVersion(): string` — reads `version` from `backend/package.json`; fallback `"unknown"`
  - `sendEvent(type: TelemetryEventType, extra?: Record<string, string>): void` — fire-and-forget POST to PostHog capture API with `AbortSignal.timeout(2000)`; structured log on dispatch attempt; silently swallows all errors; no-op if `TELEMETRY_URL` env var is empty
  - Export a singleton `telemetryService` instance

- [ ] T008 Add `TelemetryEventType` enum/union and `TelemetryEvent` interface to `backend/src/models/index.ts`

- [ ] T009 Create `backend/src/api/routes/telemetry.ts` — `POST /api/v1/telemetry/event` per `contracts/telemetry-relay-api.md`: validate type, check `telemetryEnabled`, call `telemetryService.sendEvent()`, return 204

- [ ] T010 Register telemetry route in `backend/src/server.ts`

---

## Phase 3: US1 — Passive Usage Reporting

**Goal**: All server-observable events are instrumented and dispatched.

**Independent test**: Start Argus, start a session, send a prompt, stop it — verify PostHog Live Events (or intercepted network calls in tests) shows `app_started`, `session_started`, `prompt_sent`, `session_stopped`, `session_ended`.

- [ ] T011 Instrument `app_started` in `backend/src/server.ts` — call `telemetryService.sendEvent('app_started')` after `await app.ready()`
- [ ] T012 [P] Instrument `session_started` in `backend/src/services/session-monitor.ts` — call `telemetryService.sendEvent('session_started', { sessionType: session.type })` when a new session row is first inserted
- [ ] T013 [P] Instrument `session_ended` in `backend/src/services/session-monitor.ts` — call `telemetryService.sendEvent('session_ended')` when session status transitions to `ended` or `completed`
- [ ] T014 [P] Instrument `prompt_sent` in `backend/src/services/session-controller.ts` — call `telemetryService.sendEvent('prompt_sent')` after a `send_prompt` action is dispatched
- [ ] T015 [P] Instrument `session_stopped` in `backend/src/services/session-controller.ts` — call `telemetryService.sendEvent('session_stopped')` after a `stop` action completes

---

## Phase 4: US2 — Opt-Out Control (Frontend)

**Goal**: First-launch banner and permanent Settings toggle wired to backend preference.

**Independent test**: Fresh config (no `telemetryPromptSeen`): banner appears. Dismiss with toggle off: no subsequent events. Settings panel shows toggle reflecting current state.

- [ ] T016 Create `frontend/src/components/TelemetryBanner/TelemetryBanner.tsx`:
  - Non-blocking banner (not a modal) shown when `telemetryPromptSeen === false`
  - Contains a `<Checkbox>` toggle (default checked = enabled) and a `<Button variant="primary" size="sm">Got it</Button>`
  - On dismiss: calls `PATCH /api/v1/settings { telemetryEnabled: <choice>, telemetryPromptSeen: true }` then hides

- [ ] T017 Create `frontend/src/components/TelemetryBanner/index.ts` — re-export `TelemetryBanner`

- [ ] T018 Mount `<TelemetryBanner>` in `frontend/src/pages/DashboardPage.tsx` — render when `argusSettings?.telemetryPromptSeen === false`

- [ ] T019 Add telemetry section to `frontend/src/components/SettingsPanel/SettingsPanel.tsx`:
  - New section below existing toggles with heading "Privacy"
  - `<Checkbox label="Send anonymous usage telemetry" checked={argusSettings?.telemetryEnabled ?? true} onChange={...}>` calling `patchSetting({ telemetryEnabled })`

- [ ] T020 Call relay endpoint for `compare_view_opened` — in `frontend/src/components/RepoCard/RepoCard.tsx`, call `POST /api/v1/telemetry/event { type: 'compare_view_opened' }` when the compare link is clicked (only if `telemetryEnabled`)

---

## Phase 5: US3 — Resilience

**Goal**: Confirm telemetry never blocks or errors when the endpoint is unavailable.

**Independent test**: Set `TELEMETRY_URL` to an unreachable address; run Argus through all event types; confirm zero errors in UI and all operations complete normally.

- [ ] T021 Add resilience tests to `backend/tests/unit/telemetry-service.test.ts`:
  - `sendEvent()` with a non-routable URL completes without throwing (timeout behaviour)
  - `sendEvent()` with a URL that returns 500 does not throw
  - Calling `sendEvent()` 100 times in rapid succession does not block or accumulate memory

---

## Phase 6: Polish + README

**Goal**: Satisfy §X Definition of Done and §XI Documentation.

- [ ] T022 Update `README.md` — add "Telemetry" section: what events are collected, how to disable (`telemetryEnabled: false` in settings or banner), and that no PII is collected
- [ ] T023 [P] Run full backend test suite (`npm run test --workspace=backend`) — all tests pass
- [ ] T024 [P] Run frontend build (`npm run build --workspace=frontend`) — build succeeds with no TypeScript errors
