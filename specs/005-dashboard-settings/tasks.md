# Tasks: Dashboard Settings

**Input**: Design documents from `/specs/005-dashboard-settings/`
**Prerequisites**: plan.md , spec.md , data-model.md , quickstart.md 

**Tests**: Included per IV Test-First (constitution NON-NEGOTIABLE).

**Organization**: Tasks are grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story (US1, US2, US3)

---

## Phase 1: Setup

**Purpose**: No new dependencies or project initialization needed. Create directory structure for new files.

- [X] T090 Create `frontend/src/components/SettingsPanel/` directory (empty  populated in Phase 5)
- [X] T091 Create `frontend/src/hooks/` directory if it does not already exist

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core type and hook that ALL user stories depend on.

** CRITICAL**: Phases 35 cannot begin until this phase is complete.

- [X] T092 Add `DashboardSettings` interface and `DEFAULT_SETTINGS` constant to `frontend/src/types.ts`: `{ hideEndedSessions: boolean }` with default `{ hideEndedSessions: false }`
- [X] T093 Create `frontend/src/hooks/useSettings.ts`  React hook that returns `[settings, updateSetting]`; state initialized from `DEFAULT_SETTINGS` only (no localStorage yet  that is US2); `updateSetting(key, value)` updates a single field

**Checkpoint**: `useSettings` is importable and returns correct defaults. Phases 35 can begin (in priority order or in parallel if multiple developers).

---

## Phase 3: User Story 1  Toggle Visibility of Ended Sessions (Priority: P1)  MVP

**Goal**: Sessions with status `completed` or `ended` are hidden from all repository cards when `hideEndedSessions` is `true`.

**Independent Test**: Pre-set `hideEndedSessions` to `true` via `useSettings` (or directly in test setup), verify ended sessions disappear from the card list; set back to `false`, verify they reappear.

### Tests for User Story 1

> **Write these tests FIRST  they must FAIL before implementation begins**

- [X] T094 [P] [US1] Write E2E test in `frontend/tests/e2e/sc-005-settings-filter.spec.ts`

### Implementation for User Story 1

- [X] T095 [US1] In `frontend/src/pages/DashboardPage.tsx`: import `useSettings` hook; derive `visibleSessions` by filtering `sessions`
- [X] T096 [US1] In `frontend/src/pages/DashboardPage.tsx`: add empty-state message inside each repository card when its filtered session list is empty

**Checkpoint**: Pre-setting `localStorage['argus:settings']` to `{"hideEndedSessions":true}` before page load hides ended sessions. US1 E2E test passes.

---

## Phase 4: User Story 2  Preference Persists Across Page Loads (Priority: P2)

**Goal**: The `hideEndedSessions` preference survives page reload. Stored under `argus:settings` (JSON) in `localStorage`. Falls back to default on corrupt/missing data.

**Independent Test**: Set `hideEndedSessions` to `true`, reload the page, verify ended sessions are still hidden without any user action.

### Tests for User Story 2

> **Write these tests FIRST  they must FAIL before implementation begins**

- [X] T097 [P] [US2] Add persistence E2E test to `frontend/tests/e2e/sc-005-settings-filter.spec.ts`

### Implementation for User Story 2

- [X] T098 [US2] Update `frontend/src/hooks/useSettings.ts` to read initial state from `localStorage['argus:settings']` and persist on every change

**Checkpoint**: Toggle setting, reload page, setting is restored. US2 E2E test passes.

---

## Phase 5: User Story 3  Settings Panel Discoverability (Priority: P3)

**Goal**: A gear icon () in the dashboard header opens a settings panel containing the "Hide ended sessions" toggle. The toggle reflects and controls `useSettings` state.

**Independent Test**: Open dashboard, click the gear icon, verify settings panel appears with "Hide ended sessions" toggle. Toggle it and verify the session list updates immediately.

### Tests for User Story 3

> **Write these tests FIRST  they must FAIL before implementation begins**

- [X] T099 [P] [US3] Add discoverability E2E test to `frontend/tests/e2e/sc-005-settings-filter.spec.ts`

### Implementation for User Story 3

- [X] T100 [P] [US3] Create `frontend/src/components/SettingsPanel/SettingsPanel.tsx`
- [X] T101 [P] [US3] Create `frontend/src/components/SettingsPanel/index.ts`
- [X] T102 [US3] Update `frontend/src/pages/DashboardPage.tsx`  add `settingsOpen` state, gear icon, SettingsPanel wiring

**Checkpoint**: All three user stories work end-to-end. E2E test sc-005 fully passes.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T103 Update `README.md`  add "Dashboard Settings" section
- [X] T104 [P] Run `cd frontend && npm run build` and confirm zero TypeScript errors
- [X] T105 [P] Run `npm test` from repo root and confirm all 49 backend tests still pass (no regressions)

---

## Phase 7: User Story 4 — Hide Repositories with No Active Sessions (Priority: P4)

**Goal**: When `hideReposWithNoActiveSessions` is `true`, repository cards with no sessions of status `active`, `idle`, `waiting`, or `error` are removed from the dashboard. Repos with zero sessions are also hidden. Filter is independent of the `hideEndedSessions` setting.

**Independent Test**: Register two repos — one with an active session, one with only completed sessions. Turn on "Hide repos with no active sessions". Verify only the repo with the active session is visible.

### Tests for User Story 4

> **Write these tests FIRST — they must FAIL before implementation begins**

- [X] T106 [P] [US4] Add E2E tests to `frontend/tests/e2e/sc-005-settings-filter.spec.ts`: mock two repos — `active-repo` (has `active` session) and `idle-repo` (has only `completed` session); pre-set `localStorage['argus:settings']` to `{"hideEndedSessions":false,"hideReposWithNoActiveSessions":true}`; assert `idle-repo` card is not visible; assert `active-repo` card is visible; add second test: with setting `false`, assert both repo cards are visible; add third test: all repos have only ended sessions + setting on → global empty-state message shown

### Implementation for User Story 4

- [X] T107 [P] [US4] Add `hideReposWithNoActiveSessions: boolean` field (default `false`) to `DashboardSettings` interface in `frontend/src/types.ts` and to `DEFAULT_SETTINGS` constant
- [X] T108 [US4] In `frontend/src/pages/DashboardPage.tsx`: define `ACTIVE_STATUSES = new Set(['active','idle','waiting','error'])`; after building `reposWithSessions`, when `settings.hideReposWithNoActiveSessions` is `true`, filter the array to only include repos where `sessions.some(s => ACTIVE_STATUSES.has(s.status))` using the **full** `sessions` list (not the already-filtered `visibleSessions`) — check against the raw `sessions` data query result per repo; update the global empty-state message to account for all repos being hidden by this filter
- [X] T109 [US4] In `frontend/src/components/SettingsPanel/SettingsPanel.tsx`: add a second toggle row labelled "Hide repos with no active sessions"; wire to `onToggle('hideReposWithNoActiveSessions', checked)`; place below the existing "Hide ended sessions" row

**Checkpoint**: "Hide repos with no active sessions" toggle works, persists (via existing `useSettings` localStorage mechanism), and E2E tests pass.

---

## Phase 8: Polish (US4)

- [X] T110 Update `README.md` — add `hideReposWithNoActiveSessions` row to the Dashboard Settings table
- [X] T111 [P] Run `cd frontend && npm run build` and confirm zero TypeScript errors
- [X] T112 [P] Run `npm test` from repo root and confirm all backend tests still pass

---



### Phase Dependencies

- **Setup (Phase 1)**: No dependencies  start immediately
- **Foundational (Phase 2)**: Depends on Phase 1  **BLOCKS all user stories**
- **User Story phases (35)**: All depend on Phase 2 completion; can run in priority order (P1  P2  P3)
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **US1 (P1)**: After Phase 2  no dependency on US2/US3
- **US2 (P2)**: After Phase 2  builds on `useSettings` from Phase 2; no dependency on US1/US3
- **US3 (P3)**: After Phase 2  depends on `useSettings` from Phase 2; references session filter from US1 for toggle test

### Within Each User Story

- E2E test MUST be written and confirmed failing before implementation
- `useSettings` (T093) before DashboardPage wiring (T095, T096, T098, T102)
- `SettingsPanel` component (T100) before DashboardPage wiring (T102)
- Implementation complete before checking off tasks

### Parallel Opportunities

- T094 (US1 E2E test) can be written while T095/T096 are being implemented
- T100 and T101 (SettingsPanel component + barrel) can run in parallel
- T104 and T105 (build + backend tests) can run in parallel

---

## Parallel Example: User Story 3

```
T099 [write E2E test for discoverability]
    (in parallel once T099 written)
T100 [SettingsPanel.tsx]    T101 [index.ts]
    both complete
T102 [wire into DashboardPage.tsx]
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (types + hook)
3. Complete Phase 3: US1  filter toggle via localStorage pre-set
4. **STOP and VALIDATE**: toggle works; E2E passes
5. No settings UI yet  acceptable MVP

### Incremental Delivery

1. Phase 2  Foundation ready
2. Phase 3 (US1)  Filter works; testable via direct localStorage writes
3. Phase 4 (US2)  Persistence works; setting survives reload
4. Phase 5 (US3)  Settings panel UI; user-accessible toggle
5. Phase 6  README + validation

---

## Notes

- "Ended" sessions: `status === 'completed' || status === 'ended'` (from `SessionStatus` in types.ts)
- localStorage key: `argus:settings` (JSON)  consolidated key for all future settings
- Existing key `argus:skipRemoveConfirm` is a separate preference and is unaffected
- `useSettings` is intentionally generic  adding a new setting requires only: new field in `DashboardSettings`, default in `DEFAULT_SETTINGS`, and a new row in `SettingsPanel`
- Commit after each phase checkpoint
