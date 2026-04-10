# Feature Specification: Smart Output Stream Display

**Feature Branch**: `023-stream-attention`
**Created**: 2026-04-10
**Status**: Clarified
**Input**: User description: "Change how output stream content is shown. Right now it shows everything. Want to change it to help manage user attention better. Need to understand the kind of messages that are sent in an AI session."

## Background: AI Session Message Types

An AI coding session (Claude Code or Copilot CLI) produces five distinct message types:

| Type | Role | Description | Volume | Signal Level |
|---|---|---|---|---|
| `message` | `user` | Prompt sent by the user | Low | High |
| `message` | `assistant` | AI text response / thinking | Medium | High |
| `tool_use` | - | AI calling a tool (Read, Write, Bash, etc.) with arguments | High | Medium |
| `tool_result` | - | Raw output returned from tool execution | Very High | Low (often noise) |
| `status_change` | - | Session lifecycle events (start, end) | Very Low | High |
| `error` | - | Errors encountered during the session | Rare | Critical |

**The problem**: `tool_result` rows dominate the stream and are mostly internal scaffolding
(file contents, command stdout, etc.). They bury the high-signal AI responses and user prompts
that tell the story of what the session is doing.

---

## User Scenarios & Testing

### User Story 1 - Focus Mode by Default (Priority: P1)

A developer monitoring an active session wants to understand what the AI is doing without
wading through hundreds of raw tool output lines. By default, the output stream shows only
the high-signal messages: user prompts, AI responses, tool calls (what the AI decided to
do), and errors. Tool results are collapsed/hidden unless explicitly expanded.

**Why this priority**: This is the core attention management improvement. It immediately
reduces noise for every user who opens a session's output pane.

**Independent Test**: Can be tested with any session that has tool_use/tool_result pairs.
Open the output pane and confirm tool_result rows are collapsed. The remaining messages tell
a coherent story of the session.

**Acceptance Scenarios**:

1. **Given** a session with mixed output types, **When** the output pane opens, **Then** tool_result rows are collapsed by default and not visible in the main stream.
2. **Given** a collapsed tool_result row, **When** the user clicks an expand control, **Then** the raw tool result content is revealed inline.
3. **Given** an error output item, **When** it appears in the stream, **Then** it is always visible (never collapsed) and visually prominent.
4. **Given** a session with no tool_result rows, **When** the output pane opens, **Then** the display looks identical to the current behaviour.

---

### User Story 2 - Tool Call Summary (Priority: P1)

When the AI calls a tool, the user sees a compact summary row: tool name and a one-line
preview of the arguments (e.g., "Read: src/components/App.tsx" or "Bash: npm run test").
This replaces the current raw JSON argument dump and makes tool activity scannable.

**Why this priority**: Tool calls are the most frequent message type and currently hard to
read. A compact summary dramatically improves scannability without losing information.

**Independent Test**: Open a session with tool_use entries. Confirm the tool name and a
human-readable argument preview are shown instead of raw JSON.

**Acceptance Scenarios**:

1. **Given** a `tool_use` item for a file-based tool (Read, Write, Edit), **When** rendered, **Then** the display shows "ToolName: filepath" as a compact one-line summary.
2. **Given** a `tool_use` item for a command-based tool (Bash, Execute), **When** rendered, **Then** the display shows "Bash: command" truncated at ~80 chars.
3. **Given** any `tool_use` item, **When** the user clicks the summary row, **Then** the full raw argument JSON is revealed inline (expandable).

---

### User Story 3 - View Toggle: Focused vs Verbose (Priority: P2)

A developer debugging a specific tool call or investigating an unexpected result wants to see
everything. A toggle button in the output pane header switches between "Focused" (default)
and "Verbose" (current behaviour: all rows visible, all content expanded).

**Why this priority**: Power users need the full picture. Without this, the focused view
could hide critical debugging information.

**Independent Test**: Click the toggle. Confirm verbose mode shows all rows including
tool_results at full content. Click again to return to focused mode.

**Acceptance Scenarios**:

1. **Given** focused mode is active, **When** the user clicks "Verbose" toggle, **Then** all tool_result rows become visible with full content.
2. **Given** verbose mode is active, **When** the user clicks "Focused" toggle, **Then** tool_result rows collapse again.
3. **Given** the user switches to verbose mode, **When** they close and reopen the output pane, **Then** the mode persists globally — the user's last chosen mode (Focused or Verbose) is remembered across all sessions and pane reopens.

---

### User Story 4 - Tool Result Truncation in Verbose Mode (Priority: P3)

In verbose mode, tool results with very long content (e.g., reading a large file) are
truncated to a configurable maximum height with a "Show more" control. This prevents the
page from being overwhelmed by a single large tool result.

**Why this priority**: Nice-to-have improvement for verbose mode; focused mode already
handles this by collapsing results entirely.

**Independent Test**: In verbose mode, view a session with a large file read. Confirm the
content is capped and a "Show more" button is present.

**Acceptance Scenarios**:

1. **Given** verbose mode and a tool_result with content > 40 lines, **When** rendered, **Then** content is truncated at 40 lines with a "Show more" link.
2. **Given** a truncated tool_result, **When** "Show more" is clicked, **Then** the full content expands inline.

---

### Edge Cases

- What happens when a tool_result is the only item in a session (no assistant messages)? Show the result; do not suppress all content in focused mode if it would leave the pane empty.
- How does the system handle `tool_result` items whose content is itself an error string? Treat as a regular tool_result; the error badge applies to `type: error` rows only.
- What if the session has only `status_change` and `tool_result` entries? Show status_change entries; tool_result entries follow normal collapse rules.
- Long tool names: truncate at 20 chars with ellipsis in the summary line.

---

## Requirements

### Functional Requirements

- **FR-001**: The output pane MUST default to "Focused" display mode for all sessions.
- **FR-002**: In Focused mode, `tool_result` rows MUST be hidden from the main stream.
- **FR-003**: Each `tool_use` row MUST render a compact human-readable summary (tool name + argument preview) instead of raw JSON.
- **FR-004**: Each collapsed `tool_result` MUST be individually expandable inline via a user click.
- **FR-005**: The output pane MUST provide a toggle control to switch between Focused and Verbose modes.
- **FR-006**: In Verbose mode, all rows MUST be visible (identical to current behaviour, with tool_result shown in full).
- **FR-007**: `error` type rows MUST always be visible regardless of display mode.
- **FR-008**: `status_change` rows MUST always be visible regardless of display mode.
- **FR-009**: Tool result content exceeding 40 lines in Verbose mode MUST be truncated with a "Show more" control (P3).
- **FR-010**: Display mode toggle state MUST persist globally in user settings — the last chosen mode (Focused or Verbose) is retained across all sessions and pane reopens. Default is Focused.

### Key Entities

- **SessionOutput**: Existing entity. Fields: `id`, `sessionId`, `timestamp`, `type` (message/tool_use/tool_result/error/status_change), `content`, `toolName`, `role`, `sequenceNumber`.
- **DisplayMode**: UI-only concept. Values: `focused` (default) | `verbose`.
- **ExpandedSet**: UI-only state. Set of `SessionOutput.id` values the user has manually expanded in focused mode.

## Success Criteria

### Measurable Outcomes

- **SC-001**: In Focused mode, a session with tool_result rows shows only user/assistant/tool_use/error/status rows, reducing visible row count by the number of tool_results.
- **SC-002**: Every `tool_use` row renders a non-JSON summary line of 80 characters or fewer.
- **SC-003**: Switching between Focused and Verbose mode takes < 100ms (pure frontend state change, no network calls).
- **SC-004**: Individual tool_result expand/collapse is instantaneous (< 16ms, single re-render).
- **SC-005**: Verbose mode output is equivalent in content to the current implementation.

## Assumptions

- This is a pure frontend change. No backend API changes are required.
- The `SessionDetail` component is the primary rendering target.
- The `OutputPane` component hosts the mode toggle control in its header bar.
- Tool argument summarisation is done client-side using the existing `content` field (already extracted from raw JSON by the backend parser).
- Mobile layout is in scope; the toggle and expand controls must be touch-friendly.
- The existing dark/light theme support in `SessionDetail` must be preserved.

## Clarifications

### Session 2026-04-10

- **Toggle persistence**: The Focused/Verbose mode toggle persists globally in user settings. The last chosen mode is remembered across all sessions and pane reopens. Default is Focused.
- **Tool_use summarisation**: The compact summary (`ToolName: content-preview`) is constructed from the `toolName` field and the existing `content` field already extracted by the backend — no additional parsing required. For multi-argument tools, the `path` key is used as the preview value when available. The summary row is expandable to reveal full JSON arguments on click.
