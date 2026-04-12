# Feature Specification: AI Choice Alert

**Feature Branch**: `028-ai-choice-alert`
**Created**: 2026-04-11
**Status**: Clarified
**Input**: User description: "for some AI interactions the user will need to provide a choice. Can you research the event logs and identify those kinds of queries. For readonly session change the summary line to say ATTENTION NEEDED for connected session change summary line to attention needed and include the user choice options in the summary line. the attention needed should be in bold and red."

## Research Summary

Two types of user-choice interactions were found in session logs:

**Copilot CLI** (`ask_user` tool): The AI invokes an `ask_user` tool with an explicit `question` and `choices` array. In session output this appears as a `tool_use` entry with `toolName: "ask_user"`. The `content` field contains the JSON-serialised arguments including `question` and `choices`. While the user has not yet responded, no subsequent `tool_result` for that `toolCallId` exists in the session output.

**Claude Code** (`AskUserQuestion` tool): The AI invokes a built-in deferred tool named `AskUserQuestion`. In session output this appears as a `tool_use` entry with `toolName: "AskUserQuestion"`. The `content` field is the JSON input containing the question and available options. The same pending-vs-answered detection logic applies: no subsequent `tool_result` with a matching `toolCallId` (or with a later sequence number) exists.

Both tool names are the detection signal. No backend changes to the parsers are required: the `tool_use` rows are already stored today.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Readonly Session ATTENTION NEEDED (Priority: P1)

A developer monitoring a read-only Claude Code or Copilot session in Argus notices that the AI is waiting for the user to make a choice. Because Argus cannot send input to the remote terminal, the developer needs a visual cue so they know the session is blocked and can switch to the actual terminal to respond.

**Why this priority**: This is the core value of the feature. Without it, a read-only session that is waiting for user input looks identical to one that is simply idle, and the developer has no indication that action is needed.

**Independent Test**: Can be fully tested by mocking a session output list where the last `tool_use` item has `toolName: "ask_user"` (with no subsequent `tool_result`) and verifying the summary line switches to the "ATTENTION NEEDED" indicator.

**Acceptance Scenarios**:

1. **Given** a readonly session whose last output is an unanswered `ask_user` or `AskUserQuestion` tool call with a question and choices, **When** the session card is displayed, **Then** the summary line shows **ATTENTION NEEDED** in bold red, followed by the question text, followed by the labelled choices (e.g., "1. A / 2. B / 3. C").
2. **Given** a readonly session where the most recent user-choice tool call has a matching `tool_result` (i.e., the user already responded), **When** the session card is displayed, **Then** the summary line shows the normal session summary (no alert).
3. **Given** a readonly session with no user-choice tool calls at all, **When** the session card is displayed, **Then** the summary line shows the normal session summary.

---

### User Story 2 - Connected Session ATTENTION NEEDED with Choice Options (Priority: P1)

A developer monitoring a connected (PTY-launched) session sees the AI is waiting for a choice. Because this is a connected session, the developer can type a response via the Argus prompt bar. Argus shows not only the alert but also the actual options the AI is offering, so the developer can reply without switching to another terminal.

**Why this priority**: Equal priority to US1: the connected case adds higher urgency because the developer can act immediately within Argus. Knowing the available options without leaving the Argus window is the key quality-of-life improvement.

**Independent Test**: Can be fully tested by mocking a connected session output list where the last `tool_use` item is a pending `ask_user` with a known `choices` array and verifying both the alert text and the inline choices are rendered.

**Acceptance Scenarios**:

1. **Given** a connected session whose last output is an unanswered `ask_user` tool call with `choices: ["A", "B", "C"]`, **When** the session card is displayed, **Then** the summary line shows **ATTENTION NEEDED** in bold red, followed by the list of choices (e.g., "1. A / 2. B / 3. C").
2. **Given** a connected session whose last output is an unanswered `AskUserQuestion` tool call with options, **When** the session card is displayed, **Then** the summary line shows **ATTENTION NEEDED** followed by the options extracted from the tool input.
3. **Given** a connected session where the choice has already been answered, **When** the session card is displayed, **Then** the summary line shows the normal session summary.
4. **Given** a connected session with a pending choice alert showing, **When** the developer types a response in the prompt bar and sends it, **Then** on the next output update the alert disappears and the summary returns to normal.

---

### Edge Cases

- What happens when the tool input is malformed JSON (cannot parse choices)? Show only **ATTENTION NEEDED** without choices (degrade gracefully; do not throw).
- What happens when the `choices` array is empty? Show only **ATTENTION NEEDED** without a choices list.
- What happens when more than 5 choices are present? Display all choices inline; truncate each choice label at 40 characters if needed to avoid overflowing the card.
- What if the session output API returns fewer items than needed to determine pending state? Treat as "no pending choice" (do not show an alert based on incomplete data).
- What if multiple unanswered choice tool calls exist? Use the most recent one (highest sequence number).
- What if the session status is "ended" or "completed"? Never show the alert for terminated sessions regardless of output content.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST detect a pending user-choice interaction when the most recent `tool_use` output item for a session has `toolName` equal to `"ask_user"` (Copilot) or `"AskUserQuestion"` (Claude Code) AND no `tool_result` with a later or equal sequence number exists in the fetched output window.
- **FR-002**: For any session with a detected pending user-choice interaction, the system MUST replace the summary line on the session card with an **ATTENTION NEEDED** indicator rendered in bold, red text, followed by the question text, followed by the labelled choices.
- **FR-003**: The question text and choice options MUST be shown for both readonly sessions and connected sessions (launchMode `"pty"`).
- **FR-004**: The **ATTENTION NEEDED** indicator MUST NOT appear for sessions whose status is `"ended"` or `"completed"`.
- **FR-005**: The **ATTENTION NEEDED** indicator MUST NOT appear when the pending tool call has a matching `tool_result` in the fetched output window (the choice was already answered).
- **FR-006**: When a pending `ask_user` tool call provides a `choices` array, the system MUST render each choice as a labelled option (e.g., "1. Option A / 2. Option B").
- **FR-007**: When a pending `AskUserQuestion` tool call provides an `options` field in its input, the system MUST render each option the same way as Copilot choices.
- **FR-008**: If the tool input cannot be parsed or contains no choices/options, the system MUST still show **ATTENTION NEEDED** without a choices list.
- **FR-009**: The detection MUST work without any changes to the backend parsers or database schema; it operates on session output data already stored today.

### Key Entities

- **Pending Choice**: A `tool_use` session output item with `toolName` in `["ask_user", "AskUserQuestion"]` for which no `tool_result` with a later sequence number exists in the fetched output window. Carries optional choice labels parsed from the `content` field.
- **Session Card Summary Line**: The text row on a `SessionCard` that normally displays `session.summary` (the last user message). This row is replaced by the ATTENTION NEEDED indicator when a pending choice is detected.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer can identify that a session is waiting for a user choice within 5 seconds of the AI issuing the prompt, without navigating away from the Argus dashboard.
- **SC-002**: For connected sessions, all available AI-offered choices are visible on the session card without any additional click or navigation.
- **SC-003**: When a user-choice interaction is resolved (the user responds), the ATTENTION NEEDED indicator disappears from the session card within the next output polling cycle (under 10 seconds).
- **SC-004**: No false positives: sessions that do not have a pending choice interaction show no ATTENTION NEEDED indicator.

## Clarifications

### Session 2026-04-11

- **"summary line"**: The `<p>` element in `SessionCard` that normally shows `session.summary` (the last user message, up to 120 chars). This is the element to replace when a pending choice is detected.
- **"readonly session"**: A session with `launchMode: null` or `launchMode: "detected"`. Argus cannot send input to these sessions.
- **"connected session"**: A session with `launchMode: "pty"`. Argus has a prompt bar for sending input.
- **Detection signal**: `tool_use` items already stored in session output today. No new event types or backend changes needed.
- **Choice source for Claude Code**: The `AskUserQuestion` tool input JSON may include an `options` array. The exact schema will be confirmed during the plan phase from the `AskUserQuestion` tool definition.

### Session 2026-04-12

- **Question and choices for all sessions**: Both the question text AND the labelled choice options are shown in the summary line for ALL sessions (readonly and connected). There is no distinction between session types for what is displayed — both get the full context: ATTENTION NEEDED + question + choices. The distinction (readonly vs connected) remains relevant for whether the developer can respond via the Argus prompt bar, not for what is displayed.

## Assumptions

- The session output API already returns `tool_use` items with `toolName` and `content` fields that contain the choice data; no schema changes are needed.
- The detection is frontend-only: `SessionCard` fetches the last N output items and computes the pending state on the client. No new backend endpoint is needed.
- The existing `getSessionOutput` call in `SessionCard` (currently `limit: 10`) will be sufficient to detect pending choices in the common case. The limit may need a small increase (e.g., 20) to handle longer tool chains, which is a plan-phase decision.
- The ATTENTION NEEDED text is rendered inline in the summary line area only. It does not appear as a banner, toast, or separate component.
- Colour and typography: "bold red" is implemented with Tailwind classes (`font-bold text-red-600` or similar) consistent with the existing UI palette.
- No persistent notification state: the indicator is computed live from session output on every render.
