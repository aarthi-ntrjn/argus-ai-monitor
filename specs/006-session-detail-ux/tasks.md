# Tasks: Session Detail UX Redesign

**Input**: Design documents from `/specs/006-session-detail-ux/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Type system updates needed by all phases

- [X] T113 Add `'interrupt'` to `ControlActionType` union in `backend/src/models/index.ts`
- [X] T114 Add `'interrupt'` to `ControlActionType` union in `frontend/src/types.ts`

**Checkpoint**: Type system updated — all subsequent tasks can reference the `interrupt` action type

---

## Phase 2: Foundational (US6 — Claude Process Identifier Bug Fix) (Priority: P1 Bug)

**Purpose**: Fix the backend PID capture for Claude Code sessions. Foundational because every card relies on correct session data.

**⚠️ CRITICAL**: This phase is a bug fix that affects session data quality for all cards.

**Goal**: Active Claude Code sessions show their OS PID and Claude session ID in the card header.

**Independent Test**: Start a Claude Code session, reload the dashboard — the session card shows a PID value (not blank) and the Claude session ID.

### Tests for US6

> **Write these tests FIRST, ensure they FAIL before implementation**

- [X] T115 [P] [US6] Write unit tests for PID capture in `backend/tests/unit/claude-pid.test.ts`: test that `scanExistingSessions()` sets `pid` on the session record when a matching Claude process is found in `psList`, and leaves `pid: null` when no Claude process is running

### Implementation for US6

- [X] T116 [US6] Update `ClaudeCodeDetector.scanExistingSessions()` in `backend/src/services/claude-code-detector.ts` to capture the OS PID from the first matching Claude process in `psList` output and pass it to `upsertSession` / `updateSessionStatus` — store it on the session `pid` field (depends on T115 test failing first)
- [X] T117 [P] [US6] Update `SessionCard` in `frontend/src/components/SessionCard/SessionCard.tsx` to always display the Claude session `id` as an identifier (e.g. `ID: abc-12345`) for `claude-code` sessions, in addition to `pid` when present — replace `{session.pid && ...}` with a Claude-aware display block
- [X] T118 [P] [US6] Update `SessionPage` in `frontend/src/pages/SessionPage.tsx` with the same Claude session ID display logic (mirrors T117 for the drill-in page)

**Checkpoint**: Claude Code sessions now show OS PID (when detectable) and their session ID on both the card and drill-in page

---

## Phase 3: US1 — Two-Pane Session View (Priority: P1) 🎯 MVP

**Goal**: Clicking a session card opens a right-side output pane showing the session's live streaming output. The card list remains visible. Clicking elsewhere or pressing Escape dismisses the pane.

**Independent Test**: Open the dashboard, click a session card — a right pane appears alongside the card list showing the session output. Clicking a different card switches the pane. Pressing Escape closes it.

### Tests for US1

- [X] T119 [US1] Write E2E tests for the two-pane layout in `frontend/tests/e2e/sc-006-session-ux.spec.ts`: (a) clicking a card opens right pane with output, (b) clicking a second card switches pane, (c) Escape key closes pane, (d) click outside closes pane, (e) ended session keeps output visible in pane but hides controls

### Implementation for US1

- [X] T120 [US1] Create `OutputPane` component in `frontend/src/components/OutputPane/OutputPane.tsx`: accepts `sessionId: string` and `onClose: () => void` props; fetches session output using `getSessionOutput` via TanStack Query (keyed `['session-output', sessionId]`); renders the same output stream as `SessionDetail`; includes a close button (✕) and handles Escape keydown; shows session type, status, elapsed time, and process info in a header strip; scrolls to bottom on new items
- [X] T121 [US1] Update `DashboardPage` in `frontend/src/pages/DashboardPage.tsx`: add `selectedSessionId: string | null` state (default `null`); switch to a `flex` two-column layout when `selectedSessionId` is set — left column is the card list, right column renders `OutputPane`; clicking a card sets `selectedSessionId`; closing pane resets to `null`; on narrow viewports (< `lg`) the `OutputPane` overlays full-width

**Checkpoint**: Two-pane layout functional — users can view live session output from the dashboard without navigating away

---

## Phase 4: US2 — Quick Command Buttons (Priority: P1)

**Goal**: Each active Claude Code session card shows four shortcut buttons: Esc (interrupt), Exit (confirm then `/exit`), Merge, Pull latest. Clicking executes the command immediately (or with inline confirm for Exit).

**Independent Test**: On an active Claude Code card, all four buttons are visible. Clicking Esc calls `POST /interrupt`. Clicking Exit shows inline confirm, then sends `/exit` via `POST /send`. Clicking Merge sends the merge prompt. Clicking Pull sends the pull prompt. Ended sessions show no buttons.

### Tests for US2

- [X] T122 [P] [US2] Write contract test for interrupt endpoint in `backend/tests/contract/sessions.test.ts`: test `POST /api/v1/sessions/:id/interrupt` returns 202 with `actionId` for active session, 404 for unknown session, 409 for ended session, 501 when no PID available

### Implementation for US2

- [X] T123 [US2] Add `interruptSession()` method to `backend/src/services/session-controller.ts`: mirrors `stopSession()` but sends SIGINT instead of SIGTERM (Unix: `process.kill(pid, 'SIGINT')`; Windows: `taskkill /PID {pid}` without `/F`); creates a `ControlAction` with `type: 'interrupt'`; if session has no PID, throws `NOT_SUPPORTED` error with code (depends on T122 failing first)
- [X] T124 [US2] Add `POST /api/v1/sessions/:id/interrupt` route to `backend/src/api/routes/sessions.ts`: calls `sessionController.interruptSession(id)`, returns 202 `{actionId, status}`, handles NOT_FOUND (404), CONFLICT (409), NOT_SUPPORTED (501) — all with `{ error, message, requestId: request.id }` body (§XII)
- [X] T125 [P] [US2] Add `interruptSession(id: string)` API helper to `frontend/src/services/api.ts`: `POST /api/v1/sessions/{id}/interrupt`, returns `ControlAction`
- [X] T126 [US2] Create `QuickCommands` component in `frontend/src/components/QuickCommands/QuickCommands.tsx`: accepts `session: Session`, `onInterrupt`, `onSendPrompt`, `onExitConfirm` callbacks; renders four buttons for `claude-code` sessions; tracks `exitConfirming: boolean` local state for the Exit inline confirm (`Confirm exit?` + `Yes` + `Cancel` buttons); no buttons shown for ended/completed sessions; each button is compact (icon+label) and has a disabled state while the action is in-flight
- [X] T127 [US2] Wire `QuickCommands` into `SessionCard` in `frontend/src/components/SessionCard/SessionCard.tsx`: pass `session`, wire `onInterrupt` to call `interruptSession()` mutation, `onSendPrompt` to call `sendPrompt()` mutation with the fixed prompt strings; show inline error below buttons on failure (§XII: plain language, no HTTP codes)
- [X] T128 [US2] Add E2E tests for quick commands to `frontend/tests/e2e/sc-006-session-ux.spec.ts`: (a) Esc button calls interrupt endpoint, (b) Exit requires confirm, (c) Exit cancel does nothing, (d) Merge/Pull send correct prompts, (e) no buttons on ended session

**Checkpoint**: All four quick commands functional from the dashboard card

---

## Phase 5: US3 — Inline Prompt Input (Priority: P1)

**Goal**: Active Claude Code session cards show a compact text input. Typing a message and pressing Enter sends it to the session. Copilot CLI cards show no input.

**Independent Test**: Type into the prompt field on an active Claude Code card, press Enter — the prompt is sent (verified via mocked API), the input clears, and the field re-enables.

### Tests for US3

- [X] T129 [US3] Add E2E tests for inline prompt to `frontend/tests/e2e/sc-006-session-ux.spec.ts`: (a) input visible on Claude Code card, (b) absent on Copilot CLI card, (c) absent on ended session, (d) Enter sends and clears, (e) empty input does not send, (f) error shown inline on send failure

### Implementation for US3

- [X] T130 [US3] Create `InlinePrompt` component in `frontend/src/components/InlinePrompt/InlinePrompt.tsx`: accepts `onSend: (prompt: string) => Promise<void>` prop; renders a single-row `<input>` with a send `→` button; tracks `value`, `sending`, `error` state; pressing Enter or clicking send calls `onSend`; clears on success; shows inline error message on failure; disabled while `sending`; input is `placeholder="Send a message…"`
- [X] T131 [US3] Wire `InlinePrompt` into `SessionCard` in `frontend/src/components/SessionCard/SessionCard.tsx`: shown only for `claude-code` sessions that are not ended/completed; `onSend` calls `sendPrompt()` mutation; no visible change to ended session cards

**Checkpoint**: Users can send custom prompts directly from any active Claude Code card

---

## Phase 6: US4 — Last Output Preview on Card (Priority: P2)

**Goal**: Each session card shows a one-line truncated preview of the most recent output item.

**Independent Test**: Dashboard shows a session with output history — the card displays the last output line (truncated) below the session summary without clicking into the session.

### Implementation for US4

- [X] T132 [US4] Update `SessionCard` in `frontend/src/components/SessionCard/SessionCard.tsx` to fetch the last output item using `getSessionOutput(session.id, { limit: 1 })` via TanStack Query (key `['session-output-last', session.id]`); display the `content` of the first item as a single truncated line using `truncate` / `line-clamp-1`; show nothing if no output yet (not a loading spinner — keep the card lightweight)

**Checkpoint**: Glanceable output preview visible on all session cards

---

## Phase 7: US5 — Drill-in Page Link (Priority: P3)

**Goal**: Each session card includes a small link/icon that navigates to the existing `/sessions/:id` page.

**Independent Test**: Click the drill-in icon on any session card — the browser navigates to `/sessions/{id}`.

### Implementation for US5

- [X] T133 [US5] Add a drill-in link (↗ icon using `useNavigate`) to `frontend/src/components/SessionCard/SessionCard.tsx`: a small icon button in the card header (top-right corner); clicking it calls `navigate(\`/sessions/\${session.id}\`)` and stops click propagation so it doesn't also select the card for the output pane; tooltip text "Open full session view"

**Checkpoint**: Users can access the full drill-in page from any card via a single click

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T134 [P] Update `README.md` with new session UX features: two-pane layout, quick command buttons (Esc/Exit/Merge/Pull latest), inline prompt input, last output preview, Claude process ID display
- [X] T135 Verify frontend build passes: `cd frontend && npm run build` — 0 TypeScript errors
- [X] T136 Verify all backend tests pass: `cd backend && npm test` — all existing tests still green plus new T115/T122 tests

---

## Phase 9: UX Refinement — Unified Prompt Bar

**Purpose**: Consolidate the separate `QuickCommands` button row and `InlinePrompt` input into a single `SessionPromptBar` component. Quick commands (Esc, Exit, Merge, Pull latest) move into a `⋮` dropdown menu next to the Send button. Fix: Merge and Pull are now shown for **all** session types (copilot-cli included), not just claude-code.

**Goal**: For claude-code sessions: `[input ___________] [Send] [⋮]`. For copilot-cli sessions: `[⋮ Actions]` standalone. The `⋮` dropdown contains all four commands for every session type.

**Independent Test**: Open the dashboard with a copilot-cli session and a claude-code session. Both cards show the `⋮` menu. The claude-code card also shows the text input + Send button. Opening the menu on the copilot-cli card shows Esc, Exit, Merge, Pull latest. Clicking Merge on copilot-cli shows an inline error (backend 501). Clicking Merge on claude-code sends the prompt.

### Implementation for Phase 9

- [X] T137 [US7] Create `frontend/src/components/SessionPromptBar/SessionPromptBar.tsx`: unified component that renders (a) for claude-code — `[input] [Send] [⋮ menu]` inline row, (b) for all session types — a `⋮` dropdown button containing Esc, Exit (confirm), Merge (confirm), Pull latest (confirm); dropdown opens on click and closes on outside click or Escape; error shown inline below; merge all logic from `QuickCommands.tsx` and `InlinePrompt.tsx`
- [X] T138 [US7] Update `frontend/src/components/SessionCard/SessionCard.tsx`: remove `QuickCommands` and `InlinePrompt` imports and JSX, add `SessionPromptBar` import, replace both `<div onClick stopPropagation>` sections with a single `<div onClick={e => e.stopPropagation()}><SessionPromptBar session={session} /></div>`; also move last-output preview BELOW the SessionPromptBar row so the send input is never obscured by output text
- [X] T139 [P] [US7] Delete `frontend/src/components/QuickCommands/QuickCommands.tsx` — merged into SessionPromptBar
- [X] T140 [P] [US7] Delete `frontend/src/components/InlinePrompt/InlinePrompt.tsx` — merged into SessionPromptBar
- [X] T141 [P] [US7] Update `frontend/tests/e2e/sc-006-session-ux.spec.ts`: fix quick command tests to open the `⋮` menu first before looking for Esc/Exit/Merge/Pull; fix inline prompt test to still find `placeholder=/send a prompt/i`; add test that copilot-cli card shows the `⋮` menu with Merge and Pull visible
- [X] T142 Verify `cd frontend && npm run build` passes — 0 TypeScript errors

---

## Phase 10: Session Type Icons

**Purpose**: Add recognisable brand icons next to the session-type label in every place the type is displayed (SessionCard badge, SessionPage badge). No new npm dependency — icons are self-contained inline SVG components.

**Goal**: The `claude-code` badge shows the Claude (Anthropic) logo and the `copilot-cli` badge shows the GitHub Copilot logo, both rendered as 14×14 inline SVGs aligned with the label text.

**Independent Test**: Open the dashboard — both session-type badges show their icon to the left of the text. The same icons appear on the full SessionPage header.

### Implementation for Phase 10

- [X] T143 [US8] Create `frontend/src/components/SessionTypeIcon/SessionTypeIcon.tsx`: a component that accepts `type: string` and renders a 14×14 inline SVG; for `'claude-code'` render the Claude/Anthropic logo SVG path; for `'copilot-cli'` render the GitHub Copilot SVG path; for unknown types render nothing (`null`); no external dependency — paths are embedded directly
- [X] T144 [P] [US8] Update the type badge in `frontend/src/components/SessionCard/SessionCard.tsx` to render `<SessionTypeIcon type={session.type} />` immediately before the label text inside the badge `<span>`, with `inline-flex items-center gap-1` on the span
- [X] T145 [P] [US8] Update the type badge in `frontend/src/pages/SessionPage.tsx` with the same `<SessionTypeIcon>` and `inline-flex items-center gap-1` treatment
- [X] T146 Verify `cd frontend && npm run build` passes — 0 TypeScript errors

---

## Phase 11: Bug Fix — Prompt Input Missing on copilot-cli Cards

**Problem**: `SessionPromptBar` only renders the text input and Send button when `session.type === 'claude-code'`. Copilot CLI cards show only the `⋮` menu with no way to send a prompt.

**Root cause**: The `isClaudeCode` guard in `SessionPromptBar.tsx` was carried forward from the old `InlinePrompt` component. The backend `/send` endpoint already handles copilot-cli gracefully — it returns HTTP 501 with `{ message: 'Prompt injection not supported for Copilot CLI in v1' }`, which surfaces as an inline error.

**Fix**: Remove the `isClaudeCode` condition so the input + Send button render for all session types.

- [X] T147 [US9] In `frontend/src/components/SessionPromptBar/SessionPromptBar.tsx`, remove the `isClaudeCode` guard from both the `<input>` and Send `<button>` blocks so they render for all session types (delete the `{isClaudeCode && (...)}` wrappers, keep the elements unconditionally); also remove the now-unused `isClaudeCode` variable
- [X] T148 [P] [US9] Update `frontend/tests/e2e/sc-006-session-ux.spec.ts`: add assertion that the copilot-cli card (`Another session`) also shows a prompt input (`getByPlaceholder(/send a prompt/i).nth(1)`)
- [X] T149 Verify `cd frontend && npm run build` passes — 0 TypeScript errors

---

## Phase 12: Polish — Dashboard Title Font Weight

- [X] T150 In `frontend/src/pages/DashboardPage.tsx` line 139, change `font-bold` to `font-semibold` on the `<h1>` "Argus Dashboard" title (reduces weight from 700 → 600)

---

## Phase 13: Bug Fix — Claude Session Short ID Shows Prefix Instead of UUID

**Problem**: Claude Code session IDs take the form `claude-startup-8c20d263-780c-4a6d-9726-fdc12d17c0cf-1775067221187`. Both `SessionCard` and the `SessionPage` badge use `.slice(0, 8)` which blindly returns `claude-s` — the non-unique text prefix — instead of the meaningful UUID hex segment `8c20d263`.

**Root cause**: The 8-character slice assumes IDs start with hex characters (e.g. a raw UUID), but Claude session IDs have a human-readable prefix before the UUID portion.

**Fix**: Replace the raw `.slice(0, 8)` with a helper that extracts the first UUID-format hex segment using the regex `/[0-9a-f]{8}-[0-9a-f]{4}/`, returning its first 8 characters (e.g. `8c20d263`). Fall back to `.slice(0, 8)` for unknown formats.

- [X] T151 [US10] Add a `claudeShortId(id: string): string` helper at the top of `frontend/src/components/SessionCard/SessionCard.tsx`; the function uses `id.match(/[0-9a-f]{8}-[0-9a-f]{4}/)?.[0].slice(0, 8) ?? id.slice(0, 8)` to extract the first UUID hex segment; apply it to the `ID:` badge span replacing `session.id.slice(0, 8)` with `claudeShortId(session.id)`
- [X] T152 [P] [US10] Apply the same `claudeShortId` fix to the short-ID badge in `frontend/src/pages/SessionPage.tsx` (the `ID: {session.id.slice(0, 8)}` span around line 100); import or inline the helper
- [X] T153 Verify `cd frontend && npm run build` passes — 0 TypeScript errors

---

## Phase 14: Bug Fix — Details Page Missing Esc / Exit / Merge / Pull Commands

**Problem**: The `SessionPage` (details/drill-in page) renders a `ControlPanel` component that only provides Stop Session (SIGTERM) and a Send Prompt textarea. The Esc (interrupt), Exit, Merge, and Pull latest commands available on the dashboard cards via `SessionPromptBar` are entirely absent.

**Fix**: Replace the `ControlPanel` component in `SessionPage` with `SessionPromptBar`. `SessionPromptBar` already contains the full prompt input, Send button, and `⋮` dropdown with all four commands (Esc, Exit, Merge, Pull). The Stop Session capability can be retained as a separate destructive action below the prompt bar.

**Independent Test**: Navigate to `/sessions/:id` for an active session — the Controls section shows the prompt input + Send button + `⋮` menu; opening the menu shows Esc, Exit, Merge, Pull latest.

- [X] T154 [US11] Update `frontend/src/pages/SessionPage.tsx`: remove the `ControlPanel` import and its enclosing "Controls" card; add `import SessionPromptBar from '../components/SessionPromptBar/SessionPromptBar'`; replace the controls card with a new card titled "Controls" that renders `<SessionPromptBar session={session} />` followed by a "Stop Session" button (calls `stopMutation.mutateAsync()` with a confirm dialog, disabled when session is ended); remove the now-unused `stopMutation`, `sendMutation`, `sendPrompt`, `stopSession`, `useMutation` imports if no longer needed
- [X] T155 Verify `cd frontend && npm run build` passes — 0 TypeScript errors

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (US6 bug)**: Depends on Phase 1 (needs ControlActionType but only for type consistency — independent otherwise)
- **Phase 3 (US1)**: Depends on Phase 1. Independent of Phase 2.
- **Phase 4 (US2)**: Depends on Phase 1 and Phase 3 (`SessionCard` exists). Needs backend interrupt endpoint.
- **Phase 5 (US3)**: Depends on Phase 3 (`SessionCard` exists). Independent of Phase 4.
- **Phase 6 (US4)**: Depends on Phase 3 (`SessionCard` exists). Independent of US2/US3.
- **Phase 7 (US5)**: Depends on Phase 3. Independent of all other stories.
- **Phase 8 (Polish)**: Depends on all previous phases.

### User Story Dependencies

- **US6 (P1 bug)**: Independent — backend only, start immediately after Phase 1
- **US1 (P1)**: Independent — pure frontend layout change
- **US2 (P1)**: Depends on US1 (SessionCard structure) + new backend endpoint
- **US3 (P1)**: Depends on US1 (SessionCard structure). Independent of US2.
- **US4 (P2)**: Depends on US1 (SessionCard structure). Independent of US2/US3.
- **US5 (P3)**: Depends on US1. Trivial — 5 lines.

### Parallel Opportunities

- T115 (unit test), T117 (frontend card), T118 (session page) can all run in parallel within Phase 2
- T113, T114 can run in parallel (different files)
- T119 (E2E test skeleton), T120 (OutputPane), T121 (DashboardPage) — write test first, then T120 and T121 together
- T122 (contract test), T125 (API helper) can run in parallel within Phase 4
- T123 and T124 are sequential (controller before route)
- T126, T127, T128 can overlap once T125 is done
- T129 (E2E test), T130 (InlinePrompt component) can run in parallel

---

## Parallel Example: US2 (Quick Commands)

```bash
# Run in parallel:
Task T122: Contract test for interrupt in backend/tests/contract/sessions.test.ts
Task T125: API helper interruptSession() in frontend/src/services/api.ts

# Then sequentially:
Task T123: interruptSession() in backend/src/services/session-controller.ts
Task T124: POST /interrupt route in backend/src/api/routes/sessions.ts

# Then in parallel:
Task T126: QuickCommands component in frontend/src/components/QuickCommands/QuickCommands.tsx
Task T128: E2E tests in frontend/tests/e2e/sc-006-session-ux.spec.ts
```

---

## Implementation Strategy

### MVP First (US1 + US6 bug fix only)

1. Complete Phase 1: Type updates
2. Complete Phase 2: US6 bug fix (Claude PID)
3. Complete Phase 3: US1 two-pane layout
4. **STOP and VALIDATE**: Open dashboard, click session card → output pane opens. Claude cards show session ID.
5. Proceed to US2 (quick commands) as the next increment.

### Incremental Delivery

1. Phase 1 + Phase 2 → Claude PID visible ✓
2. + Phase 3 → Two-pane output view ✓
3. + Phase 4 → Esc/Exit/Merge/Pull commands ✓
4. + Phase 5 → Inline prompt input ✓
5. + Phase 6 → Last output preview ✓
6. + Phase 7 → Drill-in link ✓

---

## Notes

- [P] tasks = different files, no blocking dependencies between them
- Tests must FAIL before implementation (§IV)
- `SessionCard.tsx` is modified in multiple phases — take care not to conflict between T117, T127, T131, T132, T133. Work sequentially when touching the same file.
- The E2E test file `sc-006-session-ux.spec.ts` accumulates tests across phases — write the relevant describe block per phase
- Commit after each phase checkpoint

---

## Phase 15: US7 — Inactive Sessions (Priority: P2)

**Purpose**: Sessions with no activity for more than 20 minutes are visually flagged as "inactive" on the dashboard. Users can optionally hide inactive sessions via the Settings panel.

**Goal**: Any session (not `completed`/`ended`) whose `lastActivityAt` is older than 20 minutes shows an amber "inactive" badge on its card. A new Settings toggle lets users hide all inactive sessions from the dashboard.

**Independent Test**: Run the dashboard with a session whose `lastActivityAt` is >20 min ago — the card shows an amber "inactive" badge. Enable "Hide inactive sessions" in Settings — the card disappears.

**Acceptance Scenarios**:

1. **Given** a session with `lastActivityAt` more than 20 minutes ago and status not `completed`/`ended`, **When** the dashboard renders, **Then** the card shows an amber "inactive" badge.
2. **Given** a session that just received activity, **When** the card re-renders, **Then** the "inactive" badge is not shown.
3. **Given** the "Hide inactive sessions" toggle is enabled in Settings, **When** the dashboard renders, **Then** inactive sessions are not shown in any repo list.
4. **Given** a `completed` or `ended` session with old `lastActivityAt`, **When** the dashboard renders, **Then** it is NOT marked inactive (it is already ended).

### Implementation for US7

- [X] T156 [P] Create `frontend/src/utils/sessionUtils.ts` with: `export const INACTIVE_THRESHOLD_MS = 20 * 60 * 1000;` and `export function isInactive(session: Session): boolean` — returns `true` when `session.status` is not `'completed'` or `'ended'` AND `Date.now() - new Date(session.lastActivityAt).getTime() > INACTIVE_THRESHOLD_MS`; import `Session` from `'../types'`

- [X] T157 [US7] Update `frontend/src/components/SessionCard/SessionCard.tsx`: import `isInactive` from `'../../utils/sessionUtils'`; in the status pills row, add an amber "inactive" badge (`<span className="text-xs px-2 py-0.5 rounded font-medium bg-amber-100 text-amber-700">inactive</span>`) conditionally rendered when `isInactive(session)` is true; also update the card wrapper `className` to include `opacity-75` when `isInactive(session) && !selected`

- [X] T158 [P] [US7] Add `hideInactiveSessions: boolean` to the `DashboardSettings` interface in `frontend/src/types.ts` and add `hideInactiveSessions: false` to `DEFAULT_SETTINGS`

- [X] T159 [US7] Add a "Hide inactive sessions (no activity > 20 min)" toggle to `frontend/src/components/SettingsPanel/SettingsPanel.tsx` — follow the existing label+checkbox pattern, bind to `settings.hideInactiveSessions` via `onToggle('hideInactiveSessions', e.target.checked)`

- [X] T160 [US7] Update `frontend/src/pages/DashboardPage.tsx`: import `isInactive` from `'../utils/sessionUtils'`; in the `reposWithSessions` map, extend the `visibleSessions` filter chain to also filter out inactive sessions when `settings.hideInactiveSessions` is true — i.e. `!settings.hideInactiveSessions || !isInactive(s)` (applied after the existing `hideEndedSessions` filter)

- [X] T161 Run `cd frontend && npm run build` to verify 0 TypeScript errors and successful Vite bundle

**Checkpoint**: Inactive sessions show an amber badge on cards; Settings panel toggle hides them; ended sessions are unaffected

---

## Phase 16: Remove Stop Button from Details Page (Cleanup)

**Purpose**: The "Stop Session" button on the `/sessions/:id` details page is redundant now that Exit is available in the `SessionPromptBar` ⋮ dropdown menu. Remove it and all code that exists solely to support it.

**Goal**: The Controls card on the details page contains only the `SessionPromptBar`. No Stop Session button, no SIGTERM helper text, no confirmation flow.

**Independent Test**: Open any session detail page — no "Stop Session" button appears. The ⋮ menu still contains Exit.

- [X] T162 [US11] In `frontend/src/pages/SessionPage.tsx`, remove: the Stop Session button block (the `<div>` with `mt-3 pt-3 border-t` containing the button, helper text, and error span); the `handleStop` function; the `stopMutation` useMutation call; the `stopError` useState; the `useState` import (no longer used); the `useMutation` import (no longer used); the `stopSession` import from `'../services/api'`; also remove the "Controls" `<h2>` heading above `SessionPromptBar` to declutter the card

- [X] T163 Run `cd frontend && npm run build` to verify 0 TypeScript errors

**Checkpoint**: Details page Controls card contains only `SessionPromptBar`. All dead code removed.

---

## Phase 17: Unified Output Stream Rendering

**Purpose**: The right-pane `OutputPane` on the dashboard uses a minimal renderer (no timestamps, no type badges). The `SessionDetail` renderer on the details page is richer (timestamps, MSG/TOOL/RESULT/ERR/STATUS badges, tool names). Both should use the same rendering. The dark theme (bg-gray-900) is used in both places.

**Goal**: `SessionDetail` gains a `dark` prop. `OutputPane` delegates item rendering to `SessionDetail dark`. `SessionPage` Output Stream card also switches to the dark theme. No output rendering logic is duplicated.

**Independent Test**: Open the dashboard right pane → items show timestamps and type badges. Open the details page → same visual layout, same dark background.

- [X] T164 Update `frontend/src/components/SessionDetail/SessionDetail.tsx`: add an optional `dark?: boolean` prop; when `dark` is true apply dark-theme classes — wrapper `bg-gray-900 text-gray-300`, timestamp `text-gray-500`, content `text-gray-200`, type badge colors adjusted for dark bg (e.g. `bg-blue-900 text-blue-300`, `bg-purple-900 text-purple-300`, `bg-green-900 text-green-300`, `bg-red-900 text-red-300`, `bg-yellow-900 text-yellow-300`), empty-state text `text-gray-500`; default (`dark` false/absent) keeps existing light-theme classes unchanged

- [X] T165 Update `frontend/src/components/OutputPane/OutputPane.tsx`: import `SessionDetail`; replace the inline items `<div>` rendering block (the `data?.items.map(...)` section and the "No output yet…" paragraph) with `<SessionDetail sessionId={session.id} items={data?.items ?? []} dark />`; remove the now-unused inline rendering — keep the header bar, scroll container `flex-1 overflow-y-auto p-4`, and `bottomRef`; the `bottomRef` scroll-to-bottom effect stays on `OutputPane` since it owns the scroll container

- [X] T166 Update `frontend/src/pages/SessionPage.tsx` Output Stream card: wrap the `<SessionDetail>` with a dark container — change the card from `bg-white rounded-lg shadow` to `bg-gray-900 rounded-lg shadow`; update the "Output Stream" heading to `text-gray-200`; update the border to `border-gray-700`; pass `dark` prop to `<SessionDetail>`; remove the wrapping `p-4 border-b border-gray-200` header div adjusting colors to match dark theme (`border-gray-700`, `text-gray-200`)

- [X] T167 Run `cd frontend && npm run build` to verify 0 TypeScript errors

**Checkpoint**: Identical output rendering (timestamps + type badges + tool names + dark bg) in both the dashboard right pane and the details page

