# Tasks: Kill Session Button

**Input**: Design documents from `/specs/027-kill-session/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create shared components and hooks used by multiple user stories

- [x] T001 [P] Create `useKillSession` hook in `frontend/src/hooks/useKillSession.ts` that wraps `useMutation` calling `stopSession()`, exposes `isPending`, `isError`, `error`, `reset()`, dialog open/close state, and `targetSessionId`
- [x] T002 [P] Create `KillSessionDialog` component in `frontend/src/components/KillSessionDialog/KillSessionDialog.tsx` following the `YoloWarningDialog` pattern: modal overlay, session identification text, Cancel and Confirm buttons, loading state on confirm, error message display

---

## Phase 2: Foundational (Tests First)

**Purpose**: Write failing tests for all new components before implementation

**⚠️ CRITICAL**: Tests MUST be written and confirmed failing before Phase 3 implementation

- [x] T003 [P] Write unit tests for `useKillSession` hook in `frontend/src/__tests__/useKillSession.test.ts`: test mutation call, loading state, error state, dialog open/close, cache invalidation on success
- [x] T004 [P] Write unit tests for `KillSessionDialog` in `frontend/src/__tests__/KillSessionDialog.test.tsx`: test render when open/closed, confirm triggers callback, cancel triggers callback, loading disables confirm button, error message display, session info shown, accessibility attributes
- [x] T005 [P] Write unit tests for kill button in `SessionMetaRow` in `frontend/src/__tests__/SessionMetaRow.test.tsx`: test button renders when `onKill` provided and session is killable, button hidden when no PID, button hidden when session ended/completed, button click triggers `onKill`

**Checkpoint**: All tests written and failing (Red phase)

---

## Phase 3: User Story 1 - Kill from Dashboard (Priority: P1) 🎯 MVP

**Goal**: Users can kill an active session directly from the dashboard session card with a confirmation dialog

**Independent Test**: Click kill button on a session card, confirm dialog, verify session status changes to "ended"

### Implementation for User Story 1

- [x] T006 [US1] Implement `useKillSession` hook in `frontend/src/hooks/useKillSession.ts` (make T003 tests pass)
- [x] T007 [US1] Implement `KillSessionDialog` component in `frontend/src/components/KillSessionDialog/KillSessionDialog.tsx` (make T004 tests pass)
- [x] T008 [US1] Add kill button to `SessionMetaRow` in `frontend/src/components/SessionMetaRow/SessionMetaRow.tsx`: add `onKill` and `killPending` optional props, render a red `X`/`Square` icon button next to the View Details link when `onKill` is provided and session is killable (has PID, not ended/completed), disable button when `killPending` is true (make T005 tests pass)
- [x] T009 [US1] Wire kill flow in `SessionCard` in `frontend/src/components/SessionCard/SessionCard.tsx`: use `useKillSession` hook, pass `onKill` and `killPending` to `SessionMetaRow`, render `KillSessionDialog` with session info, handle confirm/cancel
- [x] T010 [US1] Verify all Phase 2 tests pass (Green phase), run `npm run test --workspace=frontend`

**Checkpoint**: Kill from dashboard card works end-to-end

---

## Phase 4: User Story 2 - Kill from Detail Page (Priority: P2)

**Goal**: Users can kill a session from the session detail page header

**Independent Test**: Navigate to an active session's detail page, click kill button, confirm, verify status changes to "ended"

### Implementation for User Story 2

- [x] T011 [US2] Wire kill flow in `SessionPage` in `frontend/src/pages/SessionPage.tsx`: use `useKillSession` hook, pass `onKill` and `killPending` to `SessionMetaRow`, render `KillSessionDialog`
- [x] T012 [US2] Add kill button tests for `SessionPage` to `frontend/src/__tests__/SessionDetail.test.tsx`: test kill button visible for active sessions with PID, hidden for ended sessions, dialog opens on click

**Checkpoint**: Kill from detail page works end-to-end

---

## Phase 5: User Story 3 - Error Feedback (Priority: P2)

**Goal**: Users see clear error messages when a kill operation fails

**Independent Test**: Mock a failed stop request, verify error message appears in dialog, verify button returns to normal state

### Implementation for User Story 3

- [x] T013 [US3] Add error display to `KillSessionDialog` (if not already handled in T007): show error text from API response, allow retry or dismiss
- [x] T014 [US3] Add error scenario tests in `frontend/src/__tests__/KillSessionDialog.test.tsx`: test error message from 404 (not found), 409 (already ended), 403 (not permitted), generic network error, verify retry capability

**Checkpoint**: Error feedback works for all failure modes

---

## Phase 6: E2E Tests

**Purpose**: End-to-end Playwright test for the kill session flow

- [x] T015 Write e2e test in `frontend/tests/e2e/sc-027-kill-session.spec.ts`: mock active session with PID, click kill button on card, verify dialog appears, confirm kill, verify API call made, verify session status updates to ended; also test cancel dismisses dialog

---

## Phase 7: Polish & Cross-Cutting

**Purpose**: Documentation, build verification, final cleanup

- [ ] T016 Update `README.md` to document kill session feature (§XI)
- [ ] T017 Run full frontend build `npm run build --workspace=frontend` and verify success
- [ ] T018 Run full test suite `npm run test --workspace=frontend` and verify all tests pass

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies, T001 and T002 can run in parallel
- **Phase 2 (Tests First)**: Depends on Phase 1 file stubs existing; T003, T004, T005 can run in parallel
- **Phase 3 (US1)**: Depends on Phase 2 (TDD: tests must exist and fail first)
- **Phase 4 (US2)**: Depends on Phase 3 (reuses hook and dialog from US1)
- **Phase 5 (US3)**: Depends on Phase 3 (extends dialog error handling)
- **Phase 6 (E2E)**: Depends on Phase 3 (needs working kill flow)
- **Phase 7 (Polish)**: Depends on all previous phases

### Parallel Opportunities

- T001 + T002 (Phase 1): Different files, no deps
- T003 + T004 + T005 (Phase 2): Different test files, no deps
- T006 + T007 (Phase 3): Different source files, no deps
- T011 + T012 (Phase 4): Can be done together
- T013 + T014 (Phase 5): Can be done together
