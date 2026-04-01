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
