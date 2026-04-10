# Implementation Plan: Smart Output Stream Display

**Branch**: `023-stream-attention` | **Date**: 2026-04-10 | **Spec**: `specs/023-stream-attention/spec.md`
**Input**: Feature specification from `/specs/023-stream-attention/spec.md`

## Summary

Replace the flat, undifferentiated output stream display with a two-mode rendering system.
"Focused" mode (default) hides `tool_result` rows and shows compact summaries for
`tool_use` rows. "Verbose" mode restores full current behaviour. A toggle in the output
pane header persists the chosen mode globally via `localStorage` (merged into existing
`DashboardSettings`). Individual `tool_result` rows in Focused mode can be expanded inline.

This is a **pure frontend change**. No backend, API, or DB modifications are required.

## Technical Context

**Language/Version**: TypeScript 5.x, React 18.3
**Primary Dependencies**: React Query (existing), Tailwind CSS (existing), React Markdown (existing)
**Storage**: `localStorage` via existing `useSettings` hook (`argus:settings` key)
**Testing**: Vitest + React Testing Library (existing frontend test setup)
**Target Platform**: Web (desktop + mobile, same responsive layout)
**Project Type**: React web application (frontend workspace)
**Performance Goals**: Mode toggle < 100ms; expand/collapse < 16ms (pure state change, no network)
**Constraints**: Must preserve dark/light theme; must not change backend or API contracts
**Scale/Scope**: Single-user localhost tool; output panes render up to 100 items per page

## Constitution Check

| Principle | Status | Notes |
|---|---|---|
| §I Engineering (reliable, observable, testable) | PASS | Pure UI change; all components unit-tested |
| §II Architecture (clear API boundaries) | PASS | No API changes; UI-only |
| §III Code Standards (readable, functions < 50 lines) | PASS | Small focused helper functions planned |
| §IV Test-First | PASS | Tests written before implementation per workflow |
| §V Testing (unit + integration + e2e coverage) | PASS | Unit tests for all new components and utils |
| §VI Security (auth, audit) | PASS | No security surface changed |
| §VII Observability | PASS | No new services; no observability changes needed |
| §VIII Performance (p95 < 500ms) | PASS | All changes are synchronous state updates |
| §IX AI Usage | PASS | Human review required before merge |
| §X Definition of Done | PASS | Tests, docs, README update included in task list |
| §XI Documentation | PASS | README update task included |
| §XII Error Handling | PASS | No new error surfaces |

## Project Structure

### Documentation (this feature)

```text
specs/023-stream-attention/
├── plan.md
├── research.md
├── data-model.md
├── contracts/
└── tasks.md
```

### Source Code (affected files)

```text
frontend/src/
├── types.ts                                       # Add outputDisplayMode to DashboardSettings
├── hooks/
│   └── useSettings.ts                             # No change needed (generic, already handles new keys)
├── components/
│   ├── OutputPane/
│   │   └── OutputPane.tsx                         # Add mode toggle in header
│   └── SessionDetail/
│       ├── SessionDetail.tsx                      # Add focused/verbose rendering logic
│       └── sessionDetailUtils.ts                  # NEW: summariseToolUse(), isAlwaysVisible()
└── __tests__/
    └── SessionDetail.test.tsx                     # Extend existing tests

frontend/src/__tests__/
├── SessionDetail.test.tsx                         # Extend with focused/verbose mode tests
└── sessionDetailUtils.test.ts                     # NEW: unit tests for summarise logic
```

## Phase 0: Research

See `research.md` for detailed investigation notes.

Key findings:
- `tool_use` content is already a plain string for single-argument tools (backend extracts it). No client-side JSON parsing is needed for the common case.
- `toolName` is already populated on `tool_use` rows.
- `DashboardSettings` in `types.ts` + `useSettings.ts` + `localStorage` is the correct persistence layer for display mode — adding `outputDisplayMode: 'focused' | 'verbose'` follows the existing pattern exactly.
- `OutputPane` passes items down to `SessionDetail` — the toggle belongs in `OutputPane` header; the rendering logic belongs in `SessionDetail`.
- The `SessionDetail` component already receives a `dark` prop for theming — this must be threaded through to new UI elements.
