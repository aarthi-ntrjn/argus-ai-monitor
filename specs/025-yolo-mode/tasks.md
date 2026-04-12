# Tasks: 025-yolo-mode

**Input**: Design documents from `/specs/025-yolo-mode/`
**Prerequisites**: plan.md, spec.md, research.md

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No new files or dependencies required. This feature extends existing code only.

- [x] T001 Verify existing test runner passes with `npm test --workspace=backend` and `npm test --workspace=frontend` (baseline health check)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Add `yoloMode` to the shared type contract and backend config defaults. All user story work depends on this.

**CRITICAL**: No user story work can begin until this phase is complete.

- [x] T002 Add `yoloMode: boolean` to `ArgusConfig` interface in `backend/src/models/index.ts`
- [x] T003 [P] Add `yoloMode: boolean` to `ArgusConfig` interface in `frontend/src/types.ts`
- [x] T004 Add `yoloMode: false` to `DEFAULTS` in `backend/src/config/config-loader.ts`
- [x] T005 Add `'yoloMode'` to `ALLOWED_KEYS` set in `backend/src/api/routes/settings.ts`

**Checkpoint**: `ArgusConfig` has `yoloMode` in both backend model and frontend types; PATCH settings accepts `yoloMode`.

---

## Phase 3: User Story 1 - Enable Yolo Mode with Warning (Priority: P1)

**Goal**: When yolo mode is enabled (after confirming warning), all launch commands include the appropriate bypass flag.

**Independent Test**: Enable yolo mode via settings API, then call GET /api/v1/tools and POST /api/v1/sessions/launch-terminal. Verify the correct flags appear. On frontend, toggle yolo mode on, confirm dialog, verify commands include flags.

### Tests for User Story 1 (write first, confirm failing before implementing)

- [x] T006 [US1] Write backend contract tests for `yoloMode` in `backend/tests/contract/settings.test.ts`:
  - `GET /api/v1/settings` returns `yoloMode: false` by default
  - `PATCH /api/v1/settings` with `{ yoloMode: true }` returns `yoloMode: true`
  - `GET /api/v1/settings` after PATCH reflects `yoloMode: true`
- [x] T007 [US1] Create `backend/tests/contract/tools.test.ts` with flag injection tests:
  - When yoloMode is false: `claudeCmd` and `copilotCmd` do NOT contain yolo flags
  - When yoloMode is true: `claudeCmd` contains `--dangerously-skip-permissions`
  - When yoloMode is true: `copilotCmd` contains `--allow-all`
  - When yoloMode is true: `POST /api/v1/sessions/launch-terminal` opens terminal with yolo flag in command
- [x] T008 [P] [US1] Create `frontend/src/__tests__/YoloWarningDialog.test.tsx`:
  - Dialog renders when `open=true`
  - Dialog does not render when `open=false`
  - Clicking confirm calls `onConfirm`
  - Clicking cancel calls `onCancel`
  - Dialog text mentions bypassing permission checks
- [x] T009 [P] [US1] Extend `frontend/src/__tests__/SettingsPanel.test.tsx` with yolo mode tests:
  - Renders yolo mode checkbox
  - Clicking yolo mode checkbox (off to on) opens warning dialog (mock `getArgusSettings`, `patchArgusSettings`)
  - Confirming dialog calls `patchArgusSettings` with `{ yoloMode: true }`
  - Cancelling dialog does NOT call `patchArgusSettings` and toggle stays off

### Implementation for User Story 1

- [x] T010 [US1] Add `YOLO_FLAGS` constant and update `buildLaunchCmdBase(tool, yoloMode)` signature in `backend/src/api/routes/tools.ts`; load config in both route handlers and pass `yoloMode`
- [x] T011 [P] [US1] Create `frontend/src/hooks/useArgusSettings.ts` with `useQuery`/`useMutation` for `getArgusSettings` / `patchArgusSettings`
- [x] T012 [US1] Create `frontend/src/components/YoloWarningDialog/YoloWarningDialog.tsx` with confirm/cancel buttons and risk-explanation text
- [x] T013 [US1] Add yolo mode toggle to `frontend/src/components/SettingsPanel/SettingsPanel.tsx`: use `useArgusSettings` hook, intercept enable toggle to show `YoloWarningDialog`, save on confirm, revert on cancel

**Checkpoint**: Yolo mode can be enabled from settings panel with warning confirmation. `GET /api/v1/tools` and `POST /api/v1/sessions/launch-terminal` return/use commands with yolo flags.

---

## Phase 4: User Story 2 - Disable Yolo Mode (Priority: P2)

**Goal**: Disabling yolo mode requires no confirmation and immediately removes flags from subsequent launches.

**Independent Test**: With yolo mode on, disable it via settings panel (no dialog should appear), then verify `GET /api/v1/tools` commands no longer contain yolo flags.

### Tests for User Story 2 (write first, confirm failing before implementing)

- [x] T014 [US2] Extend `frontend/src/__tests__/SettingsPanel.test.tsx`:
  - When yolo mode is on and user toggles it off, `patchArgusSettings` is called with `{ yoloMode: false }` and NO warning dialog appears
- [x] T015 [US2] Extend `backend/tests/contract/tools.test.ts`:
  - After disabling yolo mode (PATCH `yoloMode: false`), `GET /api/v1/tools` commands no longer contain yolo flags

### Implementation for User Story 2

The toggle-off path through `SettingsPanel` does not show the dialog and directly calls `patchArgusSettings({ yoloMode: false })`. This is implemented in T013. Verify the conditional path is correct and add no-dialog assertion to tests.

- [x] T016 [US2] Verify `SettingsPanel.tsx` toggle-off path skips dialog and calls `patchArgusSettings({ yoloMode: false })` directly (review T013 output; adjust if needed)

**Checkpoint**: Toggle off requires no confirmation; commands revert to standard form.

---

## Phase 5: User Story 3 - Yolo Mode Status Visibility (Priority: P3)

**Goal**: The settings panel shows a visible risk label when yolo mode is on.

**Independent Test**: Render `SettingsPanel` with `yoloMode: true` from backend settings; verify a warning label text is visible next to the yolo mode toggle.

### Tests for User Story 3 (write first, confirm failing before implementing)

- [x] T017 [US3] Extend `frontend/src/__tests__/SettingsPanel.test.tsx`:
  - When yolo mode is on (backend returns `yoloMode: true`), a warning/risk label text is visible
  - When yolo mode is off, no warning label is visible

### Implementation for User Story 3

- [x] T018 [US3] Add conditional warning label (e.g., yellow text "All permission checks disabled") next to the yolo mode toggle in `SettingsPanel.tsx` (only rendered when `yoloMode === true`)

**Checkpoint**: All three user stories are independently functional.

---

## Phase 6: Polish and Cross-Cutting Concerns

**Purpose**: Observability, build verification, documentation.

- [x] T019 Add structured log line in `backend/src/cli/launch.ts` at PTY spawn: log `yoloMode` flag presence from `cmdArgs` (no config read needed here; the flag is already in `cmdArgs` if enabled)
- [x] T020 Run `npm test --workspace=backend` and confirm all tests pass
- [x] T021 Run `npm test --workspace=frontend` and confirm all tests pass
- [x] T022 Run `npm run build --workspace=frontend` and confirm clean build
- [x] T023 Update `README.md`: document `yoloMode` setting with description, how to enable it, and the flags it adds
- [x] T024 Commit all changes with message `feat(025): implement yolo-mode`

**Checkpoint**: Original yolo mode setting feature is complete.

---

## Phase 7: Foundational - Per-Session Yolo Mode Tracking (Blocking Prerequisites)

**Purpose**: Extend the Session model with a `yoloMode` field so each session records whether it was launched with yolo flags. This is the foundation for showing a per-session yolo mode icon in the UI.

**CRITICAL**: All yolo-icon user story work (Phases 8, 9) depends on this phase.

**Detection Method Research** (see research.md decision #6):
- **Primary**: Store `yoloMode` per session in the database at launch time via the WebSocket `RegisterMessage`.
- **Secondary**: For detected (non-PTY) sessions, default to `false` since yolo flags can only be injected via Argus launch.
- **Rejected methods**: Process command line inspection (only works for running sessions, OS-specific), Claude/Copilot config files (do not track permission mode), environment variables (fragile, stripped for Claude Code).

- [ ] T025 Add `yoloMode: boolean` field to `Session` interface in `backend/src/models/index.ts`
- [ ] T026 [P] Add `yoloMode: boolean` field to `Session` interface in `frontend/src/types.ts`
- [ ] T027 Add runtime migration for `yolo_mode` column in `backend/src/db/database.ts`: `ALTER TABLE sessions ADD COLUMN yolo_mode INTEGER NOT NULL DEFAULT 0`
- [ ] T028 Update `upsertSession()` in `backend/src/db/database.ts` to include `yolo_mode` in INSERT and ON CONFLICT UPDATE clauses
- [ ] T029 [P] Update `getSessions()` and `getSession()` in `backend/src/db/database.ts` to SELECT `yolo_mode as yoloMode` and map the integer to boolean (same pattern as `reconciled`)

**Checkpoint**: Session model has `yoloMode` field end-to-end (TypeScript interfaces, DB column, CRUD operations). No sessions populate it yet.

---

## Phase 8: User Story 4 - Track Yolo Mode Per Session at Launch (Priority: P1)

**Goal**: When a session is launched via Argus with yolo mode enabled, the session record stores `yoloMode: true`. Detected (non-PTY) sessions default to `yoloMode: false`.

**Independent Test**: Enable yolo mode in settings, launch a session via PTY, verify `GET /api/v1/sessions/:id` returns `yoloMode: true`. Disable yolo mode, launch another session, verify it returns `yoloMode: false`.

### Implementation for User Story 4

- [ ] T030 [US4] Add `yoloMode: boolean` field to `RegisterMessage` interface in `backend/src/api/routes/launcher.ts` (line 17-24)
- [ ] T031 [US4] Add `yoloMode: boolean` field to `PendingLauncher` interface in `backend/src/services/pty-registry.ts` (line 14-19)
- [ ] T032 [US4] Update `registerPending()` in `backend/src/services/pty-registry.ts` to accept and store `yoloMode` parameter
- [ ] T033 [US4] Update `claimForSession()` and `claimByTempId()` in `backend/src/services/pty-registry.ts` to return `yoloMode` in the result object
- [ ] T034 [US4] Update `launch.ts` WebSocket register message (in `backend/src/cli/launch.ts`) to include `yoloMode: yoloActive` (the `yoloActive` variable already exists at line 46)
- [ ] T035 [US4] Update launcher WebSocket handler in `backend/src/api/routes/launcher.ts` to pass `msg.yoloMode` when calling `ptyRegistry.registerPending()`
- [ ] T036 [US4] Update Claude Code session creation in `backend/src/services/claude-code-detector.ts`: when claiming a PTY connection, read `yoloMode` from the claim result and set it on the Session object
- [ ] T037 [P] [US4] Update Copilot CLI session creation in `backend/src/services/copilot-cli-detector.ts`: when claiming a PTY connection, read `yoloMode` from the claim result and set it on the Session object
- [ ] T038 [US4] For detected (non-PTY) sessions in both detectors, set `yoloMode: false` as the default

**Checkpoint**: PTY-launched sessions have `yoloMode` correctly recorded. API returns the field. Detected sessions default to `false`.

---

## Phase 9: User Story 5 - Display Yolo Mode Icon on Session Cards (Priority: P1)

**Goal**: Each session card in the frontend shows a visual indicator of whether that session was launched in yolo mode. Yolo sessions show a distinct icon (e.g., `ShieldOff` from Lucide React in red/amber) and non-yolo sessions show nothing (or a subtle `Shield` icon).

**Independent Test**: Render a SessionCard with `yoloMode: true`, verify the yolo icon/badge is visible. Render with `yoloMode: false`, verify no yolo icon is shown.

### Implementation for User Story 5

- [ ] T039 [US5] Add yolo mode badge to `frontend/src/components/SessionCard/SessionCard.tsx`: when `session.yoloMode` is `true`, render an inline badge with a `ShieldOff` icon (from `lucide-react`) in red/amber styling (e.g., `bg-red-100 text-red-700`) with tooltip text "Launched in yolo mode" next to the existing launch mode badge
- [ ] T040 [P] [US5] Update `frontend/src/components/SessionDetail/SessionDetail.tsx` (or equivalent detail view) to show yolo mode status with a descriptive label when viewing a single session

**Checkpoint**: Sessions launched in yolo mode are visually distinguishable from normal sessions throughout the UI.

---

## Phase 10: Polish and Cross-Cutting Concerns

**Purpose**: Tests, build verification, documentation for the yolo-icon feature.

- [ ] T041 Run `npm test --workspace=backend` and confirm all tests pass
- [ ] T042 Run `npm test --workspace=frontend` and confirm all tests pass
- [ ] T043 Run `npm run build --workspace=frontend` and confirm clean build
- [ ] T044 Update `README.md`: document the per-session yolo mode indicator and how it works
- [ ] T045 Commit all changes with message `feat(025): add per-session yolo mode tracking and icon display`

---

## Dependencies and Execution Order

### Phases 1-6 (Original Yolo Mode Setting - COMPLETE)

- **Phase 1**: No dependencies.
- **Phase 2**: Depends on Phase 1. Blocks Phases 3, 4, 5.
- **Phase 3**: Depends on Phase 2. T008/T009/T011 can run in parallel with T006/T007. T012 depends on T008. T013 depends on T011 and T012.
- **Phase 4**: Depends on Phase 3 (T013 must exist before T016 can review it). T014/T015 are tests that can be written concurrently.
- **Phase 5**: Depends on Phase 3 (yolo toggle must exist before label can be added). T017 first, then T018.
- **Phase 6**: Depends on Phases 3, 4, 5 all complete.

### Phases 7-10 (Per-Session Yolo Mode Icon - NEW)

- **Phase 7**: Depends on Phase 6. Blocks Phases 8, 9.
- **Phase 8**: Depends on Phase 7. T036/T037 can run in parallel. T038 can run in parallel with T036/T037.
- **Phase 9**: Depends on Phase 8. T039/T040 can run in parallel.
- **Phase 10**: Depends on Phases 8, 9 all complete.

## Parallel Opportunities

### Original Feature (Phases 1-6)

- T002 and T003 (type additions to backend and frontend) can run in parallel.
- T008 and T009 (frontend tests) can be written in parallel with T006 and T007 (backend tests).
- T011 (`useArgusSettings` hook) can be written in parallel with T012 (`YoloWarningDialog` component).

### Per-Session Yolo Icon (Phases 7-10)

- T025 and T026 (Session type additions to backend and frontend) can run in parallel.
- T028 and T029 (DB CRUD updates) can run in parallel.
- T036 and T037 (Claude and Copilot detector updates) can run in parallel.
- T039 and T040 (SessionCard and SessionDetail UI updates) can run in parallel.
