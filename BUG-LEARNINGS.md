# Bug Learnings

Retrospective entries for every bug fixed via the `/bug` skill.
Each entry explains what went wrong, why it was missed, and how to prevent it.

---

## T073 — Copilot CLI sessions not detected

**Date**: 2026-04-01
**Symptom**: No Copilot CLI sessions ever appeared in the dashboard, even when sessions were actively running.
**Root cause**: `js-yaml` (v4) auto-coerces ISO 8601 timestamp strings in YAML into JavaScript `Date` objects. `processSessionDir` in `copilot-cli-detector.ts` passed those `Date` objects directly to `upsertSession`, which tried to bind them to SQLite. `better-sqlite3` only accepts strings/numbers/null — it threw on the first `Date` field. The `try/catch` in `scan()` swallowed the error silently, causing every session directory to return `null`.
**Why it was missed**: The test suite mocked `fs.readdir` / `yaml.load` with plain-string dates, so the coercion never triggered in tests. No test asserted that session objects were actually inserted into the DB after parsing real YAML with timestamp fields.
**How to prevent**:
- When parsing external YAML/JSON into DB-bound types, always validate or coerce at the boundary — never assume string fields arrive as strings.
- Any `try/catch` that silences errors should `console.warn` the error so failures surface during development.
- Add integration tests that pass **real fixture files** (not mocked values) through the full parse → insert pipeline.
**Fix summary**: Added `toIso(val: string | Date)` helper in `copilot-cli-detector.ts`; coerces `created_at`/`updated_at` to ISO strings via `new Date(val).toISOString()` before constructing the `Session` object.

---

## T074 — Claude Code sessions marked ended on server restart

**Date**: 2026-04-01
**Symptom**: After restarting the Argus server, all Claude Code sessions appeared as `ended` in the dashboard even though Claude was still actively running.
**Root cause**: `reconcileStaleSessions()` in `session-monitor.ts` used `if (!session.pid || ...)` to decide whether to mark a session ended. `!null === true` in JavaScript, so every Claude Code session created via hooks (which always store `pid: null`) was unconditionally marked `ended` on every startup.
**Why it was missed**: The original T072 task description explicitly said to mark sessions ended "whose pid is null" — that was incorrect guidance baked into the spec. There were no integration tests for `reconcileStaleSessions()` behaviour with null-PID sessions, so the bug shipped with the fix.
**How to prevent**:
- Never use falsy checks (`!value`) to guard null vs zero/absent — use explicit `!= null` comparisons when null has semantic meaning distinct from 0 or undefined.
- When a session field can legitimately be null (no PID assigned), document what null means and handle it explicitly in any code that branches on that field.
- Add regression tests for startup reconciliation covering both the null-PID (skip) and dead-PID (end) cases.
**Fix summary**: Changed condition in `reconcileStaleSessions()` from `!session.pid ||` to `session.pid != null &&` so sessions without a known PID are skipped; added two regression tests in `tests/unit/session-monitor.test.ts`.

---

## T075 — Claude Code sessions not re-detected on Argus restart (scanExistingSessions broken on Windows)

**Date**: 2026-04-01
**Symptom**: After server restart, Claude Code sessions continued to show as `ended` even after the T074 fix, because the T074 fix only prevented future incorrect marking — already-ended sessions were never restored.
**Root cause**: `scanExistingSessions()` in `claude-code-detector.ts` required `psList` to return a `cwd` property per process to match the project path. On Windows, `psList` (backed by WMIC/tasklist) never returns `cwd`. Every `matchedProcess` lookup returned `undefined`, so the method was a complete no-op on Windows — it never created or re-activated any session.
**Why it was missed**: The method was written and tested on a non-Windows platform or with a mock that provided `cwd`. There were no tests exercising the Windows code path, and the `/* ignore */` catch block hid any errors. The T074 fix was also incomplete because it addressed incorrect ending at startup but didn't address the inability to re-discover running Claude sessions.
**How to prevent**:
- Test platform-specific code (psList on Windows) explicitly. If a function depends on a property that may not exist on all platforms, validate that assumption with a contract test or conditional fallback.
- Any feature that "silently does nothing" (all catch blocks suppressed, no logging) needs an explicit integration test that verifies a session WAS created/updated, not just that no exception was thrown.
- When fixing a bug that has a "before state" (incorrectly ended sessions), always ask: what cleans up the pre-existing bad state?
**Fix summary**: Removed per-process `cwd` match from `scanExistingSessions()`; now checks if any `claude` process is running at all. For each matching project directory, re-activates the most recently ended session (or creates a new startup one). Added 3 regression tests in `tests/unit/claude-code-detector-scan.test.ts`.

*Addendum*: The path-matching logic itself was also wrong — it used `decodeURIComponent(name.replace(/-/g, '/'))` to decode dir names, but Claude actually encodes paths by replacing `:`, `\`, `/` with `-` (e.g. `C:\source\argus` → `C--source-argus`). Decoding this back is lossy (hyphens in dir names are ambiguous). Fixed by encoding registered repo paths forward using the same convention and matching against dir names, instead of decoding dir names backward.

---

## T082 — Model information not shown for Claude Code sessions

**Date**: 2026-04-02
**Symptom**: Model name (e.g. `claude-opus-4-5`) never appeared on session cards or the session detail page for Claude Code sessions, even after conversations had run.
**Root cause**: `readNewJsonlLines` in `claude-code-detector.ts` accepted an `updateModel: boolean` parameter. The chokidar `change` event always called it with `updateModel = false`, meaning model extraction was never attempted for any incremental file-change read. If the initial load (called with `updateModel = true`) happened when the JSONL file had no assistant entries yet (e.g. the user had typed a prompt but Claude hadn't responded), the session's model stayed `null` permanently — every subsequent assistant message arrived via a `change` event where `updateModel = false` suppressed the extraction entirely.
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
**Root cause**: T021 fixed a real timezone bug by adding `timeZone: 'America/Los_Angeles'` to `toLocaleTimeString()` in `SessionDetail.tsx` — but the correct fix was to omit the `timeZone` option entirely so the browser's detected local timezone is used automatically.
**Why it was missed**: The fix was written from the perspective of a PST user. Using `undefined` as the locale (no explicit locale string) plus no `timeZone` option is the correct pattern for "use the user's browser timezone" but it's easy to conflate with "use UTC" or forget that omitting `timeZone` means local timezone.
**How to prevent**: When formatting dates for display in a multi-timezone user context, use `toLocaleTimeString(undefined, { ... })` with NO `timeZone` key to get browser-local timezone. Only set `timeZone` explicitly when you want a specific fixed timezone for all users.
**Fix summary**: Changed `formatTime` in `SessionDetail.tsx` to call `toLocaleTimeString(undefined, { hour, minute, second })` with no explicit `timeZone` — browser's local timezone is used automatically.

---

## T086 — Copilot CLI sessions never show model name

**Date**: 2026-04-02
**Symptom**: Model name was always absent on Copilot CLI session cards, even when the session had `assistant.message` events with a `model` field in `events.jsonl`.
**Root cause**: Three compounding problems: (1) `processSessionDir` hardcoded `model: null` — no extraction was attempted from the events file; (2) `upsertSession` used `model = excluded.model` in the ON CONFLICT clause, which overwrote any previously-detected model with `null` on every scan cycle; (3) `readNewLines` parsed output events but never checked for a `model` field on `assistant.message` events.
**Why it was missed**: Model detection was built for Claude Code via a dedicated `parseModel` helper but was never ported to the Copilot CLI detector. The `upsertSession` overwrite bug was masked because model was always null for CLI sessions — no test existed that set a model then re-scanned.
**How to prevent**: When porting a feature to a second session type, audit all fields the first type sets — ensure none are silently defaulted. For any `ON CONFLICT DO UPDATE`, check every field: use `COALESCE(excluded.field, field)` for fields that should only move from null→non-null, never the reverse.
**Fix summary**: Added `parseModelFromEvent` to `events-parser.ts`; added `extractModelFromEventsFile` helper in `copilot-cli-detector.ts`; `processSessionDir` now passes extracted model; `readNewLines` detects model from new events; `upsertSession` now uses `COALESCE(excluded.model, model)` to preserve any previously-detected model.

---

## T085 — Copilot CLI tool events show raw JSON dump in output stream

**Date**: 2026-04-02
**Symptom**: Tool invocation and tool result items in the Copilot CLI output stream displayed raw JSON strings like `{"type":"tool.execution_start","tool_name":"bash","timestamp":"...","path":"..."}` instead of readable content.
**Root cause**: `parseJsonlLine` in `events-parser.ts` used `JSON.stringify(event)` as the fallback content when `event.content` was not a string. Tool events (`tool.execution_start`, `tool.execution_complete`, `session.start`) have no `content` field — so the entire event object, including redundant metadata fields (`type`, `timestamp`, `tool_name`) already displayed via other UI columns, was serialised into the content cell.
**Why it was missed**: The spec said "tool name displayed prominently without raw JSON" but the frontend rendering was considered the implementation scope. The backend parser's fallback was not scrutinised — it looked reasonable for unknown events but silently broke known tool event types.
**How to prevent**: When extracting content from a structured event, always strip metadata fields that are already surfaced through other channels before stringifying. Add a regression test for each known event type that has no `content` field to assert the rendered content is clean.
**Fix summary**: Added `extractContent()` helper in `events-parser.ts` that strips `type`, `timestamp`, `tool_name`, and `content` from the event before stringifying remaining fields; returns empty string if nothing remains; returns the raw string value when only one string field remains.
