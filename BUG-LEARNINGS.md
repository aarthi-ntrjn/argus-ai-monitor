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
