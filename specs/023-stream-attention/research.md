# Research: 023-stream-attention

## Decision 1: Where to store the display mode toggle state?

**Decision**: Add `outputDisplayMode: 'focused' | 'verbose'` to the existing `DashboardSettings` interface in `frontend/src/types.ts`. The existing `useSettings` hook persists to `localStorage` under `argus:settings` and already merges with `DEFAULT_SETTINGS` — no new infrastructure needed.

**Rationale**: The clarification confirmed the mode must persist globally. `DashboardSettings` + `useSettings` is the established pattern for exactly this. Adding one field is trivial.

**Alternatives considered**:
- Component-local `useState`: Rejected — doesn't persist across pane reopens.
- Separate `localStorage` key: Rejected — duplicates existing settings infrastructure.

---

## Decision 2: Where does the toggle control live?

**Decision**: The toggle belongs in `OutputPane`'s header bar (next to the close button). `OutputPane` reads/writes the setting via `useSettings` and passes `displayMode` as a prop to `SessionDetail`.

**Rationale**: `OutputPane` owns the pane chrome (title, close button). It's the natural host for display controls. `SessionDetail` should remain a pure rendering component that accepts display mode as a prop.

**Alternatives considered**:
- Toggle inside `SessionDetail`: Rejected — would require `SessionDetail` to know about settings, mixing concerns.

---

## Decision 3: How to summarise tool_use content?

**Decision**: Build a `summariseToolUse(item: SessionOutput): string` utility in `sessionDetailUtils.ts`. Logic:
1. If `content` does not start with `{` (i.e., already a plain string): use `content` directly.
2. If `content` starts with `{` (JSON): try to parse and extract `path`, `file_path`, `command`, or the first string value; fall back to first 80 chars of raw content.
3. Prepend `toolName + ": "` if `toolName` is set; truncate result to 80 chars.

**Rationale**: The backend already extracts single-string arguments as plain strings (common case: Read, Bash). Multi-argument tools (Edit, Write) produce JSON with a `path` key that's the most meaningful summary.

**Alternatives considered**:
- Backend-side summarisation: Rejected — spec says pure frontend change; backend change would be over-engineering.

---

## Decision 4: How to render individual expand/collapse in Focused mode?

**Decision**: `SessionDetail` maintains a local `Set<string>` (expanded item IDs) in `useState`. Clicking a collapsed `tool_result` indicator adds its ID to the set. Clicking an expanded result removes it.

**Rationale**: Expansion state is ephemeral per render. No persistence needed. A `Set` is O(1) for add/delete/has.

**Alternatives considered**:
- Persisting expanded state: Rejected — expand state is a temporary dig-in action, not a preference.

---

## AI Session Message Types Reference

This was the primary research question. Summary of all message types produced by Claude Code and Copilot CLI sessions as observed in the parsers:

| type | role | toolName | When produced | Typical content |
|---|---|---|---|---|
| `message` | `user` | null | User sends a prompt | The prompt text |
| `message` | `assistant` | null | AI produces a text response | Markdown prose, reasoning |
| `tool_use` | null | "Read", "Write", "Edit", "Bash", "Glob", "Grep", etc. | AI calls a tool | File path, command, or JSON args |
| `tool_result` | null | tool_use_id or null | Tool execution returns output | File contents, command stdout, search results |
| `error` | null | null | An error is encountered | Error message string |
| `status_change` | null | null | Session lifecycle event | "session.start" type events |
