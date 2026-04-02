# Feature Specification: Session Detail UX Redesign

**Feature Branch**: `006-session-detail-ux`  
**Created**: 2026-04-02  
**Status**: Draft  
**Input**: User description: "Commands like stop the current command (Esc), exit the session (/exit), merge with main, get the latest changes from main — exposed as buttons on the card. When a session is selected, streaming output shows in a right pane. Most recent output visible on the card. Inline prompt input on the card. Keep the drill-in page but link to it from the card."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Two-Pane Session View (Priority: P1)

The dashboard switches to a two-column layout. The left column shows the list of session cards. When the user clicks/selects a card, the right column shows the live streaming output for that session. The right pane stays visible while the user looks at or interacts with the selected session, making it easy to monitor output while also reading other cards or switching sessions.

**Why this priority**: This is the primary layout change that all other features depend on. Without it, there is nowhere to show the streaming output without full-page navigation.

**Independent Test**: Can be fully tested by clicking a session card and verifying the right pane appears with live output for that session. Clicking a different card should update the right pane.

**Acceptance Scenarios**:

1. **Given** the dashboard with at least one session card, **When** the user clicks a session card, **Then** a right pane opens alongside the card list showing the streaming output for that session.
2. **Given** the right pane is showing session A's output, **When** the user clicks a different session card (session B), **Then** the right pane switches to show session B's output.
3. **Given** the right pane is visible, **When** new output arrives for the selected session, **Then** the right pane updates in real time.
4. **Given** the right pane is visible, **When** the user clicks outside or dismisses the pane, **Then** the dashboard returns to the single-column card list view.
5. **Given** no session is selected, **When** the dashboard loads, **Then** only the card list is shown with no right pane.

---

### User Story 2 - Quick Command Buttons on Session Cards (Priority: P1)

A user wants to perform common session operations without typing them each time. Each active session card shows a row of command shortcut buttons:
- **Esc** — interrupts the current running command (sends an escape/interrupt signal to the session)
- **Exit** — gracefully ends the session (sends `/exit`)
- **Merge** — asks the session to merge with the main branch
- **Pull latest** — asks the session to get the latest changes from main

Clicking a command button sends it immediately. No confirmation is needed for Merge and Pull (they are reversible operations the AI handles). A confirmation is required for Exit (it ends the session).

**Why this priority**: These are the most frequent operations users need during active development sessions. Making them one-click avoids interrupting flow.

**Independent Test**: Can be fully tested by verifying each command button appears on an active session card and that clicking each one sends the correct payload via the send-prompt API.

**Acceptance Scenarios**:

1. **Given** an active session card, **When** the user views it, **Then** four command buttons are visible: Esc, Exit, Merge, Pull latest.
2. **Given** an active session card, **When** the user clicks "Esc", **Then** an escape/interrupt signal is sent to the session immediately with no confirmation.
3. **Given** an active session card, **When** the user clicks "Exit", **Then** an inline confirmation appears on the card. On confirming, `/exit` is sent to the session.
4. **Given** an active session card, **When** the user clicks "Merge", **Then** the command "merge with main branch" is sent to the session immediately as a prompt.
5. **Given** an active session card, **When** the user clicks "Pull latest", **Then** the command "get latest changes from main branch" is sent to the session immediately as a prompt.
6. **Given** an ended or completed session card, **When** the user views it, **Then** no command buttons are shown.

---

### User Story 3 - Inline Prompt Input on Session Card (Priority: P1)

A user wants to type and send a custom prompt directly from the session card without opening the full drill-in page. A compact text input is always visible on each active session card. The user types a message, presses Enter (or clicks a send button), and the prompt is delivered to the session.

**Why this priority**: The inline prompt input is the core interaction for steering an active AI session. Combined with the right-pane output view, it creates a complete monitor-and-interact loop without navigating away.

**Independent Test**: Can be fully tested by typing into the prompt input on an active Claude Code card and verifying the prompt is sent to the session.

**Acceptance Scenarios**:

1. **Given** an active Claude Code session card, **When** the user views the card, **Then** a prompt input field is visible on the card.
2. **Given** a prompt is typed in the input, **When** the user presses Enter or clicks Send, **Then** the prompt is sent and the input field is cleared.
3. **Given** a Copilot CLI session card, **When** the user views the card, **Then** the prompt input is not shown (not supported for Copilot CLI in v1).
4. **Given** the prompt input is empty, **When** the user presses Enter, **Then** nothing is sent.
5. **Given** a send is in progress, **When** the request completes or fails, **Then** the input is re-enabled and an error (if any) is shown inline on the card.

---

### User Story 4 - Most Recent Output Preview on Card (Priority: P2)

The session card shows a preview of the most recent output — the last message, tool name, or status text from the session. This gives users at-a-glance awareness of what each session is doing without having to select it and view the right pane.

**Why this priority**: Useful for scanning multiple sessions quickly but not required for core functionality. Depends on the output data already being fetched.

**Independent Test**: Can be fully tested by verifying the last output line is shown on the card without clicking into the session.

**Acceptance Scenarios**:

1. **Given** a session with output, **When** the dashboard loads or updates, **Then** the card shows a preview of the most recent output item (truncated to one line).
2. **Given** a session with no output yet, **When** the card is displayed, **Then** no output preview is shown (the summary field or placeholder is shown instead).
3. **Given** a new output item arrives for a session, **When** the card re-renders, **Then** the preview updates to show the newest item.

---

### User Story 5 - Drill-in Page Link from Card (Priority: P3)

The existing `/sessions/:id` page is retained for users who want a full-screen view of the session with complete output history. The card includes a small link or icon to open the drill-in page for that session.

**Why this priority**: The drill-in page already exists. This story is just ensuring it remains discoverable and accessible from the new card-based UX.

**Independent Test**: Can be fully tested by clicking the drill-in link on a card and verifying the `/sessions/:id` page loads.

**Acceptance Scenarios**:

1. **Given** any session card, **When** the user clicks the drill-in link/icon, **Then** the user navigates to the existing `/sessions/:id` page for that session.

---

### User Story 6 - Claude Process Identifier Bug Fix (Priority: P1 Bug)

Active Claude Code sessions currently show no process identifier anywhere in the UI, because the system records `pid: null` for hook-detected sessions. Users cannot correlate an Argus session with the process in system tools. This should be fixed so the backend captures the OS PID of the running Claude process and the UI displays both the OS PID and the Claude internal session ID on the card.

**Why this priority**: This is a bug. It causes confusion about whether a Claude session is actually running.

**Independent Test**: Start a Claude Code session and verify the session card shows a PID and/or session ID.

**Acceptance Scenarios**:

1. **Given** an active Claude Code session, **When** the backend detects a running Claude OS process, **Then** the session record is updated with the OS PID.
2. **Given** a Claude Code session card, **When** the card is rendered, **Then** the Claude internal session ID is always shown.
3. **Given** a Claude Code session where the OS PID was captured, **When** the card is rendered, **Then** the OS PID is also shown (e.g. "PID: 12345").
4. **Given** a Claude Code session where the OS PID could not be determined, **When** the card is rendered, **Then** only the Claude session ID is shown — no broken placeholder.

---

### User Story 7 - Inactive Session Indicator (Priority: P2)

A session is **inactive** when it has been running (not `completed` or `ended`) but has had no activity for more than 20 minutes. Inactive sessions are visually distinguished on the dashboard so users can quickly identify stalled or forgotten sessions without opening each one. An optional Settings toggle lets users hide inactive sessions entirely.

**Why this priority**: Users often leave sessions running that have gone quiet. Without a visual signal, it is hard to tell at a glance which sessions need attention and which are simply idle. This is additive — it does not change behaviour for active sessions.

**Independent Test**: Set `lastActivityAt` on a session to 21 minutes ago (or advance the clock in tests). Verify the card shows an amber "inactive" badge. Enable "Hide inactive sessions" in Settings and verify the card is no longer shown.

**Acceptance Scenarios**:

1. **Given** a session with `lastActivityAt` more than 20 minutes ago and status not `completed`/`ended`, **When** the dashboard renders, **Then** an amber "inactive" badge is shown in the session card's status row.
2. **Given** a session with `lastActivityAt` less than 20 minutes ago, **When** the card renders, **Then** no "inactive" badge is shown.
3. **Given** a `completed` or `ended` session with old `lastActivityAt`, **When** the card renders, **Then** it is NOT marked inactive (it is already in a terminal state).
4. **Given** the "Hide inactive sessions" setting is enabled, **When** the dashboard renders, **Then** inactive sessions are excluded from all repository session lists.
5. **Given** an inactive session, **When** new output arrives and `lastActivityAt` updates to now, **Then** the inactive badge disappears on the next re-render.

---

### Edge Cases

- What happens when a command (Merge, Pull latest) is sent but the session is in a waiting/busy state? The command is queued/sent and the output pane shows the result. No special blocking is required.
- What happens if the right pane is open for a session that then ends? The status in the pane updates to ended, controls are hidden, output remains visible.
- What happens if the user tries to send a prompt while the previous send is still in flight? The input should be disabled until the previous send completes.
- What happens on a narrow screen where two columns don't fit? The right pane overlays the card list (full-width overlay) on narrow viewports.
- What if Exit is confirmed but the session is already ending? Gracefully handle the CONFLICT/NOT_FOUND response — update status and show no error.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The dashboard MUST support a two-pane layout — a card list on the left and a streaming output pane on the right — activated by selecting a session card.
- **FR-002**: The right output pane MUST update in real time as new output arrives for the selected session.
- **FR-003**: Each active session card MUST display four quick-command buttons: Esc, Exit, Merge, Pull latest.
- **FR-004**: The Esc command MUST send an interrupt/escape signal to the session without any confirmation step.
- **FR-005**: The Exit command MUST require inline confirmation on the card before sending `/exit` to the session.
- **FR-006**: The Merge and Pull latest commands MUST send their respective prompts immediately without confirmation.
- **FR-007**: Active Claude Code session cards MUST display an inline prompt input field.
- **FR-008**: The prompt input MUST send on Enter key or Send button click, and clear the field on success.
- **FR-009**: Copilot CLI session cards MUST NOT show the prompt input field.
- **FR-010**: Session cards MUST display a preview of the most recent output item (last line, truncated).
- **FR-011**: Each session card MUST include a link to the existing `/sessions/:id` drill-in page.
- **FR-012**: Ended and completed session cards MUST NOT display command buttons or the prompt input.
- **FR-013**: The backend MUST capture the OS PID of the running Claude process during session detection and store it on the session record.
- **FR-014**: Claude Code session cards MUST display the Claude internal session ID at all times.
- **FR-015**: Claude Code session cards MUST display the OS PID when it has been captured.
- **FR-016**: Sessions with no activity for more than 20 minutes that are not `completed` or `ended` MUST display an amber "inactive" badge on the session card.
- **FR-017**: The Settings panel MUST include a "Hide inactive sessions" toggle that removes inactive sessions from the dashboard when enabled.

### Key Entities

- **Session Card (enhanced)**: Now includes quick-command buttons, inline prompt input, last-output preview, drill-in link, and selected state that activates the right pane.
- **Right Output Pane**: A panel shown alongside the card list when a session is selected. Displays the full streaming output for the selected session. Dismissed when session is deselected.
- **Quick Command**: A predefined action (Esc, Exit, Merge, Pull latest) sent to the session via the existing send-prompt API. Each has a fixed payload and optional confirmation requirement.
- **Session (backend)**: The `pid` field for Claude Code sessions should now be populated with the OS PID of the detected Claude process, when discoverable.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can send any of the four quick commands (Esc, Exit, Merge, Pull latest) in 1–2 clicks from the dashboard, without page navigation.
- **SC-002**: A user can view live streaming output for any session in 1 click from the dashboard, without page navigation.
- **SC-003**: A user can type and send a custom prompt from the session card in under 5 seconds.
- **SC-004**: All active Claude Code sessions show at least one process identifier (OS PID or Claude session ID) on the card.
- **SC-005**: Zero `window.confirm()` dialogs are triggered by any session action — all confirmations are inline.

## Assumptions

- The "Esc" command maps to sending an interrupt signal to the session process (SIGINT or equivalent), not necessarily a literal Escape keystroke.
- The "Merge" and "Pull latest" commands are sent as natural-language prompts to the active AI session; the AI is responsible for executing the git operation.
- The two-pane layout collapses gracefully on narrower viewports (right pane becomes an overlay).
- The existing `/sessions/:id` page is retained unchanged as the drill-in destination.
- Copilot CLI prompt sending remains unsupported (v1 limitation); quick commands other than Esc may not apply and are hidden for CLI session types.
- Only one session can be "selected" (right pane active) at a time.

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
