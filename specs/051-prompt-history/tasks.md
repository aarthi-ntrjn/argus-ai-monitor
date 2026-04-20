# Tasks: Session Prompt History Navigation

**Input**: Design documents from `specs/051-prompt-history/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md

---

## Phase 1: Setup

**Purpose**: Create the new hook file and test stubs so downstream tasks have clear targets.

- [ ] T001 Create `frontend/src/hooks/usePromptHistory.ts` with exported stub (empty function, correct TypeScript signature matching `UsePromptHistoryResult` from data-model.md)
- [ ] T002 Create `frontend/src/__tests__/usePromptHistory.test.ts` with describe block and one placeholder test that asserts the hook exists

---

## Phase 2: User Story 1 + 2 — Up/Down Navigation with Draft Preservation (Priority: P1)

**Goal**: User can press up arrow to cycle backward through bar-sent prompts and down arrow to cycle forward; the draft text is saved and restored when navigating past the newest entry.

**Independent Test**: Type text in the prompt bar, press up — most recent sent prompt appears. Press up again — older prompt. Press down past newest — original draft text returns exactly. Works with empty draft too.

**⚠️ Write tests FIRST — ensure they FAIL before implementing.**

### Tests for US1+US2

- [ ] T003 [P] [US1] Write failing tests in `usePromptHistory.test.ts` for `navigateUp`:
  - `navigateUp` with empty entries returns empty string (no-op)
  - `navigateUp` with one entry returns that entry; calling again is a no-op
  - `navigateUp` with multiple entries cycles oldest-to-newest correctly
  - `historyIndex` advances correctly with each call
  - `isNavigating` is false before first call, true after
- [ ] T004 [P] [US1] Write failing tests in `usePromptHistory.test.ts` for `navigateDown`:
  - `navigateDown` when not navigating is a no-op (returns empty string)
  - `navigateDown` from historyIndex 1 moves to historyIndex 0
  - `navigateDown` from historyIndex 0 returns the saved draft and resets `isNavigating` to false
- [ ] T005 [P] [US2] Write failing tests in `usePromptHistory.test.ts` for draft preservation:
  - Draft text passed to first `navigateUp` call is stored
  - Draft restored when `navigateDown` is called past the newest entry
  - Empty string draft restored correctly
- [ ] T006 [P] [US1] Write failing tests in `usePromptHistory.test.ts` for `addEntry`:
  - Adds text to entries; `entries.length` increases
  - Caps entries at 50 (oldest dropped when 51st added)
  - Resets `historyIndex` to null and `isNavigating` to false after adding
- [ ] T007 [P] [US1] Write failing tests in `SessionPromptBar.test.tsx` for arrow key handling:
  - Pressing ArrowUp in the input when no history exists: input unchanged
  - Pressing ArrowUp once when one prompt was sent: input shows that prompt
  - Pressing ArrowUp twice: input shows second-most-recent prompt
  - Pressing ArrowDown after navigating up: input moves toward newest
  - Pressing ArrowDown past newest: input restores to draft text

### Implementation for US1+US2

- [ ] T008 [US1] Implement `usePromptHistory` hook in `frontend/src/hooks/usePromptHistory.ts`:
  - State: `entries: string[]`, `historyIndex: number | null`, `draft: string`
  - `navigateUp(currentInput: string): string` — saves draft on first call, returns next older entry
  - `navigateDown(): string` — returns next newer entry, or draft when past newest
  - `addEntry(text: string): void` — appends entry (cap 50), resets navigation
  - `resetNavigation(): void` — resets historyIndex to null
  - Computed: `isNavigating: boolean`, `indicator: string | null`
  - Ensure all hook functions are < 50 lines each (§III)
- [ ] T009 [US1] Integrate `usePromptHistory` into `SessionPromptBar.tsx`:
  - Call `const history = usePromptHistory(session.id, [])` (empty array for now — US3 fills this)
  - In `handleKeyDown`: handle `ArrowUp` → `e.preventDefault()`, set prompt to `history.navigateUp(prompt)`
  - In `handleKeyDown`: handle `ArrowDown` → prevent default only when `history.isNavigating`, set prompt to `history.navigateDown()`
  - In `handleSend` (after `await sendPrompt`): call `history.addEntry(text)` with the trimmed text that was sent

**Checkpoint**: US1+US2 fully functional and tested. User can navigate bar-sent prompts with up/down; draft preserved.

---

## Phase 3: User Story 3 — Terminal "You" Messages in History (Priority: P1)

**Goal**: Messages typed directly in the Claude/Copilot terminal (appearing as "you" messages in session output) are also navigable from the Argus prompt bar history, including messages present when the view loads (backfill).

**Independent Test**: Open a session. Type a message in the terminal (not via the bar). Focus the Argus prompt bar, press up arrow. The terminal message appears in the navigable history.

**⚠️ Write tests FIRST — ensure they FAIL before implementing.**

### Tests for US3

- [ ] T010 [P] [US3] Write failing tests in `usePromptHistory.test.ts` for backfill:
  - When `sessionOutputItems` contains "you" messages on initial render, `entries` is seeded with their content in chronological order
  - `isMeta: true` entries are excluded
  - Empty-content entries are excluded
  - Non-user-message entries (role='assistant', type='tool_use') are excluded
- [ ] T011 [P] [US3] Write failing tests in `usePromptHistory.test.ts` for live sync:
  - When `sessionOutputItems` gains a new "you" message (higher `sequenceNumber`), it is added to `entries`
  - When `sessionOutputItems` gains a new "you" message whose text matches a pending bar-send, it is NOT added again (dedup via `pendingBarSends`)
  - When user sends the same text twice via bar, both bar-sends are tracked and two corresponding session output entries each decrement the count once

### Implementation for US3

- [ ] T012 [US3] Add `sessionOutputItems: SessionOutput[]` parameter to `usePromptHistory` hook:
  - Seed `entries` from `sessionOutputItems` on mount (filter: `role === 'user'`, `type === 'message'`, `!isMeta`, non-empty content, sorted by `sequenceNumber`)
  - Initialize `lastSeenSequence` to the max `sequenceNumber` among seeded items (or 0)
  - Add `pendingBarSends: Map<string, number>` state
  - Update `addEntry` to increment `pendingBarSends[text]` before appending to entries
  - Add `useEffect` watching `sessionOutputItems`: for each item with `sequenceNumber > lastSeenSequence`, apply dedup logic (decrement `pendingBarSends` if pending, else append to `entries`); update `lastSeenSequence`
- [ ] T013 [US3] Add `useQuery(['session-output', session.id])` to `SessionPromptBar.tsx`:
  - Pass the resulting `data.items ?? []` as second argument to `usePromptHistory`
  - Import `getSessionOutput` and `SessionOutput` (query uses shared cache; no extra network request)

**Checkpoint**: US3 complete. All three user stories functional.

---

## Phase 4: History Mode Indicator (FR-013)

**Goal**: While the user is navigating history, a subtle "N / Total" indicator is displayed in the prompt bar. It disappears when the user returns to draft or sends a message.

**Independent Test**: Send 3 prompts. Press up arrow once — indicator shows "1 / 3". Press up again — "2 / 3". Press down to "1 / 3". Press down once more — indicator disappears.

**⚠️ Write tests FIRST — ensure they FAIL before implementing.**

### Tests for Indicator

- [ ] T014 [P] Write failing tests in `usePromptHistory.test.ts` for `indicator`:
  - `indicator` is null when not navigating
  - `indicator` is `"1 / N"` after first up arrow (at most recent entry)
  - `indicator` is `"N / N"` at oldest entry
  - `indicator` returns to null after navigating back to draft (down past newest)
- [ ] T015 [P] Write failing tests in `SessionPromptBar.test.tsx` for indicator rendering:
  - Indicator element is not present initially
  - Indicator element appears in the DOM after pressing ArrowUp (with correct text)
  - Indicator disappears after pressing ArrowDown back to draft position
  - Indicator disappears after sending a message

### Implementation for Indicator

- [ ] T016 Confirm `indicator` computed value in `usePromptHistory` — `historyIndex === null ? null : \`${historyIndex + 1} / ${entries.length}\``; already part of T008, add if missing
- [ ] T017 Render indicator in `SessionPromptBar.tsx`:
  - When `history.indicator` is non-null, render `<span aria-live="polite" className="text-xs text-gray-500 shrink-0 tabular-nums">{history.indicator}</span>` inside the flex row, to the left of the `<input>`
  - Ensure `aria-live="polite"` so screen readers announce navigation position changes

**Checkpoint**: Indicator complete. All acceptance criteria and success criteria (SC-006) met.

---

## Phase 5: Polish and Cross-Cutting Concerns

**Purpose**: README update, build validation, full test run.

- [ ] T018 Update `README.md` — add a "Prompt History Navigation" entry under the session prompt bar section, describing the up/down arrow feature, the 50-entry cap, and that terminal messages are included (§XI)
- [ ] T019 [P] Run `npm run build --workspace=frontend` — confirm no TypeScript errors or build failures
- [ ] T020 [P] Run `npm run test --workspace=frontend` — confirm all tests pass with no regressions

---

## Dependencies and Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (US1+US2)**: Depends on Phase 1
- **Phase 3 (US3)**: Depends on Phase 2 (hook must exist before adding `sessionOutputItems` parameter)
- **Phase 4 (Indicator)**: Depends on Phase 2 (hook computed values must exist)
- **Phase 5 (Polish)**: Depends on Phases 2, 3, 4

### Within Phase 2

- Tests (T003–T007) are all independent and can run in parallel
- Tests MUST fail before T008–T009 implementation begins (TDD gate)
- T008 (hook implementation) before T009 (integration into component)

### Within Phase 3

- Tests (T010–T011) are independent and can run in parallel
- Tests MUST fail before T012–T013 begins
- T012 (hook update) before T013 (component integration)

### Within Phase 4

- Tests (T014–T015) are independent and can run in parallel
- Tests MUST fail before T016–T017 begins
- T016 (hook computed value) before T017 (component render)

### Parallel Opportunities

- All test-writing tasks within a phase (marked [P]) can run in parallel
- T019 and T020 (build + test) can run in parallel after all implementation phases complete
