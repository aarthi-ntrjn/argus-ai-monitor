# Implementation Plan: Session Prompt History Navigation

**Branch**: `051-prompt-history` | **Date**: 2026-04-20 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/051-prompt-history/spec.md`

## Summary

Add up/down arrow key history navigation to the `SessionPromptBar` component. Users can cycle through previously sent prompts (from both the Argus prompt bar and the Claude/Copilot terminal "you" messages) without retyping. The currently typed draft is preserved and restored when navigating back past the newest entry. A subtle inline indicator shows the history position while navigating.

This is a **pure frontend feature**: no backend changes, no new API endpoints, no database changes. All history state lives in-memory in a new `usePromptHistory` React hook.

## Technical Context

**Language/Version**: TypeScript 5.x, React 18  
**Primary Dependencies**: React Query (`@tanstack/react-query`) for session output data; existing `sendPrompt` API  
**Storage**: In-memory only — history is not persisted across page reloads  
**Testing**: Vitest + React Testing Library + `@testing-library/user-event` (existing test setup)  
**Target Platform**: Browser (all OS) — keyboard events use standard `e.key` values  
**Project Type**: Web application (frontend only)  
**Performance Goals**: 100ms per keypress response (SC-004, SC-006) — trivially met by in-memory state transitions  
**Constraints**: 50-entry cap per session; no deduplication; no persistence  
**Scale/Scope**: Single-user localhost tool; per-session history up to 50 entries

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| §I Engineering (reliable, observable, testable, reversible) | PASS | Hook is pure and unit-testable; feature flag not needed (additive only) |
| §II Architecture (versioned API boundaries) | EXCEPTION | Pure frontend; no new service boundary created |
| §III Code Standards (readable, functions < 50 lines, docs) | PASS | Hook functions split into focused helpers; public hook API documented |
| §IV Test-First | PASS | Tests written before implementation in tasks |
| §V Testing (unit + integration + e2e coverage) | PASS | Unit tests for hook; component tests for bar; no regression |
| §VI Security (auth/authz) | EXCEPTION | Localhost-only tool per §VI exception; no auth surface changes |
| §VII Observability (structured logs, metrics) | EXCEPTION | Client-side UX feature; no backend metrics relevant |
| §VIII Performance (100ms p95) | PASS | In-memory state, zero I/O on keypress |
| §IX AI Usage | PASS | Human review required before merge |
| §X Definition of Done | PASS | All criteria addressed in tasks |
| §XI Documentation | PASS | README.md updated in same PR (task T-last) |
| §XII Error Handling | PASS | No new async paths; existing error handling unchanged |

> **§XI Documentation**: README.md MUST be updated in the same PR as this user-facing change.

## Project Structure

### Documentation (this feature)

```text
specs/051-prompt-history/
├── plan.md              # This file
├── research.md          # Phase 0 decisions
├── data-model.md        # In-memory data shapes
└── tasks.md             # Dependency-ordered task list
```

### Source Code (files created or modified)

```text
frontend/
├── src/
│   ├── hooks/
│   │   └── usePromptHistory.ts          # NEW — history state hook
│   └── components/
│       └── SessionPromptBar/
│           └── SessionPromptBar.tsx     # MODIFIED — arrow key handling + indicator
└── src/
    └── __tests__/
        ├── usePromptHistory.test.ts     # NEW — hook unit tests
        └── SessionPromptBar.test.tsx    # MODIFIED — new history navigation tests
```

**Structure Decision**: Frontend-only, single workspace (`frontend/`). No backend files touched.

## Implementation Approach

### History State Hook: `usePromptHistory`

The hook encapsulates all history logic and is the sole owner of history state.

**Inputs:**
- `sessionId: string` — used as the react-query cache key for session output
- `sessionOutputItems: SessionOutput[]` — passed in from the parent (avoids double-fetching; `OutputPane` already fetches this)

**State:**
- `entries: string[]` — all history entries in chronological order, newest last; capped at 50
- `historyIndex: number | null` — `null` = draft mode; `0` = most recent (index from end); increments going further back
- `draft: string` — text saved when user first presses up arrow

**Returned API:**
- `isNavigating: boolean` — `historyIndex !== null`
- `indicator: string | null` — e.g., `"3 / 12"` while navigating, `null` otherwise
- `navigateUp(currentInput: string): string` — returns the text to show; saves draft on first call
- `navigateDown(): string` — returns next newer text, or draft when past the end
- `addEntry(text: string): void` — appends to entries (called on send), resets navigation state
- `resetNavigation(): void` — returns to draft mode (called on send or explicit reset)

### Terminal Message Backfill and Sync

`SessionPromptBar` will use `useQuery(['session-output', session.id])` — the same query key used by `OutputPane`. React Query serves the cached result, so there is no double network request.

The hook derives terminal "you" messages from `sessionOutputItems` (entries where `role === 'user'` and `type === 'message'` and `!isMeta`).

**Bar-sent message deduplication**: When the user sends via the bar, the message is typed into the PTY and will eventually appear in session output as a "you" message. To prevent double-counting:
- Keep a `pendingBarSends: Map<string, number>` (text → count of pending sends).
- On `addEntry(text)`: increment count in `pendingBarSends`.
- When session output gains new "you" messages: for each one, if it exists in `pendingBarSends` (count > 0), decrement and skip (already in `entries`); otherwise add to `entries`.

This correctly handles the user sending the same text multiple times.

### History Mode Indicator

While `historyIndex !== null`, display `"{position} / {total}"` next to the input where position = index from newest (1 = most recent). Rendered as a small `<span>` inside the prompt bar row. Disappears on send or when navigating back to draft.

### Up Arrow Key Behavior

`e.key === 'ArrowUp'` in `handleKeyDown`: call `navigateUp(prompt)`, set the returned text as `prompt`. Use `e.preventDefault()` to suppress browser default (cursor movement to start of input). This override applies regardless of cursor position in the input (FR-012).

### Down Arrow Key Behavior

`e.key === 'ArrowDown'` in `handleKeyDown`: call `navigateDown()`, set returned text. Only prevent default when actively navigating (`isNavigating`); otherwise allow browser default.
