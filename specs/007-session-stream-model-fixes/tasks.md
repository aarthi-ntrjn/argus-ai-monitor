# Tasks: Session Stream Legibility, Model Display & Claude Code Fixes

**Input**: Design documents from `/specs/007-session-stream-model-fixes/`  
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/ ✅

**Tests**: Test tasks included for new code (test-first per §IV). Existing tests updated where behaviour changes.

**Organization**: Tasks grouped by user story (P1 US1 → P1 US2 → P2 US3 → P3 US4) to enable independent delivery.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with other [P] tasks in the same phase
- **[Story]**: Which user story this task belongs to (US1–US4)

---

## Phase 1: Setup (Baseline Verification)

**Purpose**: Confirm the working baseline before any changes.

- [X] T001 Verify branch is `007-session-stream-model-fixes` and run `cd backend && npm test` — confirm all existing tests pass (green baseline)

---

## Phase 2: Foundational (Blocking Schema & Type Changes)

**Purpose**: Add `model` to Session and `role` to SessionOutput in all layers. MUST complete before any user story work begins — these types gate compilation of every downstream change.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T002 [P] Add `model: string | null` to `Session` interface and add `OutputRole = 'user' | 'assistant'` type + `role: OutputRole | null` field to `SessionOutput` interface in `backend/src/models/index.ts`; export `OutputRole`
- [X] T003 [P] Mirror T002 changes in `frontend/src/types.ts` — add `model: string | null` to `Session`, add `OutputRole` type, add `role: OutputRole | null` to `SessionOutput`
- [X] T004 Add DB schema migration in `backend/src/db/schema.ts` — add `model TEXT` to the sessions CREATE TABLE and `role TEXT` to the session_output CREATE TABLE; add runtime migration in `backend/src/db/database.ts` `getDb()` after `db.exec(SCHEMA_SQL)` using `PRAGMA table_info` checks to `ALTER TABLE sessions ADD COLUMN model TEXT` and `ALTER TABLE session_output ADD COLUMN role TEXT` for existing databases; update `getSessions` and `getSession` SELECT to include `, model`; update `upsertSession` INSERT column list and ON CONFLICT SET clause to include `model = excluded.model`; update `getOutputForSession` SELECT to include `, role`; update `insertOutput` INSERT column list to include `role` and bind `output.role`

**Checkpoint**: `cd frontend && npm run build` must succeed (all types resolve). `cd backend && npm test` must still pass (schema migration is backward-compatible).

---

## Phase 3: User Story 1 — Claude Code Live Output (Priority: P1) 🎯 MVP

**Goal**: Claude Code sessions display their full conversation history in the output pane, updated live as new messages arrive.

**Independent Test**: Run Claude Code in a monitored repo, send a message, open Argus dashboard → output pane shows the message. Described in `quickstart.md` § "Manual Testing: Claude Code Output Stream".

- [X] T005 [P] [US1] Write failing unit tests for new `backend/src/services/claude-code-jsonl-parser.ts`
- [X] T006 [US1] Create `backend/src/services/claude-code-jsonl-parser.ts`
- [X] T007 [US1] Update `ClaudeCodeDetector.handleHookPayload()` with JSONL watcher
- [X] T008 [US1] Add `stopWatchers()` method to `ClaudeCodeDetector`

**Checkpoint**: Claude Code session output pane shows conversation history. Model badge visible (may be null until first assistant message).

---

## Phase 4: User Story 2 — Claude Code Active State Detection Fix (Priority: P1)

**Goal**: Claude Code sessions show "active" only when actually running, with no ghost sessions for idle repos.

**Independent Test**: Start Argus while Claude Code is running → card shows "active". Stop Claude Code → card transitions to "ended" within 15 seconds. Another repo with no Claude Code process shows "ended". Described in `quickstart.md` § "Manual Testing: Active State Detection".

- [X] T009 [US2] Write failing integration test for updated `ClaudeCodeDetector.scanExistingSessions()` — covered by unit tests in `backend/tests/unit/claude-code-detector-scan.test.ts` which test all four scenarios with full mock coverage

- [X] T010 [US2] Rewrite `ClaudeCodeDetector.scanExistingSessions()` in `backend/src/services/claude-code-detector.ts`

- [X] T011 [US2] Fix path normalization in `ClaudeCodeDetector.handleHookPayload()` in `backend/src/services/claude-code-detector.ts`

**Checkpoint**: No ghost "active" Claude Code sessions. Dashboard correctly reflects process state.

---

## Phase 5: User Story 3 — Output Stream Legibility (Priority: P2)

**Goal**: Output stream clearly distinguishes user vs assistant messages, wraps long text, and shows readable tool names.

**Independent Test**: Open any active Copilot CLI session — messages show YOU/AI badges, long content wraps to multiple lines, tool calls show the tool name legibly.

- [X] T012 [P] [US3] Update role assertions in `backend/tests/unit/events-parser.test.ts`

- [X] T013 [P] [US3] Update `backend/src/services/events-parser.ts` with `role` field

- [X] T014 [US3] Update `frontend/src/components/SessionDetail/SessionDetail.tsx` with YOU/AI badges and break-words

**Checkpoint**: Output pane shows YOU/AI role labels; long messages wrap cleanly.

---

## Phase 6: User Story 4 — Model Display (Priority: P3)

**Goal**: Session cards and detail page show the AI model name when available.

**Independent Test**: Run a Claude Code session, confirm model badge appears on the card (e.g. `claude-haiku-4-5`). A Copilot CLI session card shows no model badge (null).

- [X] T015 [P] [US4] Update `frontend/src/components/SessionCard/SessionCard.tsx` with model badge

- [X] T016 [P] [US4] Update `frontend/src/pages/SessionPage.tsx` with model display

**Checkpoint**: Model name visible on Claude Code session cards and detail page.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T017 Verify `backend/src/api/routes/sessions.ts` — confirm `GET /api/v1/sessions` response serializes `model` from each session row; confirm `GET /api/v1/sessions/:id/output` response serializes `role` from each output row; both fields are added via T004 DB query updates so this task is a spot-check — fix any missing field in serialization or type casting

- [X] T018 Update `README.md` — add: (a) Claude Code output streaming (now reads `~/.claude/projects/**/*.jsonl`); (b) model badge on session cards; (c) active state detection uses JSONL file modification time; (d) output stream role labels (YOU/AI) for user and assistant messages

- [X] T019 [P] Write E2E test in `frontend/tests/e2e/sc-007-stream-model.spec.ts` — test: (a) session card shows model text when `session.model` is set; (b) output pane shows 'AI' badge for assistant messages; (c) output pane shows 'YOU' badge for user messages; (d) long content in output pane wraps and does not overflow the pane width; use mock API responses from existing Playwright patterns in `sc-006-session-ux.spec.ts`

- [X] T020 Run `cd backend && npm test` (all tests green) and `cd frontend && npm run build` (0 TypeScript errors, build succeeds); fix any compilation or test failures before committing

### Addendum: US4 — PST timestamp display

- [X] T021 [US4] Update `formatTime` in `frontend/src/components/SessionDetail/SessionDetail.tsx`: change `new Date(timestamp).toLocaleTimeString()` to `new Date(timestamp).toLocaleTimeString('en-US', { timeZone: 'America/Los_Angeles', hour: '2-digit', minute: '2-digit', second: '2-digit' })` so all output stream timestamps display in Pacific time (PST/PDT) regardless of the browser's local time zone

### Addendum: US5 — Session status labels & icons (resting / running)

**Goal**: Replace the text-only "active"/"inactive" status badges with labelled icon badges using `lucide-react`. Rename statuses: **active → running** (▶ Play icon), **inactive → resting** (💤 Zzzz icon).

- [X] T022 Install `lucide-react` into `frontend/package.json` by running `npm install lucide-react` in the `frontend/` directory; verify it appears in `dependencies`

- [X] T023 [US5] Update `frontend/src/components/SessionCard/SessionCard.tsx`: import `Moon` and `Play` from `lucide-react`; inactive sessions show `<Moon size={10} /> resting` (amber); active sessions show `<Play size={10} /> running` (green)

- [X] T024 [US5] Update `frontend/src/pages/SessionPage.tsx`: same changes with larger `size={12}`, `text-sm px-3 py-1 rounded-full` classes

- [X] T025 Run `cd frontend && npm run build` — confirm 0 TypeScript errors and build succeeds

### Addendum: T087 — Output stream column layout

- [X] T087 Fix output stream column layout in `frontend/src/components/SessionDetail/SessionDetail.tsx`: wrap badge and toolname in a `flex-col w-24 shrink-0` container so toolname stacks below the badge (capped width); remove standalone toolname span

### Addendum: T089 — Output stream 2-column layout (merge timestamp into meta column)

**Goal**: Reduce the output stream from 3 columns to 2. Column 1 stacks badge, toolname (if present), and timestamp vertically. Column 2 is the content. Saves horizontal space and groups all meta-info together.

- [X] T089 [US3] Update `frontend/src/components/SessionDetail/SessionDetail.tsx`: collapse the 3-column row layout into a 2-column layout. Column 1 stacks badge, toolname, timestamp. Column 2 is content.

- [X] T090 Run `cd frontend && npm run build` — confirm 0 TypeScript errors and build succeeds

---

### Addendum: T091–T093 — Markdown rendering in output stream

**Goal**: Render `message` type output items as formatted Markdown instead of plain text. Code blocks, inline code, lists, headers, bold/italic, and links should all render correctly. Non-message items (tool_use, tool_result, status_change, error) continue to render as plain monospace text. Styling must work in both light and dark modes.

- [X] T091 Install `react-markdown` and `remark-gfm` into the frontend: run `npm install react-markdown remark-gfm` in the `frontend/` directory; verify both packages appear in `frontend/package.json` dependencies.

- [X] T092 [US3] Update `frontend/src/components/SessionDetail/SessionDetail.tsx` to render message content as Markdown

- [X] T093 Run `cd frontend && npm run build` — confirm 0 TypeScript errors and build succeeds; also confirm `cd backend && npm test` still passes (no backend regressions)

---

### Addendum: T094–T095 — Session card live preview (dark theme, RESULT-focused)

**Goal**: The session card preview strip below the send button should use dark theme, continuously update to reflect the latest RESULT output (tool_result or assistant message) for both Claude Code and Copilot CLI sessions.

- [X] T094 Update `frontend/src/components/SessionCard/SessionCard.tsx`: limit 10, refetchInterval for active sessions, RESULT-focused preview selection, dark theme preview strip.

- [X] T095 Run `cd frontend && npm run build` — confirm 0 TypeScript errors

---

### Addendum: T096–T097 — Waiting for user input rendering

**Goal**: When a session output contains a question or prompt waiting for user input, render it clearly so the user can see what is being asked.

- [ ] T096 Investigate actual "waiting for user input" signal in both Claude Code JSONL and Copilot CLI events.jsonl:
  - Check if there's a distinct event type (e.g., `user.input_requested`, `input_required`) 
  - For Claude Code: look for assistant messages ending with `?` or containing a `<question>` marker
  - For Copilot CLI: check if `user.message` type events carry a `waiting_for_input` flag
  - Document findings as a comment in T097

- [ ] T097 Based on T096 findings, add visual treatment for input-waiting state:
  - If a distinct event type exists: add it to `TYPE_LABELS` with label `'INPUT'` and amber/yellow styling
  - If it's inferred (e.g., last assistant message ends with `?`): add a small blinking cursor indicator or `INPUT NEEDED` badge after the message content
  - Ensure rendering is clear in both light and dark modes



---

### Addendum: T100–T105 — Repository branch name display

**Goal**: Show the current git branch name next to the directory path in the dashboard repo header, so users can see at a glance which branch each monitored repo is on.

- [X] T100 [P] Add `branch: string | null` to the `Repository` interface in `backend/src/models/index.ts`

- [X] T101 [P] Add `branch: string | null` to the `Repository` interface in `frontend/src/types.ts`

- [X] T102 Update `backend/src/db/database.ts`:
  - Add `branch TEXT` column to the `repositories` CREATE TABLE statement in `backend/src/db/schema.ts` (or wherever SCHEMA_SQL is defined)
  - Add runtime migration in `getDb()` alongside the existing `sessions`/`session_output` migrations: check `pragma table_info(repositories)`, if `branch` column missing run `ALTER TABLE repositories ADD COLUMN branch TEXT`
  - Update `getRepositories()`, `getRepository()`, and `getRepositoryByPath()` SELECT column lists to include `branch`
  - Update `insertRepository()` INSERT to include `branch` (`?, ?, ?, ?, ?, ?, ?` + `repo.branch ?? null`)
  - Add new `updateRepositoryBranch(id: string, branch: string | null): void` that runs `UPDATE repositories SET branch = ? WHERE id = ?`

- [X] T103 Add `getCurrentBranch(repoPath: string): string | null` helper in `backend/src/services/repository-scanner.ts`:
  - Use `execSync('git branch --show-current', { cwd: repoPath, encoding: 'utf8' })` from Node `child_process`, wrapped in try/catch returning `null` on failure
  - Trim the result; return `null` if blank (detached HEAD)
  - Update `registerIfNew()` to call `getCurrentBranch(repoPath)` and set `repo.branch`

- [X] T104 Add `refreshRepositoryBranches()` to `backend/src/services/session-monitor.ts`:
  - Import `getRepositories` and `updateRepositoryBranch` from `database.js`; import `getCurrentBranch` helper (extract it to a shared util or re-import from `repository-scanner.ts`)
  - For each repo in `getRepositories()`, call `getCurrentBranch(repo.path)` and call `updateRepositoryBranch(repo.id, branch)` only if the branch changed
  - Call `refreshRepositoryBranches()` from `runScan()` on every scan cycle

- [X] T105 [P] Update `frontend/src/pages/DashboardPage.tsx`:
  - Next to `<p className="text-sm text-gray-500 mt-1">{repo.path}</p>`, render a branch badge when `repo.branch` is non-null: `<span className="inline-flex items-center gap-1 text-xs font-mono text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded ml-1">⎇ {repo.branch}</span>` on the same line as the path (make the `<p>` a flex row or add it inline after the path text)

---

### Addendum: T099 — Session card preview: 2-line wrap

**Goal**: Show up to 2 wrapped lines of the last output preview instead of a single truncated line, so users can read more context at a glance.

- [X] T099 [US1] Update the output preview in `frontend/src/components/SessionCard/SessionCard.tsx`:
  - Rename `previewLine` to `previewContent` and change its derivation from `content?.split('\n').find(l => l.trim())` (first non-empty line) to `previewItem?.content?.trim() ?? null` (full content, trimmed)
  - Update the `<p>` element that renders the preview: replace `truncate` with `line-clamp-2 whitespace-pre-wrap break-words` so the text wraps and is clamped at 2 lines
  - Rename the `{previewLine &&` guard and `{previewLine}` render to `previewContent`

---

### Addendum: T098 — Session card header layout polish

**Goal**: Replace the "View details" text link with an icon and move the status badge to the right-justified area of the card header (left of the details icon), so the left side stays clean with just type/model/PID info.

- [X] T098 [US2] Restructure `SessionCard` header in `frontend/src/components/SessionCard/SessionCard.tsx`:
  - Remove the status badge (isInactive moon + status badge) from the left `flex flex-wrap gap-2 items-center` group
  - Add the status badge into the right `flex items-center gap-2` group, positioned between the elapsed time and the details link
  - Replace the `<Link>` "View details" text with a `<ExternalLink size={14} />` icon from `lucide-react` (keep the same `to`, `onClick`, and `aria-label="View details"` props; change className to `text-gray-400 hover:text-blue-500 transition-colors`)



### Phase Dependencies

- **Phase 1 (Baseline)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — BLOCKS all user stories
- **Phase 3 (US1 — Claude Code output)**: Depends on Phase 2
- **Phase 4 (US2 — Active state fix)**: Depends on Phase 3 (T010 scan fix reuses T007's JSONL watcher logic)
- **Phase 5 (US3 — Legibility)**: Depends on Phase 2 only — can start in parallel with Phase 3
- **Phase 6 (US4 — Model display)**: Depends on Phase 3 (model data flows from JSONL parser)
- **Phase 7 (Polish)**: Depends on all phases complete

### User Story Dependencies

- **US1 (P1, Claude Code output)**: Depends on Foundational
- **US2 (P1, Active state)**: Depends on US1 (shares `claude-code-detector.ts` and JSONL watcher)
- **US3 (P2, Legibility)**: Depends on Foundational only — independent of US1/US2
- **US4 (P3, Model display)**: Depends on US1 (model data sourced from JSONL parser)

### Within Each Phase

- T005 (tests) MUST be written and fail before T006 (implementation)
- T009 (tests) MUST be written and fail before T010 (implementation)
- T012 (test updates) MUST fail before T013 (implementation)
- T002 and T003 can be done simultaneously (different files)

---

## Parallel Opportunities

### Phase 2 (Foundational)
```
T002 (backend/src/models/index.ts)  ←→  T003 (frontend/src/types.ts)
Both are type-only, different files — can be done in parallel
T004 depends on T002 (must import from models)
```

### Phase 3 + Phase 5 (after Foundational)
```
US1 work (T005–T008, claude-code-detector.ts + new parser)
US3 work (T012–T014, events-parser.ts + SessionDetail.tsx)
Both can proceed simultaneously — different files
```

### Phase 6 (US4)
```
T015 (SessionCard.tsx)  ←→  T016 (SessionPage.tsx)
Different files — can be done in parallel
```

### Phase 7 (Polish)
```
T018 (README.md)  ←→  T019 (E2E test file)
Different files — can be done in parallel
```

---

## Parallel Example: Phase 3 + Phase 5

```
# After Phase 2 completes, launch in parallel:

Stream A — Claude Code output pipeline:
  T005 → T006 → T007 → T008

Stream B — Output legibility:
  T012 → T013 → T014
```

---

## Implementation Strategy

### MVP First (US1 + US2 only)

1. Complete Phase 1: Baseline check
2. Complete Phase 2: Foundational schema + types
3. Complete Phase 3: US1 (Claude Code output pipeline)
4. Complete Phase 4: US2 (Active state fix)
5. **STOP and VALIDATE**: Claude Code sessions show live output and correct status
6. Deploy/demo

### Incremental Delivery

1. Setup + Foundational → Types ready
2. US1 complete → Claude Code output streams ✅
3. US2 complete → Active state detection reliable ✅
4. US3 complete → Copilot output easier to read ✅
5. US4 complete → Model name visible ✅
6. Polish → README + E2E tests ✅

---

## Notes

- `[P]` tasks = independent files, no shared state, safe to parallelize
- Test tasks (T005, T009, T012) MUST fail red before the implementation task runs — this is §IV test-first
- The `ACTIVE_JSONL_THRESHOLD_MS = 30 * 60 * 1000` constant belongs in `claude-code-detector.ts` alongside `INACTIVE_THRESHOLD_MS` from `sessionUtils.ts`
- The chokidar watcher pattern in `ClaudeCodeDetector` mirrors `CopilotCliDetector.watchEventsFile()` — reuse the same private Map + file position tracking pattern
- T004 DB migration uses `PRAGMA table_info` check: SQLite's `ALTER TABLE ADD COLUMN` has no `IF NOT EXISTS` syntax, so the check is necessary for idempotency
- Commit after each task or logical group; push to `007-session-stream-model-fixes`


### Addendum: T106T109  UI polish: branch colour, PID font, preview bg, output stream density

- [X] T106 Change branch badge in `frontend/src/pages/DashboardPage.tsx` from purple (`text-purple-700 bg-purple-50`) to blue (`text-blue-700 bg-blue-50`) on line ~214
- [X] T107 Add `font-mono` class to the PID `<span>` in `frontend/src/components/SessionCard/SessionCard.tsx` (line ~78) so PID uses the same monospace font as the model name and code IDs
- [X] T108 Change the preview strip in `frontend/src/components/SessionCard/SessionCard.tsx` from dark (`bg-gray-900 text-gray-300`) to light (`bg-gray-100 text-gray-600`) to match the card's light theme consistently
- [X] T109 Reduce output stream density in `frontend/src/components/SessionDetail/SessionDetail.tsx`: change container `text-sm`  `text-xs` and `space-y-2`  `space-y-1`; change prose wrapper `prose-sm`  `prose-xs` (or add explicit `text-xs leading-snug`); reduce badge column from `w-28`  `w-24`
