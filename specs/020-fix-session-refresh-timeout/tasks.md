# Tasks: Fix Session Disappears After 30-Minute Inactivity

**Input**: Design documents from `/specs/020-fix-session-refresh-timeout/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/settings-api.md

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add the new config field and type changes that all subsequent work depends on.

- [ ] T001 Add `idleSessionThresholdMinutes: number` to `ArgusConfig` interface in `backend/src/models/index.ts`
- [ ] T002 Add `idleSessionThresholdMinutes: 60` to `DEFAULTS` in `backend/src/config/config-loader.ts`
- [ ] T003 Add `idleSessionThresholdMinutes: number` to `ArgusConfig` interface in `frontend/src/types.ts`

**Checkpoint**: Config shape updated in both workspaces — no behaviour change yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Extend the `session-monitor.test.ts` mock to include the new config field so all subsequent unit tests can compile and run.

**Note**: No new DB migration needed (status column already accepts `idle`).

- [ ] T004 Update `loadConfig` mock in `backend/tests/unit/session-monitor.test.ts` to include `idleSessionThresholdMinutes: 60` in the returned mock object

**Checkpoint**: Existing tests still pass after mock update.

---

## Phase 3: User Story 1 + 2 — Session Persists Through Idle Period & Accurate Status Distinction (Priority: P1)

**Goal**: Sessions with a live process are classified as `idle` instead of `ended` after JSONL inactivity; sessions with a dead process are correctly classified as `ended`; `idle` sessions restore to `active` when JSONL becomes fresh.

**Independent Test**: Seed a session in `active` status with a stale JSONL mtime but alive PID — after `reconcileClaudeCodeSessions` runs, the session must show `idle`. Seed a second session with a dead PID and stale mtime — it must show `ended`.

### Tests (write first, confirm failing before implementation)

- [ ] T005 [US1/US2] Add unit test to `backend/tests/unit/session-monitor.test.ts`: stale JSONL + alive PID → session status becomes `idle` (not `ended`)
- [ ] T006 [US1/US2] Add unit test to `backend/tests/unit/session-monitor.test.ts`: stale JSONL + dead PID → session status becomes `ended`
- [ ] T007 [US1/US2] Add unit test to `backend/tests/unit/session-monitor.test.ts`: stale JSONL + null PID → session status becomes `ended`
- [ ] T008 [US1/US2] Add unit test to `backend/tests/unit/session-monitor.test.ts`: fresh JSONL + alive PID → session status stays `active` (no change)
- [ ] T009 [US1/US2] Add unit test to `backend/tests/unit/session-monitor.test.ts`: missing JSONL + alive PID → session status becomes `ended`
- [ ] T010 [US1/US2] Add unit test to `backend/tests/unit/session-monitor.test.ts`: `idle` session with fresh JSONL (restored activity) → status becomes `active`
- [ ] T011 [US1/US2] Add unit test to `backend/tests/unit/session-monitor.test.ts`: startup `reconcileStaleSessions` — `idle` session with dead PID → status becomes `ended`
- [ ] T012 [US1/US2] Add unit test to `backend/tests/unit/session-monitor.test.ts`: startup `reconcileStaleSessions` — `idle` session with alive PID → status unchanged (`idle`)
- [ ] T013 [US1/US2] Add unit test to `backend/tests/unit/session-monitor.test.ts`: `session.updated` event is emitted (not `session.ended`) when transitioning `active → idle`
- [ ] T014 [US1/US2] Add unit test to `backend/tests/unit/session-monitor.test.ts`: threshold is read from config dynamically — changing mock config value changes behaviour

### Implementation

- [ ] T015 [US1/US2] Rewrite `reconcileClaudeCodeSessions` in `backend/src/services/session-monitor.ts`:
  - Query sessions WHERE status IN (`active`, `idle`) AND type = `claude-code`
  - For each session: get JSONL mtime; if fresh and status is `idle` → restore to `active`, emit `session.updated`; if stale and PID alive → set `idle`, emit `session.updated`; if stale and PID dead/null → set `ended`, close watcher, emit `session.ended`; if file missing → set `ended` regardless of PID
  - Read threshold from `loadConfig().idleSessionThresholdMinutes * 60_000` (not from `ACTIVE_JSONL_THRESHOLD_MS` constant)
  - Emit structured log on every status transition: `{ sessionId, fromStatus, toStatus, reason }`
- [ ] T016 [US1/US2] Update `reconcileStaleSessions` in `backend/src/services/session-monitor.ts` to also query `idle` sessions and mark those with dead PIDs as `ended`

**Checkpoint**: All T005–T014 tests pass. Sessions no longer disappear after 30 minutes of JSONL inactivity when the process is still running.

---

## Phase 4: User Story 3 — Configurable Idle Threshold (Priority: P2)

**Goal**: The idle threshold is configurable via a settings API and defaults to 60 minutes.

**Independent Test**: Call `PATCH /api/v1/settings` with `{ "idleSessionThresholdMinutes": 45 }`. Verify `GET /api/v1/settings` returns the updated value. Verify that the reconciliation cycle uses the new threshold.

### Tests (write first, confirm failing before implementation)

- [ ] T017 [P] [US3] Add contract test in `backend/tests/contract/settings.test.ts`: `GET /api/v1/settings` returns 200 with `idleSessionThresholdMinutes: 60`
- [ ] T018 [P] [US3] Add contract test in `backend/tests/contract/settings.test.ts`: `PATCH /api/v1/settings` with `{ idleSessionThresholdMinutes: 45 }` returns 200 with updated value
- [ ] T019 [P] [US3] Add contract test in `backend/tests/contract/settings.test.ts`: `PATCH` with `idleSessionThresholdMinutes: 0` returns 400 `INVALID_CONFIG`
- [ ] T020 [P] [US3] Add contract test in `backend/tests/contract/settings.test.ts`: `PATCH` with `idleSessionThresholdMinutes: -5` returns 400 `INVALID_CONFIG`
- [ ] T021 [P] [US3] Add contract test in `backend/tests/contract/settings.test.ts`: `PATCH` with unknown field returns 200 and unknown field is not persisted

### Implementation

- [ ] T022 [US3] Create `backend/src/api/routes/settings.ts` with `GET /api/v1/settings` (calls `loadConfig()`) and `PATCH /api/v1/settings` (validates, merges, calls `saveConfig()`)
- [ ] T023 [US3] Register settings route in `backend/src/api/server.ts`

**Checkpoint**: All T017–T021 tests pass. `GET /api/v1/settings` and `PATCH /api/v1/settings` work correctly.

---

## Phase 5: Frontend — Idle Indicator & sessionUtils Fix

**Goal**: `idle` sessions are never hidden by `hideEndedSessions` or the time-based `isInactive` filter; an "Idle" badge is shown.

**Independent Test**: Set a session's status to `idle` in test state. Verify `isInactive(session)` returns `false`. Verify the session is visible on the dashboard with an "Idle" badge even when `hideEndedSessions` is enabled.

### Tests (write first, confirm failing before implementation)

- [ ] T024 [P] Add unit test verifying `isInactive({ status: 'idle', lastActivityAt: <old> })` returns `false` — find or create test file in `frontend/__tests__/`

### Implementation

- [ ] T025 [P] Update `isInactive` in `frontend/src/utils/sessionUtils.ts`: add `|| session.status === 'idle'` to the early-return guard (alongside `completed` and `ended`)
- [ ] T026 Locate the session status badge component (search for where `resting` or status badges are rendered in `frontend/src/`); add an "Idle" badge rendered when `session.status === 'idle'`

**Checkpoint**: T024 passes. Idle sessions are visible and badged correctly.

---

## Phase 6: Polish and Cross-Cutting

**Purpose**: Documentation, build verification, full test run.

- [ ] T027 Update `README.md`: document the new `idle` session status, the 60-minute default threshold, and the `idleSessionThresholdMinutes` config field
- [ ] T028 Run full test suite: `npm run test --workspace=backend` and `npm run test --workspace=frontend` — all tests must pass
- [ ] T029 Run frontend build: `npm run build --workspace=frontend` — must succeed with no errors
- [ ] T030 Remove or correct the stale comment `// T092: idle status no longer exists for Claude Code` in `backend/tests/unit/session-monitor.test.ts`

---

## Dependencies & Execution Order

- **Phase 1** (T001–T003): No dependencies, can start immediately. T001–T003 can run in parallel.
- **Phase 2** (T004): Depends on Phase 1 (needs the updated mock type).
- **Phase 3** (T005–T016): Depends on Phase 2. Tests T005–T014 written first, then T015–T016.
- **Phase 4** (T017–T023): Depends on Phase 1 (config shape). Can start after Phase 1 (independent of Phase 3).
- **Phase 5** (T024–T026): Depends on Phase 1 (types). Can start after Phase 1 (independent of Phases 3–4).
- **Phase 6** (T027–T030): Depends on all prior phases complete.
