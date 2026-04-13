# Feature Specification: Microsoft Teams Channel Integration

**Feature Branch**: `031-teams-channel-integration`
**Created**: 2026-04-13
**Status**: Draft
**Input**: User description: "Add the ability to connect Argus to the Teams Channel. The goal is to be able to remotely monitor and command CLI sessions. Each channel thread / post is a session."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Monitor Session Output in Teams (Priority: P1)

A developer running a Claude Code or GitHub Copilot CLI session wants to stay informed while away from their desk. When a new CLI session starts in Argus, a corresponding thread is automatically created in a configured Microsoft Teams channel. All session output streams into that thread in real time, so any team member with channel access can observe what the AI agent is doing without needing to open Argus directly.

**Why this priority**: Real-time visibility is the core value proposition of this feature. Everything else depends on a session being visible in Teams first.

**Independent Test**: Configure a Teams channel in Argus settings, start a new CLI session, and verify a thread appears in Teams with live output streaming into it.

**Acceptance Scenarios**:

1. **Given** Teams integration is configured and a CLI session starts in Argus, **When** the session produces output, **Then** a new thread is created in the configured Teams channel and output appears in near real-time.
2. **Given** a session thread exists in Teams, **When** the session ends, **Then** the thread is updated to indicate the session has completed.
3. **Given** Teams integration is not yet configured, **When** a CLI session starts, **Then** Argus behaves as normal with no Teams thread created and no errors shown to the user.

---

### User Story 2 - Send Commands to a Session from Teams (Priority: P1)

The session owner wants to guide or intervene in a running CLI session without switching to the Argus UI. They reply to the session thread in Teams with a free-text prompt or instruction, and that text is forwarded to the active session as input, exactly as if they had typed it in Argus.

**Why this priority**: Remote control is the second half of the core use case and is equally critical to read-only monitoring.

**Independent Test**: With a running session thread in Teams, reply to it with a prompt, and verify that prompt is delivered to the CLI session and a response appears in the thread.

**Acceptance Scenarios**:

1. **Given** a session is active and the user is the session owner, **When** they reply to the Teams thread with a text message, **Then** the message is forwarded to the session as input.
2. **Given** a session thread in Teams, **When** a non-owner team member replies, **Then** the reply is ignored as a command and a notice is posted to the thread indicating that only the session owner may send commands.
3. **Given** a session has ended, **When** anyone replies to the Teams thread, **Then** the reply is ignored and a notice is posted indicating the session is no longer active.

---

### User Story 3 - Configure Teams Integration in Argus Settings (Priority: P2)

An Argus administrator wants to connect Argus to their Microsoft Teams workspace. They navigate to the Argus settings UI, enter their Teams bot token and target channel details, save, and verify the connection is active.

**Why this priority**: Without configuration, no integration is possible. This is a prerequisite for P1 stories but is lower in isolation because the configuration is done once, not continuously.

**Independent Test**: Open Argus settings, enter Teams credentials, save, and verify the connection status indicator shows "Connected."

**Acceptance Scenarios**:

1. **Given** the Argus settings page, **When** the user enters valid Teams bot credentials and channel details and saves, **Then** Argus connects to Teams and displays a "Connected" status.
2. **Given** invalid or expired credentials are entered, **When** the user saves, **Then** an error message is displayed explaining the connection failure.
3. **Given** a working Teams connection, **When** the user clears or removes the credentials, **Then** the integration is disabled and no new threads are created for future sessions.

---

### User Story 4 - View All Sessions via Teams (Priority: P3)

A team lead who only uses Microsoft Teams (not Argus directly) can browse all active and recent session threads in the channel to get an overview of what AI agents are running, who started them, and their current status.

**Why this priority**: Valuable for team visibility but not required for core monitoring and control functionality.

**Independent Test**: With multiple sessions running, verify that each has a corresponding thread in Teams showing session owner, start time, and current status.

**Acceptance Scenarios**:

1. **Given** multiple active sessions, **When** a team member views the Teams channel, **Then** each session has its own thread with a clear header showing session name, owner, and start time.
2. **Given** a session that has ended, **When** a team member views its thread, **Then** the thread header reflects the final status (completed, failed, killed).

---

### Edge Cases

- What happens when the Teams channel is temporarily unreachable? Output should be buffered and delivered when connectivity resumes, with a warning shown in Argus.
- What happens if a session produces very high-frequency output? Messages should be batched or throttled to avoid hitting Teams API rate limits, with no data loss.
- What happens if two users reply to the same thread simultaneously? Only the session owner's reply is processed; replies from others are discarded with a notice.
- What happens if the Argus server restarts mid-session? On reconnect, threads already created should be reused (matched by session ID) rather than new ones created.
- What happens if a Teams thread is deleted externally? Argus should log a warning but continue the session normally; output simply stops reaching Teams.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST automatically create a Microsoft Teams thread in the configured channel when a new CLI session starts in Argus.
- **FR-002**: System MUST stream all session output to the corresponding Teams thread in near real-time.
- **FR-003**: System MUST accept free-text replies from the session owner in a Teams thread and forward them to the active CLI session as input.
- **FR-004**: System MUST reject command replies from any Teams user who is not the session owner, and post a notice in the thread explaining this.
- **FR-005**: System MUST update the Teams thread when a session ends, indicating the final status (completed, failed, or killed).
- **FR-006**: System MUST allow Teams integration to be configured via the Argus settings UI, including bot token and target channel details.
- **FR-007**: System MUST validate Teams credentials on save and display a clear success or error status in the settings UI.
- **FR-008**: System MUST allow Teams integration to be disabled, after which no new session threads are created.
- **FR-009**: System MUST batch or throttle outgoing messages to the Teams API to avoid exceeding rate limits.
- **FR-010**: System MUST buffer session output during temporary Teams connectivity loss and deliver it when connectivity is restored.
- **FR-011**: System MUST include session metadata (session name, owner identity, start time) in the opening message of each Teams thread.
- **FR-012**: System MUST reuse an existing Teams thread for a session if Argus reconnects after a restart (matched by session ID).

### Key Entities

- **Teams Connection**: The configured link between Argus and a Microsoft Teams workspace. Has a bot token, target channel identifier, and connection status.
- **Session Thread**: A Microsoft Teams thread that represents one CLI session. Linked to a session ID, records the owner identity, and serves as the two-way communication channel.
- **Session Owner**: The Argus user who started the CLI session. Only they are authorised to send commands via the Teams thread.
- **Outbound Message**: A unit of session output sent from Argus to a Teams thread. May be batched for rate-limiting purposes.
- **Inbound Command**: A reply posted in a Teams thread by the session owner that is forwarded to the CLI session as input.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Session output appears in the Teams thread within 5 seconds of being produced by the CLI session.
- **SC-002**: Commands sent as thread replies are delivered to the CLI session within 5 seconds of being posted in Teams.
- **SC-003**: 100% of session output is delivered to Teams with no data loss when Teams is available, and no data loss after a connectivity gap is resolved.
- **SC-004**: A new Teams thread is created within 10 seconds of a CLI session starting in Argus.
- **SC-005**: Unauthorised command attempts (from non-owners) result in a Teams notice within 5 seconds and are never forwarded to the session.
- **SC-006**: Teams configuration can be completed in under 2 minutes by a user following the settings UI.
- **SC-007**: Rate-limiting behaviour keeps Argus within Teams API quotas for up to 10 concurrently active sessions without dropping messages.

## Assumptions

- Users have an existing Microsoft Teams workspace and the ability to register a bot application in Azure Active Directory.
- The Teams bot must be added to the target channel by a Teams administrator before Argus can post to it.
- Session owner identity is determined by the Argus user who initiated the session; Argus does not attempt to match Teams users to Argus users by email or other attributes.
- Each Argus instance is configured with a single Teams channel; multi-channel routing per session is out of scope for v1.
- The Teams integration is optional and disabled by default; no existing sessions or Argus behaviour is affected when the integration is not configured.
- High-frequency output throttling preserves all content but may introduce a slight delay in delivery to Teams during burst periods.
- Mobile Teams client support is in scope via the standard Teams thread experience (no custom mobile UI required).
