# Implementation Plan: Fix Blank MSG Rows in Copilot Output Rendering

**Branch**: `019-fix-output-rendering` | **Date**: 2026-04-06 | **Spec**: [spec.md](spec.md)

## Summary

The copilot output pane renders rows with a "MSG" badge and blank content when `events.jsonl` contains event types that `events-parser.ts` does not recognise. Unrecognised types fall through to the default `type: message, role: null` path; the content-extraction fallback then strips all known meta-fields and returns `""`. The fix extends `extractContent` to (1) handle `data.content` as a typed content-block array (for forward-compatibility with Copilot CLI format changes), and (2) for genuinely unrecognised event types, serialize `event.data` as JSON so the MSG row is never blank.

## Technical Context

**Language/Version**: TypeScript (Node.js 20, ESM)
**Primary Dependencies**: Vitest (unit testing)
**Storage**: N/A — parser is a pure transform function
**Testing**: Vitest (`npm run test --workspace=backend`)
**Target Platform**: Node.js backend service
**Project Type**: Backend service (single-machine developer tool)
**Performance Goals**: Parser executes synchronously per JSONL line; no measurable overhead expected
**Constraints**: Must not break existing T085/T088/T086 regression tests; no schema changes; no frontend changes
**Scale/Scope**: §VIII Exception applies — single-user localhost tool

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| §I Engineering — reliable, testable, debuggable | PASS | New tests written test-first per §IV |
| §II Architecture — clear API boundaries | PASS | No boundary changes; pure function fix |
| §III Code Standards — functions < 50 lines | PASS | `extractContent` stays under limit after change |
| §IV Test-First | PASS | Regression and new tests written before implementation |
| §V Testing — unit tests, coverage not decreased | PASS | New test cases added; coverage increases |
| §VI Security | PASS | No auth/authz surface affected; §VI Exception applies (localhost) |
| §VII Observability | PASS | No log changes needed for a pure parser fix |
| §VIII Performance | PASS | §VIII Exception applies (single-user tool) |
| §IX AI Usage | PASS | Human review of AI-generated fix required |
| §X Definition of Done | PASS | Tests, docs, README updated in same PR |
| §XI Documentation | PASS | README-CLI-COMPARISON.md updated to reflect new behaviour |
| §XII Error Handling | PASS | No new error surfaces; parser already uses try/catch |

## Project Structure

### Documentation (this feature)

```text
specs/019-fix-output-rendering/
├── plan.md              (this file)
├── research.md
├── spec.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (affected files only)

```text
backend/
├── src/
│   └── services/
│       └── events-parser.ts          ← primary change
└── tests/
    └── unit/
        └── events-parser.test.ts     ← new test cases

docs/
└── README-CLI-COMPARISON.md          ← update Copilot event mapping section
```

## Implementation Phases

### Phase 0 — Research

See `research.md`.

### Phase 1 — Fix and Tests

Two changes to `events-parser.ts`:

1. **Array content-block handling**: In `extractContent`, after the `typeof data.content === 'string'` check, add a branch for `Array.isArray(data.content)` that concatenates all `{type: "text", text: "..."}` blocks into a single string (joined by `"\n"`). Non-text blocks are skipped.

2. **Unrecognised event type fallback**: In `parseJsonlLine`, after `outputType` and `role` are resolved, detect when `outputType === 'message' && role === null` (i.e. the event is not a recognised copilot type). For these rows, if `extractContent` returned `""`, replace the content with `JSON.stringify(event.data ?? {})` so the MSG row is never blank.

Both changes are additive — no existing code paths are removed.
