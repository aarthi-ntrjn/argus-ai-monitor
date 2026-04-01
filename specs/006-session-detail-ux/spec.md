# Feature Specification: Session Detail UX Redesign

**Feature Branch**: `006-session-detail-ux`  
**Created**: 2026-04-01  
**Status**: Draft  
**Input**: User description: "to work a specific session to stop or send or look at the traffic. i dont like the current UX patterns. I want to consider a different UX for this. Also there are some bugs around claude not showing the process number."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Stop a Session from the Dashboard (Priority: P1)

A user monitoring several active sessions wants to stop one without having to navigate away from the dashboard. Today they must click a session card, wait for the page to load, scroll to the Controls section, and confirm a browser alert. This is too many steps for a common action. With this feature, a stop icon button appears directly on each active session card. Clicking it shows a lightweight inline confirmation and stops the session immediately.

**Why this priority**: Stopping a runaway or unwanted session is a high-urgency action. Reducing it to a single click from the dashboard is the highest-value UX improvement.

**Independent Test**: Can be fully tested by opening the dashboard with an active session, clicking the stop icon on the card, confirming, and verifying the session status changes to ended — all without navigating away.

**Acceptance Scenarios**:

1. **Given** the dashboard shows an active session card, **When** the user clicks the stop icon button on the card, **Then** an inline confirmation appears (no browser alert/confirm dialog) asking the user to confirm.
2. **Given** the inline confirmation is shown, **When** the user confirms, **Then** the session is stopped, the card status updates to ended, and the user stays on the dashboard.
3. **Given** the inline confirmation is shown, **When** the user cancels, **Then** nothing changes and the card returns to normal.
4. **Given** a session is already ended or completed, **When** the user views the card, **Then** no stop button is shown.

---

### User Story 2 - View Session Output from the Dashboard (Priority: P1)

A user wants to quickly check what a session is doing without leaving the dashboard. Today this requires full page navigation. With this feature, clicking the output/view action on a session card opens a lightweight modal overlay showing the session's output stream, status, and process info — without navigating away.

**Why this priority**: Viewing session output is the most frequent monitoring action. Removing the navigation step and the full-page reload makes the tool significantly faster to use.

**Independent Test**: Can be fully tested by clicking the view action on a session card and verifying the modal opens with the output stream displayed, without any page navigation.

**Acceptance Scenarios**:

1. **Given** a session card is visible on the dashboard, **When** the user clicks the output/view icon, **Then** a modal opens showing the session's output stream, type badge, status badge, process information, and elapsed time.
2. **Given** the output modal is open, **When** new output arrives, **Then** the modal updates to show the new content.
3. **Given** the output modal is open, **When** the user closes it (via close button or pressing Escape), **Then** the modal closes and the user is back on the dashboard.
4. **Given** a session card is clicked (not on an action button), **When** the click happens, **Then** the output modal opens (the card's primary click action is now the modal, not full navigation).

---

### User Story 3 - Send a Prompt from the Dashboard (Priority: P2)

A user with an active Claude Code session wants to send it a follow-up prompt without leaving the dashboard. The send action opens the same lightweight modal used for viewing output, but with the send prompt input pre-focused.

**Why this priority**: Sending prompts is less frequent than viewing output but still benefits from avoiding full-page navigation. It shares the modal infrastructure from US2.

**Independent Test**: Can be fully tested by clicking the send action on a Claude Code session card and verifying the modal opens with the prompt input area available and ready.

**Acceptance Scenarios**:

1. **Given** an active Claude Code session card, **When** the user clicks the send icon, **Then** the session modal opens with the prompt textarea focused.
2. **Given** the modal is open with the prompt textarea, **When** the user types a prompt and submits it, **Then** the prompt is sent and the output stream in the modal shows the result.
3. **Given** a Copilot CLI session card, **When** the user views the session modal, **Then** no send prompt input is shown, and a message explains that sending prompts is not supported for this session type.

---

### User Story 4 - See Claude Process Identifier (Priority: P1 Bug Fix)

When monitoring a Claude Code session, users have no process-level visibility — the session card and detail view show nothing because Claude sessions have no directly accessible process number in the existing design. This should be fixed so that: (a) the actual operating-system process ID of the running Claude process is captured and displayed, and (b) Claude's own internal session identifier is always shown alongside it.

**Why this priority**: This is a bug. Active Claude sessions appear to have no process information, making it impossible to correlate Argus sessions with system-level tools (task manager, process monitors). Also affects confidence in session status accuracy.

**Independent Test**: Can be verified by starting a Claude Code session and confirming that the session card and modal both show a PID (OS process number) and the Claude session ID.

**Acceptance Scenarios**:

1. **Given** an active Claude Code session, **When** the user views the session card, **Then** the Claude internal session ID is shown.
2. **Given** an active Claude Code session where the OS process has been detected, **When** the user views the session card or modal, **Then** the OS process ID (PID) is also shown alongside the session ID.
3. **Given** a Claude Code session is detected but the OS process PID cannot be determined, **When** the user views the session, **Then** the Claude session ID is still shown and the PID is omitted gracefully (no placeholder or broken display).
4. **Given** a Copilot CLI session (which always has a PID), **When** the user views the card or modal, **Then** the PID continues to display as before.

---

### Edge Cases

- What happens when a stop is triggered but the process is already gone? The system should handle the NOT_FOUND or CONFLICT response gracefully and refresh the session status without showing a confusing error.
- What happens if the output modal is open while the session ends? The status in the modal should update to ended, controls should be hidden, and the output stream should remain visible.
- What happens when the Claude process is running but the PID lookup fails (e.g., permission denied)? The system falls back to showing only the Claude session ID without crashing.
- What if the user opens two modals at once? Only one modal should be open at a time — opening a second closes the first.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Each active session card on the dashboard MUST display a stop action button (icon) without requiring page navigation.
- **FR-002**: The stop action MUST present an inline confirmation on the card itself — not a browser `window.confirm()` dialog.
- **FR-003**: Clicking on a session card (or an explicit view/output icon) MUST open a lightweight modal overlay showing the session's output stream and session info.
- **FR-004**: The modal MUST display: session type, status, elapsed time, process information (PID and/or session ID where available), and the full output stream.
- **FR-005**: The modal MUST be dismissible via a close button and via the Escape key.
- **FR-006**: The modal MUST include stop and send-prompt controls for active sessions, replacing the need to use the separate session page for these actions.
- **FR-007**: For Claude Code sessions, the system MUST capture the operating-system PID of the running Claude process and store it on the session record.
- **FR-008**: For Claude Code sessions, the dashboard card and session modal MUST display both the OS PID (when available) and the Claude internal session ID.
- **FR-009**: For Copilot CLI sessions, the existing PID display behavior MUST be preserved.
- **FR-010**: When the OS PID for a Claude session cannot be determined, the system MUST still display the Claude session ID and omit the PID gracefully.
- **FR-011**: Ended and completed sessions MUST NOT show stop or send-prompt controls anywhere in the new UI.
- **FR-012**: The separate session detail page (`/sessions/:id`) MAY continue to exist as a fallback but is no longer the primary interaction surface.

### Key Entities

- **Session Card**: A card on the dashboard representing a single session. Now includes inline action buttons (stop, view/output, send) and inline stop confirmation state.
- **Session Modal**: A lightweight overlay showing session metadata, output stream, and controls. Replaces full-page navigation for primary session interactions.
- **Session**: Backend entity. The `pid` field, which is `null` for Claude Code, should now be populated with the OS PID of the detected Claude process when available. The Claude internal `session_id` is already stored as the session's `id` field.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can stop an active session in 2 clicks or fewer from the dashboard, without page navigation.
- **SC-002**: A user can view the output stream for any session in 1 click from the dashboard, without page navigation.
- **SC-003**: All active Claude Code sessions show at least one process identifier (OS PID or Claude session ID) on the session card.
- **SC-004**: The inline stop confirmation replaces all `window.confirm()` dialogs — zero browser alert dialogs are triggered by session actions.
- **SC-005**: The modal closes within one user action (click close or press Escape) with no residual state.

## Assumptions

- The separate `/sessions/:id` page will be retained as a fallback but de-emphasized; the modal is the primary interaction surface.
- Claude's OS PID can be captured by the existing process scanner (`psList`) on supported platforms; on platforms where it cannot, the fallback is graceful omission.
- The output stream in the modal uses the same data source as the current SessionDetail component.
- Send-prompt functionality for Copilot CLI remains unsupported (v1 limitation); the modal will show a clear explanation for CLI sessions.
- Only one session modal can be open at a time.
