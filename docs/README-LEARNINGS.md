# Bug Learnings

Retrospective entries for every bug fixed via the `/bug` skill.
Each entry explains what went wrong, why it was missed, and how to prevent it.

---

## T126 — Copilot ask_user question text not shown when no choices provided

**Date**: 2026-05-02
**Symptom**: When a Copilot session triggers an `ask_user` call with only a question and no choices, the Attention Needed panel appears but shows no question text.
**Root cause**: `copilot-cli-jsonl-parser.ts` `extractContent()` uses a single-value shortcut: when `data.arguments` has exactly one key (just `question`, no `choices`), it returns the raw string value rather than JSON.stringify-ing the object. `CopilotJsonlWatcher.onNewOutputs()` then tries `JSON.parse(output.content)` on that raw string, which throws a SyntaxError. The catch block discarded the error and left `question = ''`, so an empty question was broadcast. The comment "content may not be JSON when choices is absent" acknowledged the case but provided no recovery.
**Why it was missed**: The existing test for `pending_choice` detection only covered the multi-arg case (`question` + `choices`), which produces valid JSON. The single-arg (no choices) path was never tested, and the silent empty-string fallback in the catch block gave no observable signal during normal use.
**How to prevent**: When a catch block has a comment explaining a known expected case, it must also handle that case, not just swallow the error. Any `catch { /* comment */ }` with no recovery code should be treated as a bug during review.
**Fix summary**: In `copilot-jsonl-watcher.ts` `onNewOutputs()`, changed the catch block to set `question = output.content` so the raw string is used as the question when JSON parsing fails.

---

## T123 — Branch name not updated on dashboard

**Date**: 2026-04-14
**Symptom**: The branch badge on a repository card does not update after the user switches git branches. It only changes after a full page reload.
**Root cause**: `SessionMonitor.refreshRepositoryBranches()` in `backend/src/services/session-monitor.ts` correctly detects branch changes and writes them to the DB via `updateRepositoryBranch()`, but never calls `broadcast()`. The frontend removed its 5-second poll (T120), so there is no path for the UI to learn of the change. Additionally, `socket.ts` had no `repository.updated` handler even if a broadcast had been sent.
**Why it was missed**: The DB write and the broadcast are two separate operations. T095 masked the missing broadcast by adding a 5-second `refetchInterval` poll, which T120 later removed as redundant. The combination of those two changes revealed the gap.
**How to prevent**: Any function that writes to the DB and expects the frontend to reflect the change must also call `broadcast()`. Treat the DB write and the broadcast as an inseparable pair. Add a lint rule or code review checklist item: "If you call `update*` from `database.ts`, does a broadcast follow?"
**Fix summary**: Added `broadcast({ type: 'repository.updated', ... })` in `refreshRepositoryBranches()` after `updateRepositoryBranch()`, and added a `repository.updated` handler in `frontend/src/services/socket.ts` that invalidates the `['repositories']` query.

---

## T122 — Copilot sessions show "resting" despite active responses

**Date**: 2026-04-16
**Symptom**: Even when Copilot was actively processing a response, the Argus session card showed the "resting" badge.
**Root cause**: Two cooperating problems in `CopilotCliDetector`:
(1) `readNewLines()` never updated `lastActivityAt` when output arrived. Claude's equivalent (`ClaudeJsonlWatcher.applyActivityUpdate()`) correctly sets `lastActivityAt = now` on every new JSONL line, but the Copilot path only updated `summary` and `model`, never `lastActivityAt`.
(2) `processSessionDir()` unconditionally set `lastActivityAt: toIso(workspace.updated_at)` on every 5-second scan. Since `workspace.updated_at` is rarely written during active processing, this always provided a stale timestamp. Even if fix (1) had existed earlier, fix (2) would have clobbered it on the very next scan cycle.
**Why it was missed**: `lastActivityAt` handling was implemented correctly for Claude (via `ClaudeJsonlWatcher`) but the analogous field in the Copilot detector was treated as a static snapshot from `workspace.yaml`. No test verified that `lastActivityAt` is updated when Copilot output arrives or that it survives subsequent scan cycles.
**How to prevent**: When a field is written by two code paths (a file-watcher update and a periodic scan), the scan must preserve the most recent value, not unconditionally overwrite it. Use the `existingSession?.field > newValue ? existingSession.field : newValue` pattern. Add tests that write to a scan directory AND check that timestamp fields from live updates are not reset by a later scan call.
**Fix summary**: `copilot-cli-detector.ts` — (1) `readNewLines()` now upserts `lastActivityAt = now` and broadcasts `session.updated` when `outputs.length > 0`, mirroring `ClaudeJsonlWatcher.applyActivityUpdate()`. (2) `processSessionDir()` now keeps `existingSession.lastActivityAt` when it is more recent than `workspace.updated_at`.

---

## T124 — Copilot CLI ask_user question not shown in Argus UX

**Date**: 2026-04-20
**Symptom**: When Copilot CLI calls the `ask_user` tool, the question and choices panel never appears in the Argus dashboard. The question is visible in the Copilot session terminal but the Argus UI shows nothing.
**Root cause**: Claude Code sends `AskUserQuestion` events via an HTTP hook (`PreToolUse` → `handlePreAskQuestion()` in `claude-code-detector.ts`), which broadcasts `session.pending_choice` over WebSocket immediately. Copilot CLI instead writes events to `events.jsonl`, and the `CopilotJsonlWatcher` read path never detected `ask_user` tool calls or broadcast `session.pending_choice`. The frontend's `detectPendingChoice(items)` fallback exists but is unreliable: it depends on React Query cache being up to date and has no explicit resolved notification.
**Why it was missed**: The two session types use fundamentally different event delivery mechanisms (HTTP hook vs. JSONL file watcher). The frontend fallback (`detectPendingChoice`) partially masked the problem for existing items but did not handle the real-time notification gap. No integration test verified that Copilot CLI's ask_user flow produces a `session.pending_choice` WebSocket event.
**How to prevent**: Any feature that works via the HTTP hook path for Claude Code must have an equivalent code path for the JSONL watcher path for Copilot CLI, and vice versa. When adding interactive features, verify both session types emit the required WebSocket events, not just that the output data is stored.
**Fix summary**: Added `protected onNewOutputs(sessionId, outputs)` hook in `JsonlWatcherBase` (called after inserting new outputs), then overrode it in `CopilotJsonlWatcher` to detect `tool_use` events with `toolName === 'ask_user'` and broadcast `session.pending_choice`, and to detect the matching `tool_result` by `toolCallId` and broadcast `session.pending_choice.resolved`.

---



**Date**: 2026-04-10
**Symptom**: After T113, GHCP sessions showed as read-only (launchMode: null) again immediately after the session exited.
**Root cause**: T113 changed `if (alreadyClaimed)` to `if (alreadyClaimed && ptyRegistry.has(sessionId))`. When a PTY session exits, the WS closes and the server calls `ptyRegistry.unregister`, removing the session from `connections`. On the next scan: `alreadyClaimed=true` but `has()=false`, so the `else` branch ran, `claimForSession` failed (no pending WS for an ended process), and `launchMode` was set to `null` — incorrectly erasing the historical launch mode. The fix needed to distinguish between "WS gone because process ended" and "WS gone because Argus restarted while process was still running".
**Why it was missed**: The T113 tests used test PID 99999 (never running), so `isRunning=false` in all tests. The re-claim branch was never tested with `isRunning=true` vs `isRunning=false`. The existing test for `downgrades to null` was actually testing a wrong scenario and passed by coincidence with the wrong expected value.
**How to prevent**: When adding a conditional re-claim path, always test BOTH sub-cases: (1) process still running (backend restart), and (2) process ended (normal exit). Use a `ps-list` mock to control `isRunning` independently of the PID value used in test fixtures.
**Fix summary**: `copilot-cli-detector.ts` — restructured the `alreadyClaimed` branch to always preserve `launchMode:'pty'` as a historical record, then separately try `claimForSession` only when `!has() && isRunning` (restart scenario). Also fixed pre-existing TypeScript type error by using `PidSource | null` instead of a narrowed literal union.

---

## T115 — ended sessions stealing pending PTY WS claim

**Date**: 2026-04-10
**Symptom**: After `argus launch copilot`, the new GHCP session was detected as read-only (`launchMode: null`) even when the launcher WS connected and registered successfully.
**Root cause**: `CopilotCliDetector.processSessionDir()` called `ptyRegistry.claimForSession(sessionId, repo.path)` in the `else` branch (not yet claimed) without checking `isRunning`. GHCP creates a new UUID session directory for each launch; old ended directories from previous runs with the same `cwd` were also scanned. If an old ended directory was processed before the new active one, it consumed the single pending WS entry in `pendingByRepoPath[cwd]`, leaving the new active session with nothing to claim (`launchMode: null`).
**Why it was missed**: Tests used a single session directory. The bug only manifests when multiple GHCP session directories share the same `cwd` and the non-running one is processed first.
**How to prevent**: Whenever a scan-based detector calls a singleton registry to claim a resource keyed by path, always guard the claim with a liveness check (`isRunning`). A non-running session has no business claiming a live connection.
**Fix summary**: `copilot-cli-detector.ts` — changed `else { claimForSession(...) }` to `else if (isRunning) { claimForSession(...) }` so only active sessions can claim a pending launcher WS.

---


**Date**: 2026-04-10
**Symptom**: After restarting the Argus backend (while `argus launch copilot` was still running), the session continued to show as PTY-launched in the UI, but every `sendPrompt` call failed with "Session launcher is not connected to Argus".
**Root cause**: Three cooperating issues: (1) `copilot-cli-detector.ts` checked `alreadyClaimed = existingSession?.launchMode === 'pty'` and when true, blindly preserved `launchMode: 'pty'` without checking `ptyRegistry.has(sessionId)`. After a backend restart, the in-memory `ptyRegistry.connections` is empty but the SQLite DB still has `launchMode: 'pty'`, so the detector skipped the `claimForSession` call that would have re-linked the new WS. (2) `ArgusLaunchClient` had no reconnect logic, so when the backend restarted and the WS closed, the launcher never re-registered. (3) `ptyRegistry.sendPrompt` had no `readyState` guard, meaning a stale closed WS in `connections` would throw an unhandled error instead of a clean rejection.
**Why it was missed**: The T112 fix correctly handled the first-launch case (alreadyClaimed=false) but introduced an implicit assumption that the in-memory WS registry is always in sync with the DB's `launchMode`. No test exercised the backend-restart-mid-session scenario where the two diverge.
**How to prevent**: Whenever DB state (persisted) and in-memory state (ephemeral) are used together for a feature, write at least one test that simulates the "DB has data but in-memory is empty" scenario. For any WS-backed feature, add a `readyState` guard before `ws.send()` and a reconnect handler on the client side.
**Fix summary**: `copilot-cli-detector.ts` — added `ptyRegistry.has(sessionId)` to the `alreadyClaimed` guard so the code re-attempts `claimForSession` when the WS is gone. `argus-launch-client.ts` — added `close` event handler that calls `connect()` after 2s when `!isClosing`, plus `isClosing = true` in `notifySessionEnded`. `pty-registry.ts` — added `readyState !== OPEN` guard in `sendPrompt` that removes the stale entry and rejects cleanly.

---

## T112 — GHCP launched via argus launch shows as read-only instead of live PTY session

**Date**: 2026-04-10
**Symptom**: After running `argus launch copilot`, the session appeared in Argus as a read-only detected session with `launchMode: null`. The PTY was running and the WS connection was registered, but sending prompts failed immediately.
**Root cause**: `CopilotCliDetector.processSessionDir()` always hardcoded `launchMode: null`. Unlike `ClaudeCodeDetector` which calls `ptyRegistry.claimForSession()` when a hook fires, the copilot detector never checked `ptyRegistry` for a pending WS connection matching the same `cwd`. The pending entry sat unclaimed in `pendingByRepoPath` forever.
**Why it was missed**: The copilot-cli detection path was implemented independently from the PTY launcher path. The `claimForSession` pattern was only documented in comments referencing Claude hooks. No integration test existed that covered the scenario of a PTY pending + a workspace.yaml scan happening together.
**How to prevent**: When adding a new session detection pathway, explicitly check whether a PTY claim step is needed — especially when `launchMode: null` is the default. Add a test that combines `ptyRegistry.registerPending` with a scan to verify `launchMode` is set correctly.
**Fix summary**: `copilot-cli-detector.ts` — added `ptyRegistry` import and PTY claim logic in `processSessionDir()`. If `ptyRegistry.claimForSession()` returns a claimed entry for the repo path, `launchMode` is set to `'pty'` and `pid`/`pidSource` are taken from the registry instead of the lock file.

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

## T116 — copilot-cli send-prompt keystrokes inconsistent

**Date**: 2026-04-13
**Symptom**: Sending a prompt to a Copilot CLI PTY session via Argus worked unreliably. Adding log statements to the delivery path made it work consistently, suggesting a timing dependency.
**Root cause**: `launch.ts` `onSendPrompt` pushed all Win32 input sequences for every character synchronously in a single event-loop tick. The Copilot CLI PTY read the events and dropped or merged them when they all arrived at once. Log statements introduced implicit I/O overhead that happened to space out the pushes enough for the PTY to process them individually.
**Why it was missed**: The delivery function was tested with single-character prompts or short strings where the race was not reliably reproducible. The log-lines-help clue was not recognised as a timing signal.
**How to prevent**: When injecting input into a PTY as individual "keystroke" events, always add an inter-character delay. Real keyboard input is never instantaneous; PTY readers are optimised for a stream with natural inter-key gaps. A synchronous burst of events should be treated as a red flag.
**Fix summary**: Made the `onSendPrompt` callback in `launch.ts` async and added `await delay(KEYSTROKE_DELAY_MS)` (10 ms) after each character's key-down/key-up pair. Updated `PromptCallback` type in `argus-launch-client.ts` to allow `Promise<void>` return.

---

## T116 (master) — Conversation history not shown when adding a repository with an active session

**Date**: 2026-04-13
**Symptom**: After adding a repository that already had an active Claude Code session, the session card showed "Waiting for output..." and the output pane was empty, even though the conversation had been happening for some time.
**Root cause**: `applyOutputBatchEvent` in `frontend/src/services/socket.ts` had `if (!old) return old` as a guard. When `session.output.batch` arrived before the `SessionCard` was mounted (cache key `['session-output-last', sessionId]` not yet populated), the updater returned `undefined` and the batch was silently dropped. The `SessionCard` subsequently fired an API call that could race the backend's `insertOutput` write. If the API response arrived before `insertOutput` completed, the cache was seeded with empty data and, because `staleTime: Infinity` was set on that query, it was never refetched.
**Why it was missed**: The two code paths (broadcast from `reconcileClaudeSessionRegistry` and JSONL write from `scanExistingSessions`) are decoupled and run in sequence with an async gap between them. The race window was considered unlikely but is observable when the browser renders quickly and the JSONL file is large (slow read).
**How to prevent**:
- Any `setQueryData` updater that can receive `undefined` as `old` should either create a valid seed entry or be documented as an intentional no-op. Never silently discard an event by returning `old` without checking.
- When a new entity is broadcast via WS (`session.created`) and its associated data immediately follows (`session.output.batch`), assume the second event may arrive before the first has been processed by React. Design cache updaters to be order-independent.
**Fix summary**: Changed `if (!old) return old` to seed the cache in both `['session-output', sessionId]` and `['session-output-last', sessionId]` updaters inside `applyOutputBatchEvent` in `frontend/src/services/socket.ts`, so the batch always populates the cache regardless of whether the component has mounted yet.

---

## T117 — TODO toggle button state not preserved on remount

**Date**: 2026-04-13
**Symptom**: After switching mobile tabs away from the Tasks tab and back, or after toggling the Todo panel visibility in Settings, the three header toggle buttons (Hide completed, Show timestamps, Wrap text) reset to their default states, losing any changes the user had made.
**Root cause**: `showDone`, `showTimestamps`, and `wrapText` in `frontend/src/components/TodoPanel/TodoPanel.tsx` were plain `useState` calls with hardcoded defaults (`true`, `true`, `false`). Nothing persisted these values across component unmount/remount cycles.
**Why it was missed**: In the common desktop case the `TodoPanel` is always mounted while the dashboard is visible, so remount-triggered resets were not exercised. Mobile tab switching and panel hide/show are less frequently tested paths.
**How to prevent**: Any UI toggle that controls a user preference (not ephemeral interaction state) should be initialised from `localStorage` and written back on change. The test suite should clear `localStorage` in a top-level `beforeEach` so that localStorage-backed state does not bleed between test cases.
**Fix summary**: Initialised each of the three toggle states from `localStorage` (keys `argus.todo.showDone`, `argus.todo.showTimestamps`, `argus.todo.wrapText`) with `useEffect` writes on change, in `frontend/src/components/TodoPanel/TodoPanel.tsx`. Added `localStorage.clear()` to the global `beforeEach` in `TodoPanel.test.tsx` to prevent inter-test contamination.

---

## T118 — Kill session toggles output stream visibility

**Date**: 2026-04-13
**Symptom**: Clicking the "Kill session" button on a session card (or clicking Confirm/Cancel in the resulting dialog) unexpectedly toggled the inline output stream pane open or closed on the dashboard.
**Root cause**: `KillSessionDialog` uses `createPortal` to render its backdrop and buttons to `document.body`, which correctly removes it from the DOM hierarchy. However, React's synthetic event system propagates events through the _virtual_ component tree, not the DOM tree. Since `KillSessionDialog` is a React child of `SessionCard`, any click inside the dialog bubbles up to `SessionCard`'s outer `div` click handler (`onClick={() => onSelect?.(session.id)}`), which calls `setSelectedSessionId` in `DashboardPage` and toggles the output pane. The kill button itself already called `e.stopPropagation()`, but the dialog's backdrop `onClick` did not.
**Why it was missed**: The behaviour of React portal event bubbling is non-obvious. The DOM shows the dialog appended to `<body>`, so it is not visually a descendant of the card. Reviewers and tests did not exercise the click-propagation path through the React tree for portal content.
**How to prevent**: Whenever a component uses `createPortal`, add `e.stopPropagation()` to the outermost rendered element's click handler. This contains portal clicks within the portal and prevents them from leaking into whichever React ancestor happens to render the portal component. Write a regression test that wraps the portal component in a div with a `parentClick` spy and asserts the spy is not called after user interactions inside the portal.
**Fix summary**: Added `e.stopPropagation()` to the backdrop div's `onClick` handler in `frontend/src/components/KillSessionDialog/KillSessionDialog.tsx`.

---

## T119 — Copilot session summary reset to autogenerated title on every scan

**Date**: 2026-04-13
**Symptom**: The Copilot session card always showed the autogenerated title from workspace.yaml (e.g. "Implement a feature to...") instead of the user's actual last prompt, even after messages were exchanged.
**Root cause**: `processSessionDir()` in `copilot-cli-detector.ts` always passed `summary: workspace.summary ?? null` to `upsertSession()`. The SQL uses `summary = excluded.summary` unconditionally, so every 5-second scan cycle overwrote the summary with the static workspace.yaml value, undoing any update that `readNewLines()` had written from the user's most recent `user.message` event.
**Why it was missed**: The live-update path (`readNewLines` writing the user message as summary) was implemented and tested in isolation. The scan path was tested separately. The interaction between them — scan running repeatedly and clobbering the live update — was never tested end-to-end.
**How to prevent**: When a periodic reconciliation loop upserts a record, prefer existing DB values over freshly-read file values for fields that can be updated by other code paths. Use `existingRecord?.field ?? freshValue` rather than always trusting the file. Any field whose update path differs from the scan path should be protected this way.
**Fix summary**: Changed `summary: workspace.summary ?? null` to `summary: existingSession?.summary ?? workspace.summary ?? null` in `processSessionDir()` in `backend/src/services/copilot-cli-detector.ts`, preserving any summary already written by `readNewLines`.

---

## T120 — Copilot model/summary updates not broadcast; dashboard polled unnecessarily

**Date**: 2026-04-13
**Symptom**: Copilot session model and summary updates were only visible after the next 5-second poll cycle. The dashboard made HTTP requests to `/api/v1/sessions` and `/api/v1/repositories` every 5 seconds even though a WebSocket push channel already covered all lifecycle events.
**Root cause**: `copilot-cli-detector.ts` `readNewLines()` called `upsertSession()` for both model-detection and summary-update paths but never called `broadcast()`. All other session mutation sites (claude-jsonl-watcher, session-monitor, launcher) broadcast `session.updated` immediately after writing. The missing broadcasts meant the only way for the frontend to see these changes was via polling. The `refetchInterval: 5000` in `DashboardPage.tsx` was added before the WS event model was fully wired up and never removed once the WS covered all session lifecycle events.
**Why it was missed**: The model/summary update paths in `copilot-cli-detector.ts` were added incrementally. Each added `upsertSession` but the `broadcast` step was not in the immediate context and was easy to overlook. No test existed that verified a `broadcast` was emitted after these updates. The polling was not reviewed for removal when the WS was deemed complete.
**How to prevent**: Any code path that mutates a session and calls `upsertSession()` must also call `broadcast({ type: 'session.updated', ... })`. Treat these two as an inseparable pair. The integration test for `copilot-cli-detector` now asserts `broadcast` is called, making future omissions detectable.
**Fix summary**: Added `broadcast()` calls after both `upsertSession()` calls in `readNewLines()` in `backend/src/services/copilot-cli-detector.ts`; removed `refetchInterval: 5000` from both `useQuery` hooks in `frontend/src/pages/DashboardPage.tsx`.

---

## T121 — pid=null after backend restart reconnect

**Date**: 2026-04-13
**Symptom**: After the Argus backend restarted, the re-linked Copilot PTY session showed `pid=null` in the re-link log and in the DB, even though the process was still running and the pid had been resolved earlier.
**Root cause**: `ArgusLaunchClient.updatePid()` in `backend/src/cli/argus-launch-client.ts` sent `update_pid` immediately when the WS was open, but did not update `this.registerInfo.pid`. On reconnect, `handleOpen()` replays the `register` message using `this.registerInfo`, which still held `pid: null`. The `pendingPid` replay path was also a dead end: `pendingPid` is only set when the WS is closed at the time `updatePid` fires, so it was `null` after the normal initial launch. The net result was that every reconnect sent `register` with `pid: null`.
**Why it was missed**: The reconnect path was added in T114 and tested for `workspace_id` and `register` replay, but the test used `pid: 1` in `registerInfo` directly — it never exercised the case where `pid` starts as `null` and is resolved later via `updatePid()` while the WS is already open.
**How to prevent**: Any field that can be updated after initial registration (pid, workspaceSessionId) must be kept in sync in the object used for reconnect replay. Treat `registerInfo` as the source of truth for what the next `register` message will contain, and update it eagerly on every mutation.
**Fix summary**: Added `if (this.registerInfo) { this.registerInfo = { ...this.registerInfo, pid }; }` at the top of `updatePid()` in `backend/src/cli/argus-launch-client.ts`, before the `isOpen` check.

---

## T124 — Historical JSONL outputs re-sent to Slack/Teams on session detection

**Date**: 2026-04-18
**Symptom**: When Argus detects an existing Claude Code session, all historical messages from the session's JSONL file are re-sent as new Slack and Teams notifications, flooding the channel with past conversation.
**Root cause**: `ClaudeJsonlWatcher.watchFile()` sets `filePositions` to 0 (start of file) and calls `readNewLines()` immediately, reading the entire JSONL history. `readNewLines()` passes all parsed outputs to `outputStore.insertOutput()`, which unconditionally fires output listeners (Teams) and emits `session.output.batch` (Slack) for every batch, regardless of whether the data is historical or new.
**Why it was missed**: The initial read was designed to populate the UI output stream from history — a legitimate need. But `insertOutput()` treated every call identically: DB write plus notification. The dual purpose (populate UI vs. notify integrations) was never separated.
**How to prevent**: Any function that inserts data for UI replay (bootstrapping a cache from stored/historical records) must not trigger side-effect notifications designed for live events. Annotate call sites with the intent: historical reads should always pass `{ skipNotifications: true }` so the distinction is explicit in code rather than implicit in timing.
**Fix summary**: Added `options?: { skipNotifications?: boolean }` to `OutputStore.insertOutput()` in `backend/src/services/output-store.ts`. Changed `ClaudeJsonlWatcher.watchFile()` to call `readNewLines(..., { skipNotifications: true })` for the initial historical read. Subsequent `chokidar` change events call `readNewLines()` without the flag, so live output continues to notify normally.

---

## T125 — @homebridge/node-pty-prebuilt-multiarch dead dependency breaks Node 25

**Date**: 2026-04-20
**Symptom**: `npm install` emits `npm warn EBADENGINE` for `@homebridge/node-pty-prebuilt-multiarch@0.13.1` on Node 25.x because the package requires `>=18.0.0 <25.0.0`.
**Root cause**: `@homebridge/node-pty-prebuilt-multiarch` was listed in `dependencies` in both `package.json` (root) and `backend/package.json` but was never imported anywhere. All PTY usage in the codebase imports from `node-pty` directly (`launch.ts:2`). The package is a dead dependency that was never wired up.
**Why it was missed**: The engine warning is a `warn`, not an error, so `npm install` still succeeds. The package was likely added as a preparatory step for switching from `node-pty` to its prebuilt-binary variant, but the import was never updated.
**How to prevent**: When adding a new dependency, verify it is actually imported somewhere before committing (`grep -r "from '<package>'" src/`). `npm warn EBADENGINE` on install is the real detection signal — treat it as a hard error in CI rather than a ignorable warning. A per-package unit test is not the right guard here; it catches only one specific package and not the general pattern.
**Fix summary**: Removed `"@homebridge/node-pty-prebuilt-multiarch": "^0.13.1"` from `dependencies` in `package.json` and `backend/package.json`; ran `npm install` to drop it from the lockfile.
