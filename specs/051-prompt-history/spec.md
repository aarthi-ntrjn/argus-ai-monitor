# Feature Specification: Session Prompt History Navigation

**Feature Branch**: `051-prompt-history`
**Created**: 2026-04-20
**Status**: Draft
**Input**: User description: "when i hit the up arrow i want to see the previous requests in this session. The up arrow key can be anywhere in the input. The currently typed text should also be in list of queries. this should be per session. and some user queries can be sent from claude or copilot terminal. they show as you messages and they should also be in the list."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Navigate History with Up/Down Arrow Keys (Priority: P1)

As a user working in a session, I want to press the up arrow key in the prompt input to cycle backward through all previous requests sent in this session, so I can quickly resend or edit past prompts without retyping them.

**Why this priority**: History navigation is the core feature. It eliminates the most common friction point: retyping the same or similar prompts repeatedly during a session.

**Independent Test**: Send two prompts via the Argus prompt bar. Focus the prompt input (with any content, including empty). Press up arrow once — the most recent sent prompt appears. Press up again — the second-to-last prompt appears. Press down — the most recent prompt reappears. Fully testable on its own.

**Acceptance Scenarios**:

1. **Given** at least one prompt has been sent in the session and the prompt input is focused, **When** the user presses the up arrow key, **Then** the input is replaced with the most recently sent prompt in this session.
2. **Given** the user is viewing a history entry, **When** the user presses up arrow again, **Then** the next older prompt appears in the input.
3. **Given** the user has navigated to the oldest history entry, **When** the user presses up arrow again, **Then** nothing changes (oldest entry stays; no wrap-around).
4. **Given** the user is viewing a history entry, **When** the user presses the down arrow, **Then** the next more-recent prompt appears.
5. **Given** the user has navigated forward past the most recent history entry, **When** down arrow is pressed one more time, **Then** the input restores to the draft text that was present before history navigation began.
6. **Given** no prompts have been sent yet in this session, **When** the user presses up arrow, **Then** nothing happens (no error, no change).

---

### User Story 2 - Current Draft Preserved as Navigable Entry (Priority: P1)

As a user who has partially typed a prompt, I want my in-progress text to be preserved and reachable when I navigate the history, so that pressing up and then down again restores exactly what I had typed.

**Why this priority**: Without draft preservation, navigating history silently destroys whatever the user was typing — a frustrating and common source of lost work.

**Independent Test**: Type "my new message" in the prompt bar (do not send it). Press up arrow — a past message appears. Press down arrow until past the last history entry — "my new message" is restored exactly as typed. Testable independently.

**Acceptance Scenarios**:

1. **Given** the user has typed text in the prompt input, **When** the user presses up arrow to start navigating history, **Then** the current input text is saved as a draft.
2. **Given** the user has navigated into history and presses down past the most recent sent message, **Then** the prompt input shows the saved draft text exactly as it was before navigation began.
3. **Given** the draft is empty (user typed nothing before navigating), **When** the user returns to the draft position, **Then** the input is empty.

---

### User Story 3 - Terminal "You" Messages Included in History (Priority: P1)

As a user who types prompts directly in the Claude Code or Copilot terminal (rather than through the Argus prompt bar), I want those prompts to also appear in the Argus prompt bar history, so that my full conversation context is navigable from one place.

**Why this priority**: Without this, history is incomplete and misleading. Users who work interleaving terminal input and Argus bar input would see a fragmented, confusing history.

**Independent Test**: Open a session. Type a message directly in the Claude/Copilot terminal (it appears as a "you" message in the session output). Then focus the Argus prompt bar and press up arrow. The terminal-originated message appears in the history. Testable without any Argus-bar sends.

**Acceptance Scenarios**:

1. **Given** the user sent a message from the Claude or Copilot terminal (visible as a "you" message in the session output), **When** the user presses up arrow in the Argus prompt bar, **Then** that terminal-sent message appears in the navigable history.
2. **Given** both Argus-bar messages and terminal messages have been sent, **When** the user navigates history, **Then** all messages appear in chronological order (oldest first when navigating up, newest first when pressing up initially).
3. **Given** the same message text appears in both sources within the same session, **Then** each occurrence is treated as a distinct history entry (no deduplication).

---

### Edge Cases

- Up arrow when the prompt input is not focused: default browser behavior (scroll page), not history navigation.
- The user edits a recalled history entry and sends it: the edited text is stored as a new history entry; the original recalled entry is unchanged.
- Very long recalled messages: displayed in full in the input field; no truncation.
- The user navigates history and then sends a recalled message without editing: it is stored as a new entry at the top of history.
- Terminal messages that arrive after the session view is open are included in history as they appear in the session output.
- History is per-session and does not mix entries from different sessions.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: When the prompt input is focused, pressing the up arrow key MUST replace the current input text with the most recently sent prompt in the current session, regardless of cursor position within the input.
- **FR-002**: Each subsequent up arrow press MUST replace the input with the next older entry in the session's prompt history.
- **FR-003**: When the oldest history entry is displayed, further up arrow presses MUST be a no-op (no wrap-around to newest).
- **FR-004**: When navigating history with down arrow, each press MUST replace the input with the next more-recent entry.
- **FR-005**: When the user presses down arrow past the most recent history entry, the input MUST restore to the draft text that was present before history navigation began (empty string if the input was empty when navigation started).
- **FR-006**: Before replacing the input on the first up arrow press, the system MUST save the current input text as a restorable draft.
- **FR-007**: Prompt history MUST include messages sent via the Argus prompt bar for this session.
- **FR-008**: Prompt history MUST include messages sent directly from the Claude or Copilot terminal that appear as "you" messages in the session output.
- **FR-009**: All history entries MUST be presented in chronological order — most recent first when navigating up from the draft position.
- **FR-010**: Prompt history MUST be scoped to the individual session — entries from other sessions MUST NOT appear.
- **FR-011**: The system MUST retain at least the 50 most recent prompts per session in history. Entries beyond this limit are silently dropped (oldest first).
- **FR-012**: Up arrow navigation MUST work regardless of where the cursor is positioned within the prompt input.

### Key Entities

- **Prompt History Entry**: A single user-originated message text associated with a specific session, drawn from either the Argus prompt bar or the session's terminal "you" messages, ordered by the time it was sent.
- **Draft**: The unsaved text present in the prompt input at the moment the user begins navigating history. Restored when the user navigates past the most recent history entry.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can recall and navigate to any of the 10 most recent prompts in a session using only the up/down arrow keys, with no mouse interaction required.
- **SC-002**: Draft text is preserved and restored with 100% fidelity — no characters lost or altered after a navigate-and-return cycle.
- **SC-003**: Terminal "you" messages are visible in history within 1 navigation press of Argus-bar messages sent at the same point in the conversation.
- **SC-004**: History navigation responds within 100 ms per key press — users experience it as instantaneous.
- **SC-005**: 100% of sessions where the user has sent prompts (via bar or terminal) show those prompts in the navigable history.

## Assumptions

- Prompt history is maintained in-memory for the duration of the browser session; it is not persisted to disk or across page reloads.
- A cap of 50 entries per session is sufficient for typical usage; no user-facing setting to adjust this limit is provided in this feature.
- "You" messages from the terminal are identified as session output entries where the role is "user" and the type is "message" — the same entries already displayed as "you" bubbles in the session detail view.
- Duplicate text entries are not deduplicated — if the user sends the same prompt twice, both appear in history as separate entries.
- Down arrow outside of history navigation mode (i.e., when at the draft position already) retains default browser input behavior and does not cycle to the oldest entry.
- History entries from the terminal are available as soon as the session output is received; there is no delay beyond normal session output latency.

<!--
  IMPORTANT: User stories should be PRIORITIZED as user journeys ordered by importance.
  Each user story/journey must be INDEPENDENTLY TESTABLE - meaning if you implement just ONE of them,
  you should still have a viable MVP (Minimum Viable Product) that delivers value.
  
  Assign priorities (P1, P2, P3, etc.) to each story, where P1 is the most critical.
  Think of each story as a standalone slice of functionality that can be:
  - Developed independently
  - Tested independently
  - Deployed independently
  - Demonstrated to users independently
-->

### User Story 1 - [Brief Title] (Priority: P1)

[Describe this user journey in plain language]

**Why this priority**: [Explain the value and why it has this priority level]

**Independent Test**: [Describe how this can be tested independently - e.g., "Can be fully tested by [specific action] and delivers [specific value]"]

**Acceptance Scenarios**:

1. **Given** [initial state], **When** [action], **Then** [expected outcome]
2. **Given** [initial state], **When** [action], **Then** [expected outcome]

---

### User Story 2 - [Brief Title] (Priority: P2)

[Describe this user journey in plain language]

**Why this priority**: [Explain the value and why it has this priority level]

**Independent Test**: [Describe how this can be tested independently]

**Acceptance Scenarios**:

1. **Given** [initial state], **When** [action], **Then** [expected outcome]

---

### User Story 3 - [Brief Title] (Priority: P3)

[Describe this user journey in plain language]

**Why this priority**: [Explain the value and why it has this priority level]

**Independent Test**: [Describe how this can be tested independently]

**Acceptance Scenarios**:

1. **Given** [initial state], **When** [action], **Then** [expected outcome]

---

[Add more user stories as needed, each with an assigned priority]

### Edge Cases

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right edge cases.
-->

- What happens when [boundary condition]?
- How does system handle [error scenario]?

## Requirements *(mandatory)*

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right functional requirements.
-->

### Functional Requirements

- **FR-001**: System MUST [specific capability, e.g., "allow users to create accounts"]
- **FR-002**: System MUST [specific capability, e.g., "validate email addresses"]  
- **FR-003**: Users MUST be able to [key interaction, e.g., "reset their password"]
- **FR-004**: System MUST [data requirement, e.g., "persist user preferences"]
- **FR-005**: System MUST [behavior, e.g., "log all security events"]

*Example of marking unclear requirements:*

- **FR-006**: System MUST authenticate users via [NEEDS CLARIFICATION: auth method not specified - email/password, SSO, OAuth?]
- **FR-007**: System MUST retain user data for [NEEDS CLARIFICATION: retention period not specified]

### Key Entities *(include if feature involves data)*

- **[Entity 1]**: [What it represents, key attributes without implementation]
- **[Entity 2]**: [What it represents, relationships to other entities]

## Success Criteria *(mandatory)*

<!--
  ACTION REQUIRED: Define measurable success criteria.
  These must be technology-agnostic and measurable.
-->

### Measurable Outcomes

- **SC-001**: [Measurable metric, e.g., "Users can complete account creation in under 2 minutes"]
- **SC-002**: [Measurable metric, e.g., "System handles 1000 concurrent users without degradation"]
- **SC-003**: [User satisfaction metric, e.g., "90% of users successfully complete primary task on first attempt"]
- **SC-004**: [Business metric, e.g., "Reduce support tickets related to [X] by 50%"]

## Assumptions

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right assumptions based on reasonable defaults
  chosen when the feature description did not specify certain details.
-->

- [Assumption about target users, e.g., "Users have stable internet connectivity"]
- [Assumption about scope boundaries, e.g., "Mobile support is out of scope for v1"]
- [Assumption about data/environment, e.g., "Existing authentication system will be reused"]
- [Dependency on existing system/service, e.g., "Requires access to the existing user profile API"]
