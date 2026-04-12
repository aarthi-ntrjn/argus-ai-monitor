# Tasks: Configurable Resting Duration

**Branch**: `026-configurable-resting`
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

---

## Phase 1: Setup

**Goal**: Extend the settings type and update the core utility function signature. No behaviour change yet.

- [x] T001 [P1] Extend `DashboardSettings` interface in `frontend/src/types.ts` to add `restingThresholdMinutes: number` and set its default to `20` in `DEFAULT_SETTINGS`.
- [x] T002 [P1] Update `isInactive` in `frontend/src/utils/sessionUtils.ts` to accept an optional second parameter `thresholdMs?: number` (defaulting to `INACTIVE_THRESHOLD_MS`) and use it instead of the constant directly.

---

## Phase 2: Foundational (tests first -- CRITICAL gate)

**Goal**: Write failing tests for the type extension and updated function before any callers change.

**Independent test criteria**: `npm test` in the frontend passes with the new test cases; existing tests remain green.

- [x] T003 [P2] Update `frontend/src/__tests__/sessionUtils.test.ts`: add test cases that pass an explicit `thresholdMs` to `isInactive` (shorter and longer than default) and verify correct resting classification.
- [x] T004 [P2] Update `frontend/src/__tests__/useSettings.test.ts`: add a test that verifies `restingThresholdMinutes` defaults to `20` when no stored value exists, and that it persists when updated.

*Confirm tests are red for T003/T004, then implement T001/T002, then confirm green.*

---

## Phase 3: US1 - Set Custom Resting Threshold

**Goal**: The `SettingsPanel` renders a number input for the threshold; callers respect the configured value.

**Independent test criteria**: Changing the threshold in the settings panel updates the "resting" classification for sessions with matching last-activity times.

### Test tasks (write first)

- [x] T005 [P3] [US1] Update `frontend/src/__tests__/SettingsPanel.test.tsx`: add tests for:
  - threshold input renders with current value from `settings.restingThresholdMinutes`
  - changing the value to a valid number calls `onUpdateThreshold` with the parsed integer
  - invalid inputs (0, negative, >1440, non-numeric, empty) show an inline error and do NOT call `onUpdateThreshold`
  - the "Hide inactive sessions" label text includes the current threshold value

### Implementation tasks

- [x] T006 [P3] [US1] [P] Update `frontend/src/components/SettingsPanel/SettingsPanel.tsx`:
  - Add `onUpdateThreshold?: (minutes: number) => void` to `SettingsPanelProps`
  - Add local state `inputValue` (string) initialised from `settings.restingThresholdMinutes`
  - Add local state `inputError` (string | null)
  - Render a number input below "Hide inactive sessions" checkbox (label: "Resting after")
  - Validate on blur: reject outside 1-1440, non-numeric, empty; call `onUpdateThreshold` on valid commit
  - Update the "Hide inactive sessions" checkbox label to show `settings.restingThresholdMinutes` instead of hardcoded 20
- [x] T007 [P3] [US1] [P] Update `frontend/src/pages/DashboardPage.tsx`:
  - Pass `onUpdateThreshold={(m) => updateSetting('restingThresholdMinutes', m)}` to `SettingsPanel`
  - Pass `settings.restingThresholdMinutes * 60_000` as second arg to `isInactive` in the filter callback
- [x] T008 [P3] [US1] [P] Update `frontend/src/components/SessionCard/SessionCard.tsx`:
  - Call `useSettings()` to get `restingThresholdMinutes`
  - Pass `restingThresholdMinutes * 60_000` to `isInactive(session, ...)`
- [x] T009 [P3] [US1] [P] Update `frontend/src/components/SessionMetaRow/SessionMetaRow.tsx`:
  - Call `useSettings()` to get `restingThresholdMinutes`
  - Pass `restingThresholdMinutes * 60_000` to `isInactive(session, ...)`

---

## Phase 4: US2 - Reset to Default

**Goal**: A "Reset to default" button in the threshold control restores 20 minutes.

**Independent test criteria**: Clicking reset sets the input to 20, clears any error, and calls `onUpdateThreshold(20)`.

### Test tasks (write first)

- [x] T010 [P4] [US2] Add tests in `frontend/src/__tests__/SettingsPanel.test.tsx`:
  - Reset button is rendered next to the threshold input
  - Clicking reset calls `onUpdateThreshold(20)` and sets the input value back to "20"
  - Clicking reset clears any existing validation error

### Implementation tasks

- [x] T011 [P4] [US2] Update `frontend/src/components/SettingsPanel/SettingsPanel.tsx`:
  - Add a "Reset" button (small, inline) next to the threshold input
  - On click: set `inputValue` to "20", clear `inputError`, call `onUpdateThreshold?.(20)`

---

## Phase 5: E2E and Polish

**Goal**: End-to-end test coverage; README update; build verification.

- [x] T012 [P5] Write `frontend/tests/e2e/sc-026-resting-threshold.spec.ts` with mocked API:
  - Opening the settings panel shows a threshold input with value 20
  - Changing the value to 5 and blurring calls through to the displayed label ("Hide inactive sessions (>5 min)")
  - Entering an invalid value (0) shows an error inline
  - Clicking Reset restores the input to 20
- [x] T013 [P5] Update `README.md`: document the new `restingThresholdMinutes` setting (what it controls, default, valid range, where to find it in the UI).
- [x] T014 [P5] Run `npm run build --workspace=frontend` and confirm zero errors.
- [x] T015 [P5] Run `npm test --workspace=frontend` (all unit tests pass) and `npm run test:e2e` (all e2e mock tests pass).
