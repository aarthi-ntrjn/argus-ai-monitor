# Bug Learnings

Retrospective entries for every bug fixed via the `/bug` skill, plus design retrospectives for architectural decisions that turned out to be more complex than necessary.
Each entry explains what went wrong, why it was missed, and how to prevent it.

---

## Feature 020 — PTY prompt delivery was over-engineered

**Date**: 2026-04-07
**Context**: Feature 020 added prompt delivery to Claude Code and Copilot CLI sessions. The requirement was: user types a prompt in the Argus dashboard, it reaches the running AI tool process.
**What was built**: A full PTY launcher (`argus launch`) — a separate CLI process the user runs instead of `claude` or `gh copilot`. It spawns the tool in a PTY via node-pty, holds the PTY master, connects back to the Argus backend over a `/launcher` WebSocket, and writes prompts to PTY stdin on demand. Significant surface area: PtyRegistry, ArgusLaunchClient, launcher WebSocket route, DB migration, launchMode field, frontend badge changes, 7 new test files.
**The simpler solution that was missed**: The backend could call `start powershell -NoExit -Command "argus launch claude"` (Windows) or the Mac equivalent to open a new OS terminal window running the launcher. The terminal window is the PTY host — the user sees the full interactive Claude Code UI in their own terminal emulator. The launcher connects back via the existing `/launcher` WebSocket exactly as today. No change to the launch flow, no new complexity, just a `POST /api/v1/sessions/launch` endpoint that spawns a terminal window process. The frontend shows a "Launch" button; the rest is identical. Even simpler: a "Copy launch command" button that writes the command to the clipboard — zero backend work, works everywhere.
**Why it was missed**: The clarification phase focused on the delivery mechanism (how does text reach the process stdin) rather than the session startup flow (how does the session start). The PTY infrastructure question was solved correctly; the spawn-a-terminal-window shortcut was never considered because the framing was "Argus must own the PTY" rather than "Argus must initiate the session."
**How to prevent**: When a feature requires controlling an interactive subprocess, ask first: can the OS terminal emulator do the heavy lifting? Spawning a visible terminal window with a command is almost always simpler than building a headless PTY proxy. Only build the proxy if you need to render the terminal output yourself (e.g., in-browser xterm.js). If the user just needs to see the output in their own terminal, open their terminal.

---

## T109 — Adding a reminder does not appear in the list

**Date**: 2026-04-05
**Symptom**: After typing a reminder and clicking Add, the list did not update — the new item was invisible until a full page reload.
**Root cause**: `useTodos.ts` imported `queryClient` directly from `services/api.ts` and called `queryClient.invalidateQueries` on it after each mutation. But `<QueryClientProvider>` in `App.tsx` uses a *different* `QueryClient` instance created locally. React Query hooks (`useQuery`) subscribe to the provider's client, so invalidating the wrong instance had no effect — the todos query was never marked stale and never refetched.
**Why it was missed**: Unit tests for `TodoPanel` mock the `useTodos` hooks entirely, bypassing the query client wiring. No test exercised the actual hook + `QueryClient` integration path.
**How to prevent**: Always use `useQueryClient()` from `@tanstack/react-query` inside custom hooks instead of importing a module-level `QueryClient` instance. The module-level export in `api.ts` is for imperative callers (e.g., event handlers) but hooks must use the context hook.
**Fix summary**: Replaced `import { queryClient } from '../services/api'` with `useQueryClient()` inside each of `useCreateTodo`, `useToggleTodo`, and `useDeleteTodo` in `frontend/src/hooks/useTodos.ts`.

---

## T073 — Copilot CLI sessions not detected

**Date**: 2026-04-01
**Symptom**: No Copilot CLI sessions ever appeared in the dashboard, even when sessions were actively running.
**Root cause**: `js-yaml` (v4) auto-coerces ISO 8601 timestamp strings in YAML into JavaScript `Date` objects. `processSessionDir` in `copilot-cli-detector.ts` passed those `Date` objects directly to `upsertSession`, which tried to bind them to SQLite. `better-sqlite3` only accepts strings/numbers/null: it threw on the first `Date` field. The `try/catch` in `scan()` swallowed the error silently, causing every session directory to return `null`.
**Why it was missed**: The test suite mocked `fs.readdir` / `yaml.load` with plain-string dates, so the coercion never triggered in tests. No test asserted that session objects were actually inserted into the DB after parsing real YAML with timestamp fields.
**How to prevent**:
- When parsing external YAML/JSON into DB-bound types, always validate or coerce at the boundary: never assume string fields arrive as strings.
- Any `try/catch` that silences errors should `console.warn` the error so failures surface during development.
- Add integration tests that pass **real fixture files** (not mocked values) through the full parse → insert pipeline.
**Fix summary**: Added `toIso(val: string | Date)` helper in `copilot-cli-detector.ts`; coerces `created_at`/`updated_at` to ISO strings via `new Date(val).toISOString()` before constructing the `Session` object.

---

## T074 — Claude Code sessions marked ended on server restart

**Date**: 2026-04-01
**Symptom**: After restarting the Argus server, all Claude Code sessions appeared as `ended` in the dashboard even though Claude was still actively running.
**Root cause**: `reconcileStaleSessions()` in `session-monitor.ts` used `if (!session.pid || ...)` to decide whether to mark a session ended. `!null === true` in JavaScript, so every Claude Code session created via hooks (which always store `pid: null`) was unconditionally marked `ended` on every startup.
**Why it was missed**: The original T072 task description explicitly said to mark sessions ended "whose pid is null": that was incorrect guidance baked into the spec. There were no integration tests for `reconcileStaleSessions()` behaviour with null-PID sessions, so the bug shipped with the fix.
**How to prevent**:
- Never use falsy checks (`!value`) to guard null vs zero/absent: use explicit `!= null` comparisons when null has semantic meaning distinct from 0 or undefined.
- When a session field can legitimately be null (no PID assigned), document what null means and handle it explicitly in any code that branches on that field.
- Add regression tests for startup reconciliation covering both the null-PID (skip) and dead-PID (end) cases.
**Fix summary**: Changed condition in `reconcileStaleSessions()` from `!session.pid ||` to `session.pid != null &&` so sessions without a known PID are skipped; added two regression tests in `tests/unit/session-monitor.test.ts`.

---

## T075 — Claude Code sessions not re-detected on Argus restart (scanExistingSessions broken on Windows)

**Date**: 2026-04-01
**Symptom**: After server restart, Claude Code sessions continued to show as `ended` even after the T074 fix, because the T074 fix only prevented future incorrect marking: already-ended sessions were never restored.
**Root cause**: `scanExistingSessions()` in `claude-code-detector.ts` required `psList` to return a `cwd` property per process to match the project path. On Windows, `psList` (backed by WMIC/tasklist) never returns `cwd`. Every `matchedProcess` lookup returned `undefined`, so the method was a complete no-op on Windows: it never created or re-activated any session.
**Why it was missed**: The method was written and tested on a non-Windows platform or with a mock that provided `cwd`. There were no tests exercising the Windows code path, and the `/* ignore */` catch block hid any errors. The T074 fix was also incomplete because it addressed incorrect ending at startup but didn't address the inability to re-discover running Claude sessions.
**How to prevent**:
- Test platform-specific code (psList on Windows) explicitly. If a function depends on a property that may not exist on all platforms, validate that assumption with a contract test or conditional fallback.
- Any feature that "silently does nothing" (all catch blocks suppressed, no logging) needs an explicit integration test that verifies a session WAS created/updated, not just that no exception was thrown.
- When fixing a bug that has a "before state" (incorrectly ended sessions), always ask: what cleans up the pre-existing bad state?
**Fix summary**: Removed per-process `cwd` match from `scanExistingSessions()`; now checks if any `claude` process is running at all. For each matching project directory, re-activates the most recently ended session (or creates a new startup one). Added 3 regression tests in `tests/unit/claude-code-detector-scan.test.ts`.

*Addendum*: The path-matching logic itself was also wrong: it used `decodeURIComponent(name.replace(/-/g, '/'))` to decode dir names, but Claude actually encodes paths by replacing `:`, `\`, `/` with `-` (e.g. `C:\source\argus` → `C--source-argus`). Decoding this back is lossy (hyphens in dir names are ambiguous). Fixed by encoding registered repo paths forward using the same convention and matching against dir names, instead of decoding dir names backward.

---

## T082 — Model information not shown for Claude Code sessions

**Date**: 2026-04-02
**Symptom**: Model name (e.g. `claude-opus-4-5`) never appeared on session cards or the session detail page for Claude Code sessions, even after conversations had run.
**Root cause**: `readNewJsonlLines` in `claude-code-detector.ts` accepted an `updateModel: boolean` parameter. The chokidar `change` event always called it with `updateModel = false`, meaning model extraction was never attempted for any incremental file-change read. If the initial load (called with `updateModel = true`) happened when the JSONL file had no assistant entries yet (e.g. the user had typed a prompt but Claude hadn't responded), the session's model stayed `null` permanently: every subsequent assistant message arrived via a `change` event where `updateModel = false` suppressed the extraction entirely.
**Why it was missed**: The parser tests verified `parseModel()` in isolation, and the feature was accepted with unit tests that only checked the initial-load path (with `updateModel = true`). No test covered the scenario where the initial load had no assistant entries and the model arrived via a subsequent file-change event.
**How to prevent**:
- Avoid boolean "mode" parameters that alter core behavior; prefer computing the condition from actual state (`needsModel = !(session?.model)`) so the method is always correct regardless of caller context.
- Write regression tests that cover the "deferred detection" scenario: initial load with no data to extract → incremental load containing the data → verify the field is eventually set.
- When a feature depends on "eventually" receiving data (model in first assistant reply), test both the "data present on initial load" and "data arrives later" code paths.
**Fix summary**: Removed the `updateModel` boolean parameter from `readNewJsonlLines`; replaced with `let needsModel = !(getSession(sessionId)?.model)` computed at call-start, so model extraction runs on every call until the model is found. Added 3 regression tests in `tests/unit/claude-code-detector-model.test.ts`.

---

## T084 — Output stream timestamps hardcoded to PST instead of browser timezone

**Date**: 2026-04-02
**Symptom**: All output stream timestamps showed in PST (UTC−8/−7) regardless of the user's local timezone. Non-PST users saw incorrect times.
**Root cause**: T021 fixed a real timezone bug by adding `timeZone: 'America/Los_Angeles'` to `toLocaleTimeString()` in `SessionDetail.tsx`: but the correct fix was to omit the `timeZone` option entirely so the browser's detected local timezone is used automatically.
**Why it was missed**: The fix was written from the perspective of a PST user. Using `undefined` as the locale (no explicit locale string) plus no `timeZone` option is the correct pattern for "use the user's browser timezone" but it's easy to conflate with "use UTC" or forget that omitting `timeZone` means local timezone.
**How to prevent**: When formatting dates for display in a multi-timezone user context, use `toLocaleTimeString(undefined, { ... })` with NO `timeZone` key to get browser-local timezone. Only set `timeZone` explicitly when you want a specific fixed timezone for all users.
**Fix summary**: Changed `formatTime` in `SessionDetail.tsx` to call `toLocaleTimeString(undefined, { hour, minute, second })` with no explicit `timeZone`: browser's local timezone is used automatically.

---

## T086 — Copilot CLI sessions never show model name

**Date**: 2026-04-02
**Symptom**: Model name was always absent on Copilot CLI session cards, even when the session had `assistant.message` events with a `model` field in `events.jsonl`.
**Root cause**: Three compounding problems: (1) `processSessionDir` hardcoded `model: null`: no extraction was attempted from the events file; (2) `upsertSession` used `model = excluded.model` in the ON CONFLICT clause, which overwrote any previously-detected model with `null` on every scan cycle; (3) `readNewLines` parsed output events but never checked for a `model` field on `assistant.message` events.
**Why it was missed**: Model detection was built for Claude Code via a dedicated `parseModel` helper but was never ported to the Copilot CLI detector. The `upsertSession` overwrite bug was masked because model was always null for CLI sessions: no test existed that set a model then re-scanned.
**How to prevent**: When porting a feature to a second session type, audit all fields the first type sets: ensure none are silently defaulted. For any `ON CONFLICT DO UPDATE`, check every field: use `COALESCE(excluded.field, field)` for fields that should only move from null→non-null, never the reverse.
**Fix summary**: Added `parseModelFromEvent` to `events-parser.ts`; added `extractModelFromEventsFile` helper in `copilot-cli-detector.ts`; `processSessionDir` now passes extracted model; `readNewLines` detects model from new events; `upsertSession` now uses `COALESCE(excluded.model, model)` to preserve any previously-detected model.

---

## T085 — Copilot CLI tool events show raw JSON dump in output stream

**Date**: 2026-04-02
**Symptom**: Tool invocation and tool result items in the Copilot CLI output stream displayed raw JSON strings like `{"type":"tool.execution_start","tool_name":"bash","timestamp":"...","path":"..."}` instead of readable content.
**Root cause**: `parseJsonlLine` in `events-parser.ts` used `JSON.stringify(event)` as the fallback content when `event.content` was not a string. Tool events (`tool.execution_start`, `tool.execution_complete`, `session.start`) have no `content` field: so the entire event object, including redundant metadata fields (`type`, `timestamp`, `tool_name`) already displayed via other UI columns, was serialised into the content cell.
**Why it was missed**: The spec said "tool name displayed prominently without raw JSON" but the frontend rendering was considered the implementation scope. The backend parser's fallback was not scrutinised: it looked reasonable for unknown events but silently broke known tool event types.
**How to prevent**: When extracting content from a structured event, always strip metadata fields that are already surfaced through other channels before stringifying. Add a regression test for each known event type that has no `content` field to assert the rendered content is clean.
**Fix summary**: Added `extractContent()` helper in `events-parser.ts` that strips `type`, `timestamp`, `tool_name`, and `content` from the event before stringifying remaining fields; returns empty string if nothing remains; returns the raw string value when only one string field remains.

## T088  Copilot CLI events use nested data object, not flat fields

**Date**: 2026-04-02
**Symptom**: Copilot CLI output stream showed raw JSON blobs instead of readable content
**Root cause**: Real Copilot CLI vents.jsonl lines wrap all payload inside vent.data (e.g. {"type":"user.message","data":{"content":"hello",...},...}). The parser checked for vent.content (always undefined) and fell back to JSON.stringify({data, id, parentId}). vent.tool_name was also always undefined; real field is vent.data.toolName. Model appeared in vent.data.model (on 	ool.execution_complete), not top-level.
**Why it was missed**: Unit tests used simplified flat event objects that matched the old assumed shape, so all tests passed even though real events had a completely different structure.
**How to prevent**: When adding a new event-source parser, always sample real on-disk event files first and write tests against those exact shapes. Never write parser tests using hand-crafted events without verifying against real data.
**Fix summary**: vents-parser.ts  xtractContent reads vent.data.content, vent.data.arguments, vent.data.result.content; 	oolName reads vent.data.toolName; parseModelFromEvent also checks vent.data.model on 	ool.execution_complete events.
---

## T089 - Claude Code spawns new session instead of activating existing one

**Date**: 2026-04-02
**Symptom**: When a Claude Code command was issued, a new session appeared instead of the existing one transitioning to running. The existing session never showed as active.
**Root cause**: scanExistingSessions() in claude-code-detector.ts used the wrong session IDs. It invented fake claude-startup-{repo.id}-{timestamp} IDs or reused old ended-session IDs. But Claude Code hook payloads always carry the REAL session ID, which is the JSONL filename (basename without .jsonl). When hooks fired with realId, getSession(realId) returned undefined, creating a new session. Additionally on server restart, active sessions were skipped entirely so their JSONL watchers were never restarted.
**Why it was missed**: Tests mocked readdirSync to return the same value for all calls, masking JSONL filename-based ID discovery. Fake IDs were never compared against real hook payloads in tests.
**How to prevent**: Always use the JSONL filename (without extension) as the Claude Code session ID. When mocking readdirSync in tests, distinguish calls with {withFileTypes:true} (returning dir entries) from plain calls (returning JSONL filenames). Write a regression test that inserts a session with a known ID matching a JSONL filename and verifies it gets reused.
**Fix summary**: claude-code-detector.ts - scanExistingSessions() per-repo block replaced: scans project dir for *.jsonl files sorted by mtime, uses newest filename (minus .jsonl) as session ID, restarts watcher for already-active sessions instead of skipping, removes fake claude-startup-* ID path entirely.

---

## T090 — Claude Code session transitions to ended after every AI response instead of only on exit

**Date**: 2026-04-02
**Symptom**: After Claude Code responded to a request, the session card immediately showed "ended". Issuing another command would flip it back to active, then ended again on the next response.
**Root cause**: `handleHookPayload` in `claude-code-detector.ts` mapped `hook_event_name === 'Stop'` to `status: 'ended'`. But Claude Code's `Stop` hook fires at the end of every AI turn (when the model finishes generating output): not when the user exits the Claude Code terminal. Actual session termination is detected separately by `reconcileStaleSessions()` via PID check.
**Why it was missed**: The `Stop` hook was assumed to be analogous to a process exit signal. No test exercised the session's status after a `Stop` hook arrived, only that the HTTP 200 was returned.
**How to prevent**: When mapping external hook events to session lifecycle states, verify the exact semantics of each event in the source tool's documentation. Add a test that checks the DB-persisted session status after each hook type fires: not just the HTTP response code.
**Fix summary**: `claude-code-detector.ts`: `Stop` branch now sets `status: 'idle'` and leaves `endedAt` null. Session transitions to `ended` only via `reconcileStaleSessions()` when the PID is no longer running.

---

## T091 — Claude Code sessions never marked ended when process exits while Argus is running

**Date**: 2026-04-02
**Symptom**: Killing a Claude Code process (via kill or `/exit`) left the session showing as active/idle in the dashboard indefinitely. It was only detected as ended after an Argus server restart.
**Root cause**: Three compounding problems: (1) `reconcileStaleSessions()` in `session-monitor.ts` only ran once at startup: there was no periodic liveness check while Argus was running; (2) it only queried `status: 'active'` sessions: after T090, sessions go `idle` on Stop hook, making them invisible to this check even at startup restart; (3) hook-created sessions have `pid: null`, and the PID-based guard (`session.pid != null`) meant they were never ended by any code path regardless of Claude process state.
**Why it was missed**: The T074/T075 fixes focused on not ending null-PID sessions (which was the bug at the time). No periodic Claude Code liveness check was ever added: it was deferred under the assumption that hooks would handle session lifecycle. T090 changed the Stop hook to `idle` without auditing what actually ended idle sessions.
**How to prevent**: Any session type that uses a hook-driven lifecycle needs a complementary periodic process check as a safety net. For each status a session can enter, verify there is a code path that exits that status: `idle` had no exit path to `ended` except server restart.
**Fix summary**: `session-monitor.ts`: `reconcileStaleSessions()` now also processes `idle` sessions; added `reconcileClaudeCodeSessions()` method called from `runScan()` every 5s that ends Claude Code sessions with dead PIDs or ends all null-PID Claude Code sessions if no `claude` process is running.

---

## T092 — Claude Code `idle` status is wrong; Stop hook should keep session `active`

**Date**: 2026-04-02
**Symptom**: After each Claude Code AI response, the session showed a distinct `idle` status badge in the UI instead of staying "running" (active). This diverged from Copilot CLI which only uses `active`/`ended`.
**Root cause**: T090 fixed the original bug (Stop → `ended`) by introducing `idle` as a new intermediate status. But the UI already handles "resting vs running" purely via `isInactive()`: a time-based check on `lastActivityAt` (20-min threshold): with no backing status field. Claude Code sessions should stay `active` between turns, exactly like Copilot CLI sessions stay `active` between prompts.
**Why it was missed**: T090 was written to fix the immediate `ended` regression without consulting how "resting" is displayed in the frontend. The `idle` status already existed in `SessionStatus` as an unused bucket, which made it easy to reach for without questioning whether it was the right abstraction.
**How to prevent**: Before adding a new status value, check how the frontend renders existing statuses. `isInactive()` is the single source of truth for "resting" display: any backend-driven intermediate state that duplicates it is wrong. New statuses should only be added when they require distinct frontend rendering that time-based logic cannot provide.
**Fix summary**: `claude-code-detector.ts`: removed `if (hook_event_name === 'Stop')` branch; all hooks now set `status: 'active'` and update `lastActivityAt`. `session-monitor.ts`: removed `idle` from reconciliation queries.

## T093  Preview strip lost dark theme after T108 refactor

**Date**: 2026-04-02
**Symptom**: Session card preview strips appeared light grey (bg-gray-100) instead of the expected dark code-output style, looking washed out and inconsistent with the rest of the UI's dark output aesthetic.
**Root cause**: T108 changed `bg-gray-900 text-gray-300`  `bg-gray-100 text-gray-600` to "fix inconsistency," but the actual inconsistency was the shade label, not dark-vs-light intent. The user's desire was always a dark code-preview strip; the fix went in the wrong direction.
**Why it was missed**: The refactor task T108 was implemented based on a misinterpretation of "different gray colors"  assumed the user wanted lighter/consistent grays, when they actually wanted the dark style kept but applied uniformly.
**How to prevent**: When a user says "make consistent," clarify whether they mean consistent with the light card theme or consistent dark. Do not change darklight without explicit confirmation.
**Fix summary**: Reverted `SessionCard.tsx` preview `<p>` classes back to `bg-gray-900 text-gray-300`.

---

## OPS-001: TypeScript error in server.ts missed after fastify v4→v5 upgrade

**Date**: 2026-04-04
**Symptom**: `TS18046: 'error' is of type 'unknown'` in `server.ts` setErrorHandler: reported by user after the upgrade was considered complete.
**Root cause**: Fastify v5 tightened its typings: `setErrorHandler`'s `error` parameter changed from `FastifyError` to `unknown` in strict mode. Accessing `.statusCode`, `.code`, and `.message` on an `unknown` type is a compile-time error.
**Why it was missed**: `npm test` (vitest) uses esbuild under the hood, which transpiles TypeScript by **stripping types only**: it never runs the TypeScript compiler and never catches type errors. All 164 tests passed despite the broken types. `tsc --noEmit` was not run as part of the upgrade validation step.
**How to prevent**:
- After any major dependency upgrade (especially one with known breaking type changes), always run `tsc --noEmit` in addition to the test suite.
- The build/test checklist for dependency upgrades should be: `tsc --noEmit` → `npm test` → `npm run build` → `npm audit`. Type-checking must come first so type errors are caught before runtime tests.
- When upgrading a framework to a new major version, explicitly check its changelog for type-level breaking changes: these are invisible to test runners that use esbuild/babel transpilation.
**Fix summary**: Imported `FastifyError` from `fastify` and annotated the `setErrorHandler` error parameter explicitly: `(error: FastifyError, request, reply) => ...`.

---

## T094 — Stale null-PID Claude Code sessions never cleaned up when another Claude process is running

**Date**: 2026-04-03
**Symptom**: A Claude Code session ID (e.g., `8c20d263 | 26h 2m`) appeared in the dashboard with no corresponding real session, showing as active indefinitely even after the original Claude Code process had long since exited.
**Root cause**: `reconcileClaudeCodeSessions()` in `session-monitor.ts` used `claudeRunning` (whether *any* Claude process is running) as the guard for null-PID sessions: `session.pid == null && !claudeRunning`. If any other Claude session was active on the machine, `claudeRunning = true` and no null-PID sessions were ever cleaned up, regardless of how old they were.
**Why it was missed**: The T091 fix was written to prevent null-PID sessions from being prematurely ended at startup. The guard `!claudeRunning` was correct for the single-session case but broke down when multiple Claude Code sessions existed simultaneously.
**How to prevent**: When cleaning up sessions per-session state, use per-session signals (e.g., the session's own JSONL file freshness) rather than global process-presence signals. Global signals (is any Claude running?) cannot distinguish between the session you're checking and an unrelated session.
**Fix summary**: `session-monitor.ts`: null-PID branch now stats the session's JSONL file (`~/.claude/projects/{projectDir}/{sessionId}.jsonl`); if the file is missing or older than `ACTIVE_JSONL_THRESHOLD_MS` (30 min), the session is ended. `claude-code-detector.ts`: exported `ACTIVE_JSONL_THRESHOLD_MS` and made `claudeProjectDirName` a public static method for reuse.

---

## T095 — Branch badge does not update until window refocus

**Date**: 2026-04-04
**Symptom**: After switching git branches in the terminal, the Argus dashboard continued to show the old branch name. The badge only updated when the user switched away from the browser and back (triggering window focus).
**Root cause**: Both `useQuery` calls in `DashboardPage.tsx` (for `repositories` and `sessions`) had no `refetchInterval`. React Query's default behaviour is to refetch on mount and on window focus only: it does not poll automatically unless `refetchInterval` is set. The backend correctly refreshes branch data in the DB every 5 seconds via `SessionMonitor.refreshRepositoryBranches()`, but the frontend never pulled the updated data.
**Why it was missed**: The backend refresh was tested and confirmed working. The frontend polling gap was not considered: it was assumed `staleTime: 5000` in the global `QueryClient` config caused automatic polling, but `staleTime` only marks data as stale; it does not trigger background refetches.
**How to prevent**:
- `staleTime` ≠ `refetchInterval`. Always explicitly set `refetchInterval` on queries that need to stay live with the server.
- When wiring up a backend polling loop, check end-to-end: does the frontend also have a matching poll? Trace the full data path from server update → DB → API → React Query → UI.
**Fix summary**: Added `refetchInterval: 5000` to both `useQuery` calls (repositories and sessions) in `DashboardPage.tsx`. Also updated the `repository-scanner.js` vitest mock to properly export `getCurrentBranch`, fixing a silent mock gap where `refreshRepositoryBranches()` errors were being swallowed by the catch block.

## T028 — Space key in prompt input toggles session card selection

**Date**: 2026-04-07
**Symptom**: Typing a space into the prompt input on a session card caused the card to toggle its selected state instead of inserting a space into the input.
**Root cause**: `SessionCard` has `role="button"` with `onKeyDown` that intercepts Space and Enter to activate the card. The prompt bar wrapper used `onClick={e => e.stopPropagation()}` to prevent click events bubbling, but keyboard events from the input still bubbled up to the card's `onKeyDown` handler.
**Why it was missed**: The `onClick` stop-propagation was added when the prompt bar was introduced, but the equivalent `onKeyDown` guard was not — it was not obvious that `role="button"` + Space would fire a handler that sat above a focused `<input>`.
**How to prevent**: Whenever interactive content (inputs, buttons) is nested inside a `role="button"` element, always stop both `onClick` AND `onKeyDown` propagation on the inner container. Treat click and keyboard as a pair.
**Fix summary**: Added `onKeyDown={e => e.stopPropagation()}` alongside the existing `onClick` on the prompt bar wrapper div in `SessionCard.tsx`.

## T029 — PTY launch creates duplicate read-only detected session

**Date**: 2026-04-07
**Symptom**: After launching a claude session via `argus launch`, sending a prompt caused a second read-only session to appear. All output showed in the detected session; the live PTY session showed nothing.
**Root cause**: `ClaudeCodeDetector.handleHookPayload` and `activateFoundSession` identify sessions by Claude's internal session ID (e.g. `e4d9a893` from the JSONL filename). The PTY session registered by `argus launch` has a different UUID. When the hook fires, `getSession(claudeSessionId)` returns null, and the detector creates a brand-new detected session (launchMode=null) instead of recognising the existing PTY session.
**Why it was missed**: The PTY launcher and the JSONL detector were designed as independent subsystems. No deduplication logic existed at the join point where both could fire for the same real claude session.
**How to prevent**: Whenever a new session is about to be created, query for an existing active PTY session for the same repository. If one exists, route to it rather than creating a duplicate. The general rule: "one repo, one active claude session" — enforce this invariant at creation time.
**Fix summary**: Added `activePtySessionForRepo()` helper to `ClaudeCodeDetector`; both `handleHookPayload` and `activateFoundSession` now check for an active PTY session before creating a new detected session. `watchJsonlFile` accepts an optional `storeAsId` so JSONL output can be attributed to the PTY session ID.
