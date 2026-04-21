# Research: Session Prompt History Navigation

**Branch**: `051-prompt-history` | **Date**: 2026-04-20

## Decision Log

### D-001: History state location — component-local vs shared hook

**Decision**: Extract into a dedicated `usePromptHistory` hook (not inline state in the component).

**Rationale**: The history logic involves multiple interacting state variables (`entries`, `historyIndex`, `draft`, `pendingBarSends`) and a useEffect to sync with session output. Keeping this inline in `SessionPromptBar` would push the component past 50 lines (§III) and make the logic hard to test in isolation (§I). A hook allows unit tests without rendering the full component.

**Alternatives considered**:
- Inline state in `SessionPromptBar`: simpler, but violates function-size and testability principles.
- Context/global store: overkill; history is per-session and belongs to the session view scope.

---

### D-002: Source of terminal "you" messages — new query vs shared cache

**Decision**: Call `useQuery(['session-output', session.id])` inside `SessionPromptBar`. React Query's shared cache means `OutputPane` (which uses the same key) has already populated the cache; no second network request is made.

**Rationale**: The alternative — passing `sessionOutputItems` as a prop from `SessionPage` — would require `SessionPage` to fetch output itself (double fetch) or thread a prop through `OutputPane`, which leaks internal concerns upward. Cache sharing is the idiomatic React Query pattern.

**Alternatives considered**:
- Prop drilling from `SessionPage`: requires `SessionPage` to own session output fetch, conflicting with the current design where `OutputPane` owns it.
- Callback/ref from `OutputPane`: overly complex and creates tight coupling between sibling components.

---

### D-003: Bar-sent message deduplication strategy

**Decision**: Use a `Map<string, number>` (text → pending count) to track bar-sent messages that have not yet appeared in session output. When new session output "you" messages arrive, decrement the count for matching text before adding to history entries.

**Rationale**: Bar-sent messages are typed into the PTY and appear in session output (as Claude/Copilot JSONL "user" entries) after a short delay. Without deduplication, the same message would appear twice: once on send (immediately) and once when session output updates. The Map approach handles repeated identical sends correctly.

**Alternatives considered**:
- No deduplication (accept brief duplicates): poor UX — user sees their message appear twice for a few seconds.
- Session output only (no immediate add): violates FR-007; bar message missing from history until the next query refetch (~5s).
- `Set<string>` instead of `Map<string, number>`: fails when the same text is sent twice in quick succession (count becomes negative).

---

### D-004: Up arrow default browser behavior suppression

**Decision**: Always call `e.preventDefault()` on `ArrowUp` when the input is focused (regardless of cursor position), to suppress the browser's native "move cursor to start" behavior.

**Rationale**: FR-012 requires up arrow to work from any cursor position. The browser default for `ArrowUp` in a text input is to move the cursor to the start of the line. This conflicts directly with history navigation. Suppressing it is the correct and expected behavior (matching shells, browser address bars, etc.).

**Alternatives considered**:
- Only suppress when `historyIndex === null` (first press): would leave cursor-jump behavior on subsequent presses when `historyIndex > 0`, creating inconsistency.
- Suppress only when cursor is at position 0: violates FR-012 (must work from any position).

---

### D-005: History mode indicator placement

**Decision**: Render the indicator as a small `<span>` inside the existing prompt bar row, to the left of the input field (or as a subtle overlay). Use a fixed-width format `"{n} / {total}"`.

**Rationale**: The indicator must appear within 100ms (SC-006) and disappear automatically. Inline in the same flex row avoids layout shift in other parts of the UI. The format "3 / 12" is familiar from browser and editor history navigation patterns.

**Alternatives considered**:
- Tooltip: less visible; requires hover on mobile.
- Toast notification: inappropriate for a real-time per-keypress indicator.
- Badge next to the send button: possible but more complex; left-of-input is more conventional.
