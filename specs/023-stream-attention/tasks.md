# Tasks: 023-stream-attention — Smart Output Stream Display

**Branch**: `023-stream-attention`
**Spec**: `specs/023-stream-attention/spec.md`
**Plan**: `specs/023-stream-attention/plan.md`

---

## Phase 1: Setup — Types and Shared Definitions

**Goal**: Extend `DashboardSettings` with the new display mode field. No UI yet — just the type and default value. All downstream tasks depend on this.

- [x] T001 [P1] Add `OutputDisplayMode` type alias (`'focused' | 'verbose'`) and `outputDisplayMode: OutputDisplayMode` field to `DashboardSettings` in `frontend/src/types.ts`. Set default to `'focused'` in `DEFAULT_SETTINGS`. (FR-001, FR-010)

---

## Phase 2: Foundational Utilities (CRITICAL gate — blocks all rendering changes)

**Goal**: Create and test the utility functions that the new rendering logic depends on.

**Independent test criteria**: `npm run test --workspace=frontend` passes with new unit tests for the utilities.

- [x] T002 [P1] Write failing unit tests in `frontend/src/__tests__/sessionDetailUtils.test.ts` for:
  - `summariseToolUse(item)`: plain-string content returns `"ToolName: content"` (truncated to 80 chars); JSON content extracts `path`/`file_path`/`command` key; no toolName falls back to content only; long content is truncated.
  - `isAlwaysVisible(item)`: returns `true` for `type: error` and `type: status_change`; returns `false` for `tool_result`; returns `true` for `message` and `tool_use`.

- [x] T003 [P1] [US1, US2] Create `frontend/src/components/SessionDetail/sessionDetailUtils.ts` implementing `summariseToolUse(item: SessionOutput): string` and `isAlwaysVisible(item: SessionOutput): boolean`. Make T002 tests pass.

---

## Phase 3: P1 Stories — Focused Mode and Tool Call Summary

**Goal**: Implement the two P1 user stories: hidden tool_results in focused mode, and compact tool_use summaries.

**Independent test criteria**: Opening output pane shows no tool_result rows by default; tool_use rows show compact summaries.

- [x] T004 [P1] [US1, US2] Write failing tests in `frontend/src/__tests__/SessionDetail.test.tsx` for focused mode:
  - tool_result row is NOT rendered when `displayMode='focused'`
  - tool_result row IS rendered when `displayMode='verbose'`
  - clicking expand button on a collapsed tool_result reveals its content
  - tool_use row shows compact summary (`"ToolName: content"`) not raw JSON
  - tool_use summary is expandable to full JSON on click
  - error and status_change rows are always visible in both modes

- [x] T005 [P1] [US1, US2] Update `frontend/src/components/SessionDetail/SessionDetail.tsx` to:
  - Accept `displayMode: OutputDisplayMode` prop (default `'focused'`)
  - In focused mode: hide `tool_result` rows; show expand button instead; reveal content on click (local `Set<string>` state for expanded IDs)
  - Replace raw `tool_use` content with `summariseToolUse()` output; make summary row expandable to full content on click
  - Keep `error` and `status_change` always visible
  - Preserve dark/light theme on all new elements
  - Make T004 tests pass.

---

## Phase 4: P2 Story — View Toggle with Global Persistence

**Goal**: Add the Focused/Verbose toggle to `OutputPane` header, wired to global settings.

**Independent test criteria**: Clicking toggle switches mode; mode persists after pane close/reopen.

- [x] T006 [P2] [US3] Write failing tests for `OutputPane` toggle:
  - Toggle button is present in the header
  - Clicking toggle changes displayed mode label (Focused/Verbose)
  - In verbose mode, tool_result content is visible

- [x] T007 [P2] [US3] Update `frontend/src/components/OutputPane/OutputPane.tsx`:
  - Read `outputDisplayMode` from `useSettings`
  - Add a toggle button in the header bar (next to close button) showing current mode
  - Pass `displayMode` prop to `SessionDetail`
  - On toggle click, call `updateSetting('outputDisplayMode', ...)` to persist globally
  - Make T006 tests pass.

---

## Phase 5: P3 Story — Verbose Mode Truncation

**Goal**: Prevent very long tool_result content from overwhelming the page in verbose mode.

**Independent test criteria**: A tool_result with > 40 lines shows truncated content and a "Show more" button in verbose mode.

- [x] T008 [P3] [US4] Write failing tests for verbose mode truncation:
  - tool_result content with > 40 lines is truncated in verbose mode
  - "Show more" button is present on truncated content
  - Clicking "Show more" reveals the full content

- [x] T009 [P3] [US4] Implement verbose mode truncation in `SessionDetail.tsx`:
  - Track a separate `Set<string>` for "expanded-full" items in verbose mode
  - If content line count > 40 and item not in expanded-full set: show first 40 lines + "Show more" button
  - "Show more" adds item to expanded-full set
  - Make T008 tests pass.

---

## Final Phase: Polish and Validation

**Goal**: Documentation, full test run, build check.

- [x] T010 [P2] Update `README.md` to document the Focused/Verbose mode toggle in the output pane section. (§XI)

- [x] T011 [P2] Run `npm run test --workspace=frontend` — confirm all tests pass, no coverage regressions.

- [x] T012 [P2] Run `npm run build --workspace=frontend` — confirm build succeeds with no TypeScript errors.
