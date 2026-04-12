# Tasks: AI Choice Alert

**Branch**: `028-ai-choice-alert`
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

---

## Phase 1: Setup

**Goal**: Add the `PendingChoice` type and `detectPendingChoice` function signature (stub) to `sessionUtils.ts`. No behaviour change yet.

- [x] T001 [P1] Add `PendingChoice` interface and stub `detectPendingChoice(items: SessionOutput[]): PendingChoice | null` (returns `null`) to `frontend/src/utils/sessionUtils.ts`.

---

## Phase 2: Foundational (tests first — CRITICAL gate)

**Goal**: Write failing tests for `detectPendingChoice` before implementing it.

**Independent test criteria**: `npm test` in the frontend passes overall; the new `detectPendingChoice` tests fail until T003 is implemented.

- [x] T002 [P2] Add `describe('detectPendingChoice', ...)` block to `frontend/src/__tests__/sessionUtils.test.ts` covering:
  - Returns `null` for empty items array.
  - Returns `null` when no `ask_user` or `AskUserQuestion` tool_use exists.
  - Returns `PendingChoice` with question and choices when last item is an unanswered `ask_user` tool_use (Copilot format).
  - Returns `PendingChoice` with question and empty choices when last item is an unanswered `AskUserQuestion` tool_use (Claude format).
  - Returns `null` when the `ask_user` tool_use has a subsequent `tool_result` (answered).
  - Returns `{ question: '', choices: [] }` when tool input is malformed JSON (does not throw).
  - Returns `null` when matching tool_use exists but session items contain a tool_result with higher sequenceNumber.

*Confirm tests are red, then implement T003.*

- [x] T003 [P2] Implement `detectPendingChoice` in `frontend/src/utils/sessionUtils.ts` (full logic per data-model.md). Confirm all T002 tests turn green.

---

## Phase 3: US1 + US2 — Render ATTENTION NEEDED in SessionCard

**Goal**: `SessionCard` renders the alert for both readonly and connected sessions.

**Independent test criteria**: Mocking `useQuery` to return a pending `ask_user` tool_use causes the summary line to show "ATTENTION NEEDED" with the question and choices.

### Test tasks (write first)

- [x] T004 [P3] Add tests to `frontend/src/__tests__/SessionCard.test.tsx`:
  - Summary shows "ATTENTION NEEDED" (with `role="alert"`) when `useQuery` returns items with a pending `ask_user` tool_use (readonly session).
  - Summary shows the question text alongside "ATTENTION NEEDED".
  - Summary shows labelled choices ("1. Option A / 2. Option B") alongside "ATTENTION NEEDED".
  - Summary shows "ATTENTION NEEDED" for a connected (PTY) session with a pending choice.
  - Normal summary is shown when there is no pending choice (no regression).
  - Normal summary is shown when session status is "ended", even if output has a pending tool_use.
  - "ATTENTION NEEDED" is NOT shown when `ask_user` tool_use has a subsequent `tool_result`.

### Implementation tasks

- [x] T005 [P3] Update `frontend/src/components/SessionCard/SessionCard.tsx`:
  - Call `detectPendingChoice(items)` after deriving `items` from the query.
  - Replace the summary `<p>` conditional to render:
    - If `pendingChoice !== null` AND `session.status` not in `['ended', 'completed']`:
      - `<span>` with `font-bold text-red-600` containing "ATTENTION NEEDED"
      - Question text (if non-empty) appended after a space
      - Choices formatted as "1. X / 2. Y / ..." appended after " — " (if any)
      - Apply `line-clamp-3 whitespace-normal break-words` instead of `truncate`
      - Add `role="alert"` to the `<p>` element for screen readers
    - Else: existing `session.summary || 'Nothing sent yet'` logic (unchanged)

---

## Phase 4: Polish

**Goal**: E2E test coverage; README update; build verification.

- [ ] T006 [P4] Write `frontend/tests/e2e/sc-028-ai-choice-alert.spec.ts` with mocked API:
  - A session card with a pending `ask_user` tool_use shows "ATTENTION NEEDED" in the summary line.
  - The question text appears in the summary line.
  - The labelled choices appear in the summary line.
  - A session card with an answered `ask_user` (tool_result present) shows the normal summary.
  - A session with `status: 'ended'` does not show the alert even with a pending tool_use in output.
- [ ] T007 [P4] Update `README.md`: document the ATTENTION NEEDED alert (what triggers it, what it shows, difference between readonly and connected sessions).
- [ ] T008 [P4] Run `npm run build --workspace=frontend` and confirm zero errors.
- [ ] T009 [P4] Run `npm test --workspace=frontend` (all unit tests pass) and `npm run test:e2e` (all e2e mock tests pass).
