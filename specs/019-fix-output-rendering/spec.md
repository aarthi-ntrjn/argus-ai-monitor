# Feature Specification: Fix Blank MSG Rows in Copilot Output Rendering

**Feature Branch**: `019-fix-output-rendering`
**Created**: 2026-04-06
**Status**: Draft

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Copilot Output Shows No Blank Rows (Priority: P1)

A developer monitoring a GitHub Copilot CLI session opens the output pane and sees the conversation stream. Currently, rows appear with a "MSG" badge but completely blank content. These blank rows come from copilot event types that the parser does not recognise: they fall through to the default `type: message, role: null` path, and the content extraction strips all known fields and returns an empty string.

The user wants every visible row in the copilot output pane to either show meaningful content or not appear at all. Blank rows are confusing and make the output hard to read.

**Why this priority**: The output pane is the primary way users monitor what Copilot is doing. Blank rows degrade trust and readability.

**Independent Test**: Open the output pane for any copilot-cli session and confirm that no row with the "MSG" badge has an empty content column. Either blank-content rows are hidden, or their content is filled from the event payload.

**Acceptance Scenarios**:

1. **Given** a copilot session with events.jsonl containing an unrecognised event type, **When** the output pane loads, **Then** no row shows a blank content area.
2. **Given** a copilot session with standard `assistant.message` and `user.message` events, **When** the output pane loads, **Then** all message rows show the correct non-empty content with AI / YOU badges.
3. **Given** a copilot session where an `assistant.message` event has `data.content` as a non-string (e.g. empty string or array), **When** the parser processes the event, **Then** the parser either returns a best-effort string or returns null so the output-store skips the row.

---

### User Story 2 - Content Blocks in Copilot Messages Are Rendered (Priority: P2)

If the GitHub Copilot CLI evolves to write `data.content` as an array of typed content blocks (matching the Anthropic API structure), the parser must handle that case and produce a human-readable string rather than returning blank.

**Why this priority**: Forward-compatibility concern. The fix for US1 should not regress if Copilot CLI changes its content format.

**Independent Test**: Feed the parser an `assistant.message` event whose `data.content` is an array of `{type: "text", text: "..."}` blocks and confirm the output contains the concatenated text.

**Acceptance Scenarios**:

1. **Given** an `assistant.message` event with `data.content: [{"type":"text","text":"Hello"}]`, **When** the parser runs, **Then** the resulting content is `"Hello"` (or the blocks joined with newlines).
2. **Given** a mixed array `[{"type":"text","text":"Part 1"}, {"type":"text","text":"Part 2"}]`, **When** the parser runs, **Then** the resulting content contains both parts.

---

### Edge Cases

- What happens when an unrecognised event type has a `data` object with no string fields? Parser must return null or empty string (not crash).
- What happens when `data.content` is `null`? Must be treated the same as undefined and fall through gracefully.
- What happens when `data.content` is an empty string `""`? The truthiness guard `&& data.content` currently skips it; this should be treated as intentionally blank (row shown with empty content is acceptable, or row suppressed).
- What happens with no `data` field at all on an unrecognised event? Fallback must strip all meta fields and return `''` or null.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The events parser MUST NOT produce rows with `type: message` and `role: null` from unrecognised copilot event types that have no meaningful content.
- **FR-002**: The events parser MUST handle `data.content` as an array of typed content blocks, joining text blocks into a single string.
- **FR-003**: The events parser MUST return null (so the output store skips the row) when an event has no extractable content and the event type is not a recognised copilot event type.
- **FR-004**: Existing handling for `user.message` and `assistant.message` with plain string `data.content` MUST NOT regress.
- **FR-005**: The UI MUST NOT display rows with blank content in the copilot output pane.

### Key Entities

- **SessionOutput**: The parsed row stored per event. Fields: `id`, `sessionId`, `timestamp`, `type`, `content`, `toolName`, `role`, `sequenceNumber`. The `content` field is the one that becomes blank.
- **CopilotEvent**: A raw JSONL line from `~/.copilot/session-state/{uuid}/events.jsonl`. Fields: `type`, `id`, `parentId`, `timestamp`, `data`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Zero rows with the "MSG" badge and blank content appear in the copilot output pane for any real-world session.
- **SC-002**: All unit tests for `events-parser.ts` pass, including new tests covering array content blocks and unrecognised event types.
- **SC-003**: Opening the output pane for a copilot session shows at least one AI-badged row with non-empty content (regression check for the primary happy path).
- **SC-004**: No existing tests for claude-code output parsing are broken.

## Assumptions

- The fix is confined to `backend/src/services/events-parser.ts` and its unit tests.
- No schema changes are needed; `content` remains a `string` field on `SessionOutput` (empty string is acceptable, null/blank rows should be suppressed upstream at the parser layer).
- The copilot CLI writes well-formed JSON on each line; malformed lines are already handled by the existing try/catch.
- The frontend `SessionDetail` component renders correctly as long as `content` is a non-null string; no frontend changes are needed.
