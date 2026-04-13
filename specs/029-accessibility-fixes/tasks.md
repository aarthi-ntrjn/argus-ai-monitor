# Tasks: Improve Add-Repository Dialog UX

**Input**: User description and codebase analysis
**Scope**: Replace the auto-dismissing success banner with in-dialog progress feedback when adding repositories.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

---

## Current Behavior (to change)

1. User clicks "Add Repository", folder input dialog opens.
2. User enters a path and submits.
3. Dialog closes immediately, dashboard shows "Adding..." on button.
4. After scan completes, a green banner appears on the dashboard: "Added X repositories".
5. Banner auto-dismisses after 5 seconds.

## Target Behavior

1. User clicks "Add Repository", folder input dialog opens.
2. User enters a path and submits.
3. Dialog stays open, shows a spinner while scanning/adding.
4. Dialog shows the result (repository count) inline.
5. User manually dismisses the dialog. No banner on the dashboard.

---

## Phase 1: Refactor Hook State (Foundational)

**Purpose**: Update the `useRepositoryManagement` hook so the dialog stays open during the scan, tracks scan progress/result internally, and never triggers the dashboard banner for success.

- [x] T001 [US1] Refactor `handleFolderSubmit` in `frontend/src/hooks/useRepositoryManagement.ts` to keep the dialog open during scanning: remove the `setShowFolderInput(false)` call at the start of the function, move it to a new explicit `dismissDialog` action instead
- [x] T002 [US1] Add new state fields to `useRepositoryManagement` in `frontend/src/hooks/useRepositoryManagement.ts`: `scanResult: { added: number; failed: number; total: number } | null` to hold the outcome of the last scan, and `scanning: boolean` to track the async scan phase separately from the `adding` flag
- [x] T003 [US1] Update `handleFolderSubmit` in `frontend/src/hooks/useRepositoryManagement.ts` to populate `scanResult` with `{ added, failed, total }` after the scan loop finishes, set `scanning = false`, and NOT call `showInfo` (remove the success banner trigger entirely)
- [x] T004 [US1] Expose `scanning`, `scanResult`, and a new `dismissDialog` function from the `useRepositoryManagement` hook return value and its `RepositoryManagement` interface in `frontend/src/hooks/useRepositoryManagement.ts`

**Checkpoint**: Hook API updated. Dialog state management is ready for the UI to consume.

---

## Phase 2: Update the Folder Input Dialog UI

**Purpose**: Transform the folder input dialog in DashboardPage into a stateful dialog that shows scanning progress, results, and lets the user dismiss manually.

- [x] T005 [US1] Update the folder input modal in `frontend/src/pages/DashboardPage.tsx` to show three states: (a) input form (current), (b) scanning spinner with "Scanning..." text while `scanning` is true, (c) result summary showing "Added X repositories" (and failures if any) when `scanResult` is populated
- [x] T006 [P] [US1] In the scanning state (b) in `frontend/src/pages/DashboardPage.tsx`, disable the input and submit button, and display an animated spinner (reuse the Tailwind `animate-spin` SVG pattern already used in KillSessionDialog)
- [x] T007 [P] [US1] In the result state (c) in `frontend/src/pages/DashboardPage.tsx`, display the repository count (`scanResult.added` added, `scanResult.failed` failed if > 0), a success/warning icon, and a "Done" button that calls `dismissDialog` to close the modal
- [x] T008 [US1] Remove the `addInfo` success banner from `frontend/src/pages/DashboardPage.tsx` (lines currently rendering the green `role="status"` div). Keep the `addError` banner for non-scan errors (e.g., network failures before the dialog opens).
- [x] T009 [US1] Show scan errors inside the dialog instead of on the dashboard: when `addError` is set during a scan, display it within the modal body in `frontend/src/pages/DashboardPage.tsx` rather than closing the dialog. Add a "Try Again" button that resets to the input state, and a "Close" button.

**Checkpoint**: The dialog now shows scanning progress and results inline. The dashboard no longer shows success banners.

---

## Phase 3: Cleanup and Edge Cases

**Purpose**: Remove dead code, handle edge cases, ensure accessibility.

- [x] T010 [P] [US1] Remove the `showInfo` helper function, the `addInfo` state, and the `clearAddInfo` function from `frontend/src/hooks/useRepositoryManagement.ts` since the success banner is no longer used
- [x] T011 [P] [US1] Remove `addInfo` and `clearAddInfo` from the destructured values in `frontend/src/pages/DashboardPage.tsx` and verify no other component references them
- [x] T012 [US1] Ensure the dialog in `frontend/src/pages/DashboardPage.tsx` has correct accessibility: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, and that the spinner state has a `role="status"` with `aria-live="polite"` for screen readers
- [x] T013 [US1] Handle the Escape key in the folder dialog in `frontend/src/pages/DashboardPage.tsx`: allow Escape to close during input and result states, but NOT during the scanning state (to prevent accidental dismissal while scan is in progress)
- [x] T014 [US1] Run `npm run build --workspace=frontend` to verify TypeScript compilation and then run frontend tests with `npx vitest run` in the frontend directory to ensure no regressions

**Checkpoint**: All dead code removed, edge cases handled, build and tests pass.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Hook Refactor)**: No dependencies, start immediately
- **Phase 2 (Dialog UI)**: Depends on Phase 1 completion (needs new hook API)
- **Phase 3 (Cleanup)**: Depends on Phase 2 completion

### Within Phase 2

- T005 must come first (establishes the three-state structure)
- T006 and T007 can run in parallel (different states within the dialog)
- T008 and T009 depend on T005 (modify the same dialog area)

### Parallel Opportunities

- T006 and T007 can run in parallel (different dialog states, different UI branches)
- T010 and T011 can run in parallel (hook cleanup vs. page cleanup, different files)

---

## Implementation Strategy

### MVP (All tasks are one user story)

1. Complete Phase 1: T001-T004 (hook refactor)
2. Complete Phase 2: T005-T009 (dialog UI)
3. Complete Phase 3: T010-T014 (cleanup, a11y, validation)
4. Build and test

### Key Files Modified

- `frontend/src/hooks/useRepositoryManagement.ts` (T001-T004, T010)
- `frontend/src/pages/DashboardPage.tsx` (T005-T009, T011-T013)

---

## Notes

- All tasks belong to a single user story (US1) since this is a focused UX improvement
- No backend changes required; the API (scanFolder, addRepository) is unchanged
- The `addError` dashboard banner is kept for non-dialog errors, only the success `addInfo` banner is removed
- 14 tasks total, all in one user story
