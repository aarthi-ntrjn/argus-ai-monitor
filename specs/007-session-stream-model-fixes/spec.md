# Feature Specification: Session Stream Legibility, Model Display & Claude Code Fixes

**Feature Branch**: `007-session-stream-model-fixes`  
**Created**: 2026-04-02  
**Status**: Draft  
**Input**: User description: "render the output stream a little more legibly from copilot. show the model being used in each cli session. claude code sessions are not detecting the active state properly and not showing the output stream. fix these behaviors."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Claude Code Sessions Show Live Output (Priority: P1)

A developer has Claude Code running against a repository. They open the Argus dashboard and click the Claude Code session card. Currently, the output pane is empty — no conversation history, no tool calls, nothing. The developer expects to see what Claude Code is doing in real time.

**Why this priority**: The output stream is the primary value of the dashboard. Claude Code sessions are completely broken in this respect — the session card appears but offers no visibility into what the AI is actually doing. This is the most critical gap.

**Independent Test**: Can be fully tested by running Claude Code in a monitored repository, opening the Argus dashboard, and confirming that conversation messages and tool calls appear in the session output pane.

**Acceptance Scenarios**:

1. **Given** a Claude Code session is active and has processed at least one message, **When** the user opens the session in the dashboard, **Then** they see the conversation history including user messages, assistant responses, and tool calls.
2. **Given** a Claude Code session is active, **When** Claude Code performs a new tool call, **Then** the output pane updates to include the new activity within a few seconds.
3. **Given** a Claude Code session has ended, **When** the user opens the session, **Then** they can still browse the full conversation history from that session.

---

### User Story 2 - Claude Code Sessions Correctly Show Active State (Priority: P1)

A developer runs Claude Code against a monitored repository. They look at the Argus dashboard and either (a) see the session stuck as "ended" when it should be "active", or (b) the session doesn't appear at all until the first tool call fires. They have no reliable signal of whether Argus has detected their Claude Code session as running.

**Why this priority**: If the session status is wrong, the user loses trust in the entire dashboard. The active/ended badge is a fundamental piece of information the developer relies on to know whether their session is being monitored.

**Independent Test**: Can be fully tested by starting Claude Code in a monitored repository, refreshing the dashboard, and verifying the session badge shows "active" immediately — without needing to send a message first.

**Acceptance Scenarios**:

1. **Given** Claude Code is running in a monitored repository, **When** the Argus dashboard loads or auto-refreshes, **Then** the session for that repository is shown with an "active" status.
2. **Given** a Claude Code session was previously active and is now closed, **When** the dashboard refreshes, **Then** the session correctly transitions to "ended".
3. **Given** Claude Code is not running in any monitored repository, **When** the dashboard loads, **Then** no ghost "active" Claude Code sessions appear.

---

### User Story 3 - Output Stream Is Legible for Copilot CLI Sessions (Priority: P2)

A developer looks at the output pane for a Copilot CLI session. The stream shows a mix of messages, tool calls, and tool results in a compact list with coloured type badges. Long assistant messages are dense and hard to scan. Tool use and its corresponding result are shown as separate unrelated items. The developer wants to be able to quickly read what the AI said and what actions it took.

**Why this priority**: Legibility is a quality-of-life improvement for Copilot CLI sessions, which already work correctly. It's important but doesn't block core functionality.

**Independent Test**: Can be fully tested by opening any active Copilot CLI session in the dashboard and verifying that assistant messages, tool calls, and tool results are clearly distinguishable and readable without clicking or expanding.

**Acceptance Scenarios**:

1. **Given** a Copilot CLI session with mixed message types, **When** the user views the output pane, **Then** assistant messages are visually distinct from tool calls and tool results.
2. **Given** a Copilot CLI session with a tool call followed by its result, **When** the user views the output, **Then** the tool name and action are readable without having to parse raw JSON.
3. **Given** a Copilot CLI session output with a long assistant message, **When** the user views the output pane, **Then** the message text is readable (not truncated to a single line) and does not overflow the pane horizontally.

---

### User Story 4 - Model Name Visible on Session Cards and Detail (Priority: P3)

A developer monitors several sessions — some using Claude Sonnet, some using Claude Opus, some using Copilot's default model. They want to know at a glance which model each session is running, both on the card in the session list and in the detail view.

**Why this priority**: Useful context but not blocking. Model information enriches the dashboard without being essential to monitoring.

**Independent Test**: Can be fully tested by running a session with a known model and confirming the model name is visible on the session card and in the session detail header.

**Acceptance Scenarios**:

1. **Given** a session where the AI model is known, **When** the user views the session card or detail, **Then** the model name is displayed (e.g., "claude-sonnet-4-5", "copilot-default").
2. **Given** a session where the model is not yet known, **When** the user views the session, **Then** the model field is absent or shows a neutral placeholder — no error or broken layout.
3. **Given** a Claude Code session that reports its model via its activity data, **When** the session is active and the model has been detected, **Then** the model name updates on the card without requiring a full page reload.

---

### Edge Cases

- What happens if Claude Code's conversation file does not exist yet (session just started, no messages sent)?
- What happens if Claude Code's conversation file is malformed or partially written mid-line?
- What happens if multiple Claude Code processes are running across different repositories?
- What happens if a session's model changes mid-conversation (unlikely but possible with API sessions)?
- What happens if the Copilot CLI events file contains unknown event types not in the current map?

## Requirements *(mandatory)*

### Functional Requirements

**Claude Code Output Stream**

- **FR-001**: The system MUST display Claude Code conversation history in the session output pane, including user messages, assistant responses, and tool calls/results.
- **FR-002**: The system MUST read Claude Code session output from the same data source Claude Code uses to persist conversation history on disk.
- **FR-003**: The system MUST update the Claude Code session output pane within 5 seconds of new activity occurring, without requiring a manual refresh.
- **FR-004**: The system MUST continue to show historical output for Claude Code sessions that have ended.

**Claude Code Active State Detection**

- **FR-005**: The system MUST show a Claude Code session as "active" as soon as a Claude Code process is detected running against a monitored repository, even before any hook events arrive.
- **FR-006**: The system MUST transition a Claude Code session to "ended" when the Claude Code process is no longer running, regardless of whether a Stop hook event was received.
- **FR-007**: The system MUST NOT show stale "active" Claude Code sessions for repositories where no Claude Code process is running.
- **FR-008**: When multiple Claude Code processes are running across different repositories, each MUST be tracked independently.

**Output Stream Legibility (Copilot CLI)**

- **FR-009**: The output stream MUST visually distinguish between assistant messages, user messages, tool invocations, and tool results.
- **FR-010**: Tool invocation items MUST display the tool name prominently so the user understands what action was taken, without requiring the user to parse raw JSON content.
- **FR-011**: Assistant message content MUST be displayed with full text wrapping — not truncated to a single line.
- **FR-012**: The output stream rendering improvements MUST apply consistently to both Copilot CLI and Claude Code sessions.

**Model Display**

- **FR-013**: When the AI model for a session is known, it MUST be displayed on the session card and in the session detail header.
- **FR-014**: The system MUST attempt to detect the model from available session data sources (conversation files, hook payloads, process metadata) without requiring manual user input.
- **FR-015**: When the model is unknown, the session card and detail MUST render without error — the model field is simply omitted.

### Key Entities

- **Session**: A monitored AI coding session with an identity, status (active/ended/inactive), session type (copilot-cli or claude-code), optional model name, and associated repository.
- **Output Item**: A single unit of conversation activity — a message (user or assistant), a tool invocation, or a tool result — with a timestamp, type, content, and optional tool name.
- **Conversation File**: The on-disk record written by the AI tool containing the full history of a session. For Copilot CLI this is `events.jsonl`; for Claude Code this is the session JSONL file in its projects directory.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Claude Code output pane displays at least the most recent 20 conversation items for any session that has sent at least one message.
- **SC-002**: Claude Code session status transitions from "ended" to "active" within 10 seconds of the user starting Claude Code in a monitored repository.
- **SC-003**: 100% of active Copilot CLI sessions show readable assistant message text without horizontal overflow or single-line truncation.
- **SC-004**: The model name is visible on session cards for all sessions where the model can be determined from available data.
- **SC-005**: No ghost "active" Claude Code sessions appear more than 15 seconds after the Claude Code process has exited.

## Assumptions

- Claude Code stores its conversation history as JSONL files on disk in a predictable, readable location (`~/.claude/projects/{encoded-repo-path}/{session-id}.jsonl`).
- The Claude Code JSONL conversation format uses a known schema with identifiable fields for role (user/assistant), content, and tool calls.
- A Claude Code session's model name is present somewhere in its conversation file or hook payload data.
- Copilot CLI sessions already work correctly for output streaming; only display improvements are needed, not data pipeline changes.
- This feature does not need to support remote/cloud-hosted sessions — only local processes running on the same machine as the Argus backend.
- Windows path encoding for Claude Code project directory names follows the same `replace [:\\/] with -` convention already used in the detector.
