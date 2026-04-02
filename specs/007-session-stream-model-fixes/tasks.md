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

- [ ] T001 Verify branch is `007-session-stream-model-fixes` and run `cd backend && npm test` — confirm all existing tests pass (green baseline)

---

## Phase 2: Foundational (Blocking Schema & Type Changes)

**Purpose**: Add `model` to Session and `role` to SessionOutput in all layers. MUST complete before any user story work begins — these types gate compilation of every downstream change.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T002 [P] Add `model: string | null` to `Session` interface and add `OutputRole = 'user' | 'assistant'` type + `role: OutputRole | null` field to `SessionOutput` interface in `backend/src/models/index.ts`; export `OutputRole`
- [ ] T003 [P] Mirror T002 changes in `frontend/src/types.ts` — add `model: string | null` to `Session`, add `OutputRole` type, add `role: OutputRole | null` to `SessionOutput`
- [ ] T004 Add DB schema migration in `backend/src/db/schema.ts` — add `model TEXT` to the sessions CREATE TABLE and `role TEXT` to the session_output CREATE TABLE; add runtime migration in `backend/src/db/database.ts` `getDb()` after `db.exec(SCHEMA_SQL)` using `PRAGMA table_info` checks to `ALTER TABLE sessions ADD COLUMN model TEXT` and `ALTER TABLE session_output ADD COLUMN role TEXT` for existing databases; update `getSessions` and `getSession` SELECT to include `, model`; update `upsertSession` INSERT column list and ON CONFLICT SET clause to include `model = excluded.model`; update `getOutputForSession` SELECT to include `, role`; update `insertOutput` INSERT column list to include `role` and bind `output.role`

**Checkpoint**: `cd frontend && npm run build` must succeed (all types resolve). `cd backend && npm test` must still pass (schema migration is backward-compatible).

---

## Phase 3: User Story 1 — Claude Code Live Output (Priority: P1) 🎯 MVP

**Goal**: Claude Code sessions display their full conversation history in the output pane, updated live as new messages arrive.

**Independent Test**: Run Claude Code in a monitored repo, send a message, open Argus dashboard → output pane shows the message. Described in `quickstart.md` § "Manual Testing: Claude Code Output Stream".

- [ ] T005 [P] [US1] Write failing unit tests for new `backend/src/services/claude-code-jsonl-parser.ts` in `backend/tests/unit/claude-code-jsonl-parser.test.ts` — cover: (a) `file-history-snapshot` entries are skipped; (b) `user` entry with plain string content → `SessionOutput` with `type:'message'`, `role:'user'`; (c) `user` entry with `text` content block → `type:'message'`, `role:'user'`; (d) `user` entry with `tool_result` content block → `type:'tool_result'`, `role:null`, `toolName` set to `tool_use_id`; (e) `assistant` entry with text block → `type:'message'`, `role:'assistant'`; (f) `assistant` entry with `tool_use` block → `type:'tool_use'`, `role:null`, `toolName:block.name`, `content:JSON.stringify(block.input)`; (g) mixed entry with both text + tool_use blocks emits two `SessionOutput` items; (h) malformed/partial JSON line returns empty array; (i) `parseModel()` returns `message.model` from first assistant entry, null otherwise — tests must fail (red) before implementation

- [ ] T006 [US1] Create `backend/src/services/claude-code-jsonl-parser.ts` — export `parseClaudeJsonlLine(line: string, sessionId: string, sequenceNumber: number): SessionOutput[]` (returns array because one JSONL entry can yield multiple output items for mixed-content assistant messages); export `parseModel(line: string): string | null` returning `entry.message.model` when `entry.type === 'assistant'`; skip entries where `type === 'file-history-snapshot'`; handle `isSidechain` entries the same as root entries (subagent activity is real activity); parse `content` as string or array of content blocks per data-model.md mapping table; catch all JSON.parse errors and return `[]`

- [ ] T007 [US1] Update `ClaudeCodeDetector.handleHookPayload()` in `backend/src/services/claude-code-detector.ts` — after `upsertSession()` on a `SessionStart` or new session creation, resolve the JSONL file path as `join(homedir(), '.claude', 'projects', claudeProjectDirName(repo.path), session_id + '.jsonl')`; if the file exists, load and parse all existing lines via `parseClaudeJsonlLine()` and call `this.outputStore.insertOutput()` with each result; then start a chokidar file watcher (same pattern as `CopilotCliDetector.watchEventsFile()`) that reads new lines on `change` events; track file positions per sessionId in a private `Map`; when the first assistant entry is parsed, call `upsertSession({ ...session, model: parsedModel })` to persist the model; also add `private outputStore = new OutputStore()` field to `ClaudeCodeDetector` and import `OutputStore`

- [ ] T008 [US1] Add `stopWatchers()` method to `ClaudeCodeDetector` in `backend/src/services/claude-code-detector.ts` (matches pattern from `CopilotCliDetector`) — close all chokidar watchers on shutdown; call `stopWatchers()` in the backend's server shutdown handler (wherever `CopilotCliDetector.stopWatchers()` is already called)

**Checkpoint**: Claude Code session output pane shows conversation history. Model badge visible (may be null until first assistant message).

---

## Phase 4: User Story 2 — Claude Code Active State Detection Fix (Priority: P1)

**Goal**: Claude Code sessions show "active" only when actually running, with no ghost sessions for idle repos.

**Independent Test**: Start Argus while Claude Code is running → card shows "active". Stop Claude Code → card transitions to "ended" within 15 seconds. Another repo with no Claude Code process shows "ended". Described in `quickstart.md` § "Manual Testing: Active State Detection".

- [ ] T009 [US2] Write failing integration test for updated `ClaudeCodeDetector.scanExistingSessions()` in `backend/tests/integration/claude-code-detector.test.ts` — add test cases: (a) repo with JSONL file modified < 30 min ago + Claude process running → session re-activated to 'active'; (b) repo with JSONL file modified > 30 min ago → session stays 'ended' even if Claude process is running; (c) repo with JSONL file modified < 30 min ago but NO Claude process running → session stays 'ended'; (d) two repos each with their own JSONL files — only the recently-modified one gets activated; tests must fail (red) before fix

- [ ] T010 [US2] Rewrite `ClaudeCodeDetector.scanExistingSessions()` in `backend/src/services/claude-code-detector.ts` — replace the current per-repo logic: instead of re-activating any ended session whenever any Claude process is found, for each repo: (1) resolve the JSONL path for all existing sessions (most recent first); (2) check if the JSONL file exists AND `statSync(jsonlPath).mtime` is within 30 minutes of now; (3) only if BOTH conditions hold (any Claude process running AND JSONL file recently modified) re-activate the session; add a constant `ACTIVE_JSONL_THRESHOLD_MS = 30 * 60 * 1000` next to the file; after activating, start the chokidar watcher (T007 watcher logic) on the JSONL file

- [ ] T011 [US2] Fix path normalization in `ClaudeCodeDetector.handleHookPayload()` in `backend/src/services/claude-code-detector.ts` — when calling `getRepositoryByPath(cwd)`, first apply `normalize(cwd)` (already imported from 'path') to canonicalize separators; note that `getRepositoryByPath` already uses `LOWER()` in SQL (per database.ts line 44) so case-insensitivity is handled; also ensure the `cwd` field from the hook payload is always trimmed of trailing slashes before lookup

**Checkpoint**: No ghost "active" Claude Code sessions. Dashboard correctly reflects process state.

---

## Phase 5: User Story 3 — Output Stream Legibility (Priority: P2)

**Goal**: Output stream clearly distinguishes user vs assistant messages, wraps long text, and shows readable tool names.

**Independent Test**: Open any active Copilot CLI session — messages show YOU/AI badges, long content wraps to multiple lines, tool calls show the tool name legibly.

- [ ] T012 [P] [US3] Update role assertions in `backend/tests/unit/events-parser.test.ts` — for each existing test case, add assertion that `result.role` equals the expected value: `'user'` for `user.message` events, `'assistant'` for `assistant.message` events, `null` for `tool.execution_start`, `tool.execution_complete`, `session.start`; these assertions must fail (red) before T013

- [ ] T013 [P] [US3] Update `backend/src/services/events-parser.ts` — add `role: OutputRole | null` to the returned `SessionOutput` object; set `role: 'user'` when `event.type === 'user.message'`, `role: 'assistant'` when `event.type === 'assistant.message'`, `role: null` for all other types; import `OutputRole` from `'../models/index.js'`

- [ ] T014 [US3] Update `frontend/src/components/SessionDetail/SessionDetail.tsx` — (a) update `TYPE_LABELS` to be role-aware: when `item.type === 'message'` use `item.role === 'user'` → badge label `'YOU'` with `light:'bg-gray-100 text-gray-600'` / `dark:'bg-gray-700 text-gray-400'`; `item.role === 'assistant'` → badge label `'AI'` with existing blue colors; (b) change `break-all` class on the content `<span>` to `break-words whitespace-pre-wrap` so long messages wrap at word boundaries; (c) ensure the content span has `min-w-0` to prevent flex overflow

**Checkpoint**: Output pane shows YOU/AI role labels; long messages wrap cleanly.

---

## Phase 6: User Story 4 — Model Display (Priority: P3)

**Goal**: Session cards and detail page show the AI model name when available.

**Independent Test**: Run a Claude Code session, confirm model badge appears on the card (e.g. `claude-haiku-4-5`). A Copilot CLI session card shows no model badge (null).

- [ ] T015 [P] [US4] Update `frontend/src/components/SessionCard/SessionCard.tsx` — after the session type icon, render `session.model` when non-null as a small inline badge: `<span className="text-[10px] text-gray-400 font-mono truncate max-w-[120px]">{session.model}</span>`; position it in the card header row alongside the existing type icon and session ID

- [ ] T016 [P] [US4] Update `frontend/src/pages/SessionPage.tsx` — add model display in the session detail header: when `session.model` is non-null, render it as a small gray monospace tag (e.g. `<span className="text-xs text-gray-500 font-mono">{session.model}</span>`) next to the existing session type and status badges

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

- [ ] T089 [US3] Update `frontend/src/components/SessionDetail/SessionDetail.tsx`: collapse the 3-column row layout (`timestamp | badge+toolname | content`) into a 2-column layout. Column 1 (`flex-col gap-0.5 w-28 shrink-0`): badge (self-start), toolname below badge (if present, truncate), timestamp below those (`text-[10px]` for de-emphasis). Column 2 (`min-w-0 break-words whitespace-pre-wrap`): content unchanged. Remove the standalone timestamp `<span>` that was previously its own column.

- [ ] T090 Run `cd frontend && npm run build` — confirm 0 TypeScript errors and build succeeds

---

## Dependencies & Execution Order

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
