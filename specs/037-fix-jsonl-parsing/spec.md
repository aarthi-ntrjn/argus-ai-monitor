# Feature Specification: Fix JSONL Parsing Logic Differences Between Claude and Copilot

**Feature Branch**: `037-fix-jsonl-parsing`
**Created**: 2026-04-18
**Status**: Draft
**Input**: User description: "i want to work on a branch to fix the jsonl parsing logic differences between claude and copilot, including what is loaded on start and how much is loaded and how it is loaded"

## Clarifications

### Session 2026-04-18

- Q: How should file positions be persisted across restarts to avoid re-parsing the full file? → A: No persistent byte-offset storage. On restart, both watchers apply the tail-read (last X bytes) without clearing stored output. INSERT OR IGNORE deduplication handles any overlap between the tail window and already-stored entries.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Consistent Message Display (Priority: P1)

As a developer monitoring both Claude Code and GitHub Copilot sessions in Argus, I want all session messages (user messages, assistant responses, and tool activity) to appear correctly and completely in the session output panel, regardless of which agent type produced them.

Currently, Claude Code sessions and Copilot sessions use different JSONL event formats, and small parsing differences can cause messages to be missing, truncated, or wrongly structured for one session type but not the other.

**Why this priority**: Correct message display is the core value of Argus. If session output is missing or malformed for either agent type, the tool is unreliable for monitoring real work.

**Independent Test**: Start a Claude Code session and a Copilot session side by side. Send a message, trigger a tool call, and observe the output panel for both. Both should show the same categories of information (user message, assistant reply, tool name, tool result) in a similarly structured way.

**Acceptance Scenarios**:

1. **Given** a Claude Code session with a multi-block assistant response (text + tool_use + tool_result), **When** Argus parses the JSONL, **Then** each block is represented as a distinct output entry with the correct role and content.
2. **Given** a Copilot session with an `assistant.message` event containing a content-block array, **When** Argus parses the JSONL, **Then** all text content is captured and no block is silently dropped.
3. **Given** a Copilot session with a `tool.execution_start` event, **When** Argus parses the JSONL, **Then** the tool name and arguments are surfaced as a tool_use entry (not a raw JSON dump).
4. **Given** a Copilot session with a `tool.execution_complete` event, **When** Argus parses the JSONL, **Then** the tool result content is surfaced as a tool_result entry.
5. **Given** a Claude Code session with a `file-history-snapshot` entry, **When** Argus parses the JSONL, **Then** the entry is silently skipped and no spurious output appears.

---

### User Story 2 - Consistent Model Detection (Priority: P1)

As a developer viewing session cards or the session detail panel, I want to see the AI model name (e.g., `claude-opus-4-5`, `gpt-4o`) displayed for both Claude Code and Copilot sessions, so I know which model handled each session.

**Why this priority**: Model detection is broken or unreliable on at least one parser path. This is observable information that users rely on to understand their sessions.

**Independent Test**: Start a new session for each agent type, let it produce at least one assistant response, and confirm the session card shows a non-empty model name within one scan cycle.

**Acceptance Scenarios**:

1. **Given** a Claude Code session whose JSONL contains an assistant entry with a `message.model` field, **When** Argus parses the entry, **Then** the session record is updated with the correct model name.
2. **Given** a Copilot session whose `events.jsonl` contains an `assistant.message` event with a nested `data.model` field, **When** Argus parses the entry, **Then** the session record is updated with the correct model name.
3. **Given** a session whose model was already detected in a previous scan, **When** new JSONL lines arrive without a model field, **Then** the previously detected model is preserved (not overwritten with null).
4. **Given** a session where model detection occurs mid-session (not on the first event), **When** Argus eventually encounters the model field, **Then** the session card is updated to show the model without requiring a restart.

---

### User Story 3 - No Spurious or Missing Output on Session Watch Start (Priority: P2)

As a developer who opens an in-progress Copilot session in Argus, I want to see the full historical output of that session, not a blank or partially cleared panel, and I want the view to stay consistent as new lines arrive.

**Why this priority**: The Copilot watcher currently clears all existing output every time file watching starts. This can cause output to disappear unexpectedly on reconnect or on first load.

**Independent Test**: Start a Copilot session, let it produce several exchanges, then restart the Argus backend. Observe that the previously generated output is shown correctly rather than being wiped.

**Acceptance Scenarios**:

1. **Given** a Copilot session with existing output stored in Argus, **When** the file watcher (re)starts on `events.jsonl`, **Then** previously stored output is not cleared.
2. **Given** a Copilot session being watched for the first time, **When** Argus reads the tail of `events.jsonl`, **Then** only recent events are replayed (the tail optimization is preserved) and duplicates are not introduced.
3. **Given** a Claude Code session and a Copilot session both being actively monitored, **When** new JSONL lines arrive for either session, **Then** existing output in both sessions is preserved and only new lines are appended.

---

### User Story 4 - Blank and Meta Message Suppression Parity (Priority: P2)

As a developer viewing session output, I want only meaningful messages to appear in the output panel for both agent types. Internal bookkeeping events (like `turn.start`, `session.start`) and blank assistant messages (where the assistant made only tool calls without any text response) should not clutter the output.

**Why this priority**: Claude and Copilot have different suppression rules today. Making them consistent improves the output quality for Copilot sessions and sets a clear, uniform policy.

**Independent Test**: Trigger a tool-call-only turn in both a Claude session and a Copilot session (where the assistant makes a tool call but writes no text). Confirm neither session shows a blank message entry for that turn.

**Acceptance Scenarios**:

1. **Given** a Copilot `turn.start` event, **When** Argus parses it, **Then** it produces no output entry (treated as a bookkeeping event).
2. **Given** a Copilot `session.start` event, **When** Argus parses it, **Then** it produces a status_change entry (not a blank message).
3. **Given** a Copilot `assistant.message` event with no extractable text content (only tool calls in the turn), **When** Argus parses it, **Then** no blank message entry is stored.
4. **Given** a Claude Code assistant entry with only `tool_use` content blocks and no `text` block, **When** Argus parses it, **Then** the tool_use entries are stored but no blank text message entry is produced.

---

---

### User Story 5 - Correct and Consistent Session Output After Restart (Priority: P1)

As a developer using Argus continuously across backend restarts or reconnects, I want to see the same session output after a restart that I saw before, with no output disappearing or being duplicated, regardless of whether the session is Claude Code or Copilot.

Today, the two watchers behave very differently on startup. The Claude watcher re-reads the entire JSONL file from position zero every time it attaches, relying on deduplication to avoid duplicates. The Copilot watcher deletes all stored output and then reads only the most recent 16 KB of the events file, discarding all historical output on every restart. Neither has persistent file position tracking, so both must do extra work on restart to recover state.

**Why this priority**: Output disappearing after a restart destroys trust in the tool. A user who sees a long conversation in Argus and then restarts the backend should not come back to a blank or truncated panel.

**Independent Test**: Let both a Claude Code session and a Copilot session accumulate several exchanges (enough to exceed 16 KB in the events file). Restart the Argus backend. Verify that the full output for the Claude session is still shown and that the Copilot session shows at minimum all output that was visible before the restart.

**Acceptance Scenarios**:

1. **Given** a Copilot session with stored output in the Argus database, **When** the Argus backend restarts and re-attaches the file watcher, **Then** the previously stored output is not deleted and remains visible in the output panel.
2. **Given** a Claude Code session with a large JSONL file (hundreds of entries), **When** the Argus backend restarts, **Then** only the last X bytes of the file are re-read; the full file is not re-parsed from byte 0, and no duplicate entries appear in the output panel.
3. **Given** a Copilot session whose `events.jsonl` has grown beyond the tail window, **When** Argus re-attaches after a restart, **Then** events already stored in the database are retained, the tail window is re-read, and any entries already stored are silently skipped by deduplication.
4. **Given** any session where Argus was offline while new JSONL lines were written and those lines fall within the tail window, **When** Argus restarts, **Then** the new lines are detected and appended to the stored output without duplicating lines that were already stored.
5. **Given** either a Claude Code or Copilot session being watched for the very first time (no existing database records), **When** Argus attaches the file watcher, **Then** the tail-read optimization applies so large historical files are not fully re-processed.

---

### User Story 6 - Consistent File Read Strategy (Priority: P2)

As a developer maintaining the Argus backend, I want both the Claude and Copilot watchers to use the same approach for reading JSONL files: an incremental, append-only read that never re-reads already-processed bytes and never blocks the scan cycle.

Today the watchers differ in: read style (async for Claude, blocking sync for Copilot), DB insertion strategy (INSERT OR IGNORE for Claude, delete-then-insert for Copilot), and tail behavior (none for Claude, 16 KB for Copilot). This inconsistency creates hidden performance risks and makes the code harder to reason about.

**Why this priority**: Consistency reduces the risk of new bugs being introduced in one watcher but not the other, and eliminates a blocking sync read from the scan cycle.

**Independent Test**: Code review of both `readNewLines` implementations after the fix: both should use async I/O, both should use the same DB insertion strategy, and neither should clear previously stored output.

**Acceptance Scenarios**:

1. **Given** the Copilot `readNewLines` method, **When** it reads new bytes from `events.jsonl`, **Then** it uses non-blocking async I/O consistent with the Claude watcher.
2. **Given** both watchers inserting parsed outputs into the database, **When** an output entry with the same ID is encountered again (e.g., due to a position reset), **Then** neither watcher inserts a duplicate.
3. **Given** the scan cycle running on its regular interval, **When** the Copilot file watcher reads new lines, **Then** no synchronous blocking I/O occurs on the main scan loop thread.

---

### Edge Cases

- What happens when a JSONL line is malformed (invalid JSON)? The line is skipped and the error is logged; subsequent valid lines continue to be processed.
- What happens when a content-block array contains neither `text` nor `tool_use` nor `tool_result` blocks (e.g., an unknown block type)? Unknown blocks are silently skipped; known blocks in the same array are still processed.
- What happens when `data.content` is an empty array or empty string? The event is treated as having no extractable content and, if it is a message-role event, it is suppressed.
- What happens when model detection finds conflicting values across events in the same session? The first non-null value wins and subsequent detections are ignored (existing model is preserved).
- What happens when the `events.jsonl` file is truncated or rotated by Copilot? The watcher detects the smaller file size and resets its read position to the beginning.
- What happens when Argus restarts and a JSONL file has been deleted? The watcher does not re-attach, and the session is treated as ended with its previously stored output preserved.
- What happens when a session's JSONL file is very large (several MB) and Argus has no stored output for it? The tail-read optimization applies: only the most recent bytes up to the configured tail window are read on first attach.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Claude parser MUST produce a distinct output entry for each content block type (`text`, `tool_use`, `tool_result`) in a multi-block response, preserving block order.
- **FR-002**: The Copilot parser MUST extract tool name and arguments from `tool.execution_start` events via `data.toolName` and `data.arguments`, not via fallback JSON dump.
- **FR-003**: The Copilot parser MUST extract tool result content from `tool.execution_complete` events via `data.result.content` (and `data.result.detailedContent` as fallback).
- **FR-004**: Both parsers MUST detect the AI model name from their respective event formats and update the session record the first time a model field is observed.
- **FR-005**: Both parsers MUST preserve an already-detected model name; a subsequent event with no model field MUST NOT overwrite the session's existing model with null.
- **FR-006**: The Copilot watcher MUST NOT clear previously stored session output when the file watcher starts or restarts.
- **FR-007**: Both parsers MUST suppress blank message entries where no text content is extractable for message-role events.
- **FR-008**: The Copilot parser MUST suppress `turn.start` and similarly bookkeeping-only events, producing no output entry.
- **FR-009**: Both parsers MUST handle malformed JSONL lines (invalid JSON) by logging a warning and skipping the line without crashing.
- **FR-010**: Both parsers MUST skip entries whose type is not recognized and that carry no meaningful content (no silent data loss, but no spurious output either).
- **FR-011**: On Argus restart, the Copilot watcher MUST NOT delete previously stored session output; it MUST only append newly written lines to the existing stored output.
- **FR-012**: On Argus restart, the Claude watcher MUST apply the tail-read optimization (same tail window as Copilot) rather than re-reading the full file from byte 0; previously stored output MUST NOT be deleted.
- **FR-013**: Both watchers MUST use the same database insertion strategy: insert new entries and skip any entry whose ID already exists in the store (no delete-then-reinsert pattern).
- **FR-014**: Both watchers MUST apply the tail-read optimization on every attach (first-ever and restart): read only the last X bytes of the JSONL file, regardless of whether stored output exists. INSERT OR IGNORE deduplication ensures previously stored entries are not duplicated. No persistent byte-offset storage is required.
- **FR-015**: The Copilot watcher MUST use non-blocking async file I/O consistent with the Claude watcher, so that file reads do not block the scan cycle thread.

### Key Entities

- **JSONL Entry (Claude format)**: An object with top-level `type` (`user`, `assistant`, `file-history-snapshot`), a `message` object containing `role`, optional `model`, and `content` (string or ContentBlock array).
- **JSONL Event (Copilot format)**: An object with dot-notation `type` (e.g., `assistant.message`, `tool.execution_start`), optional flat `content`/`model` fields, and a nested `data` object holding the real payload.
- **OutputEntry**: The normalized, parser-agnostic record stored in Argus representing a single message, tool_use, or tool_result output with `role`, `content`, and `toolName` fields.
- **Session record**: The in-memory and persisted state for a monitored session, including `model`, `summary`, `lastActivityAt`, and the list of `OutputEntry` items.
- **File position**: The byte offset up to which a watcher has already read a JSONL file. Used to read only new bytes on each change event and to resume after restart. Currently in-memory only; this feature may require it to be persisted.
- **Tail window**: The maximum number of bytes read from a JSONL file on first attach when no stored output exists for the session. Prevents reading megabytes of historical events for long-running sessions.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All content blocks (text, tool_use, tool_result) in a Claude Code assistant response appear as separate, correctly typed output entries with no blocks dropped.
- **SC-002**: All Copilot tool events (`tool.execution_start`, `tool.execution_complete`) produce output entries with tool name and content visible, not raw JSON strings.
- **SC-003**: The model name is shown on the session card for 100% of Claude Code sessions and 100% of Copilot sessions where the agent reported a model name in its events.
- **SC-004**: Restarting the Argus backend does not cause previously displayed output for an in-progress Copilot session to disappear.
- **SC-005**: Zero blank or whitespace-only message entries appear in the output panel for either session type under normal operation.
- **SC-006**: Existing unit tests for both parsers pass without modification, and new tests cover each fixed behavior.
- **SC-007**: After a backend restart, a Copilot session that had 20 stored output entries still shows all 20 entries; none are deleted by the restart.
- **SC-008**: After a backend restart, a Claude Code session does not re-insert any output entry that was already in the database before the restart (zero duplicates added).
- **SC-009**: The Copilot file watcher performs no synchronous blocking I/O during normal operation (verified by code review of the readNewLines implementation).

## Assumptions

- The Claude Code JSONL format and Copilot CLI event format are considered stable; this feature does not add support for new or undocumented event types.
- Fixing the output-clearing bug (FR-006/FR-011) is directly tied to the tail-read strategy: instead of deleting stored output and then re-reading the tail, the watcher keeps stored output and simply re-reads the tail, relying on deduplication. The tail-read window size itself is preserved.
- The parsers are intentionally separate modules (`claude-code-jsonl-parser.ts` and `events-parser.ts`) because the two formats differ significantly; this feature aligns their behavior without merging them into a single parser.
- Both parsers share the same `OutputEntry` type as their output contract; this type is not changed as part of this feature.
- Model detection correctness is defined as: the session record shows the value reported by the agent in its events. If the agent never reports a model, the field remains null, and that is correct behavior.
- No persistent byte-offset storage is needed. On every attach (first-ever and restart), both watchers read only the last X bytes (tail window). Stored output is never cleared; INSERT OR IGNORE deduplication handles overlap between the tail window content and already-stored entries.
- The tail-read window size (currently 16 KB for Copilot) is assumed to be an appropriate default. Changing its value is out of scope; applying it consistently to both watchers on every attach is in scope.
- The Claude watcher's current full-file read on first attach is replaced by the same tail-read approach used by Copilot, eliminating the asymmetry and the performance risk on large files.
- Both watchers are assumed to own a single file per session; multi-file or rotated-file scenarios are out of scope.
