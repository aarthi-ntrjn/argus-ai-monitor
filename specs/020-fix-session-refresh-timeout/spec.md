# Feature Specification: Fix Session Disappears After 30-Minute Inactivity

**Feature Branch**: `020-fix-session-refresh-timeout`
**Created**: 2026-04-07
**Status**: Clarified
**Input**: User description: "investigate why Claude session does not show up when I refresh and there has been no activity for 30mins"

## Background

Investigation has identified the root cause. The backend monitors Claude Code session JSONL files for modification time. If a JSONL file has not been written to for 30 minutes (`ACTIVE_JSONL_THRESHOLD_MS`), the session status is changed to `ended`. When the frontend hides ended sessions (`hideEndedSessions` setting), the session vanishes from the dashboard entirely. This incorrectly treats an idle session (Claude waiting for user input, no tool calls pending) as a terminated session.

Key files:
- Liveness threshold: `backend/src/services/claude-code-detector.ts` line 32
- Reconciliation logic: `backend/src/services/session-monitor.ts` lines 62-104
- Frontend filtering: `frontend/src/pages/DashboardPage.tsx` line 95
- Frontend "resting" threshold: `frontend/src/utils/sessionUtils.ts` lines 3-8

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Session Persists Through Idle Period (Priority: P1)

A developer starts a Claude Code session, works for a while, then leaves their computer idle for more than 30 minutes (e.g., in a meeting). When they return and refresh the Argus dashboard, they expect to see the session still listed so they can resume tracking it.

**Why this priority**: This is the primary reported bug. The current behavior completely removes the session from view, causing the user to lose visibility of their Claude Code process without warning.

**Independent Test**: Open a session, wait 31 minutes without interacting with Claude Code, refresh the dashboard. The session must still be visible.

**Acceptance Scenarios**:

1. **Given** a Claude Code session has been active but had no new output for 31 minutes, **When** the user refreshes the dashboard, **Then** the session is still visible with an appropriate idle indicator.
2. **Given** a session that was idle and is now marked as ended, **When** the user views the dashboard, **Then** the session remains visible (not hidden) until the user explicitly dismisses it or the 24-hour retention period elapses.
3. **Given** the dashboard is open during the transition from active to idle, **When** the 30-minute threshold passes, **Then** the session changes its visual state (e.g., shows an idle badge) rather than disappearing silently.

---

### User Story 2 - Accurate Session Status Distinction (Priority: P1)

A developer wants to know whether a session ended because Claude Code's process exited or because it was simply idle. The current system conflates both as "ended", making it impossible to distinguish "Claude finished working" from "Claude is waiting for me".

**Why this priority**: Misclassifying idle sessions as ended is both the cause of the disappearance bug and a correctness problem in its own right.

**Independent Test**: Start a session, allow it to go idle 30+ minutes, verify status shows as `idle` not `ended`. Then confirm that a session where Claude Code's process actually exits shows as `ended`.

**Acceptance Scenarios**:

1. **Given** a Claude Code session whose process is still running but has had no JSONL writes for 30+ minutes, **When** the backend reconciles session state, **Then** the session status is set to `idle` (not `ended`).
2. **Given** a Claude Code process that has terminated (process ID no longer active), **When** the backend reconciles session state, **Then** the session status is set to `ended`.
3. **Given** a session in `idle` status that receives new activity (JSONL write), **When** the backend detects the update, **Then** the session status reverts to `active`.

---

### User Story 3 - Configurable Idle Threshold (Priority: P2)

A developer using Argus wants to tune how long a session can be quiet before it is considered idle, to match their workflow patterns.

**Why this priority**: 30 minutes may be too short for some workflows and too long for others. Making this configurable reduces future bug reports and improves adoption across different use cases.

**Independent Test**: Change the idle threshold in settings to 60 minutes. Confirm a session that has been quiet for 45 minutes is still shown as active/resting rather than idle.

**Acceptance Scenarios**:

1. **Given** the idle threshold is changed from 30 minutes to a custom value, **When** the backend evaluates session liveness, **Then** the new threshold is applied.
2. **Given** a default installation with no custom configuration, **When** session reconciliation runs, **Then** the threshold defaults to 60 minutes.

---

### Edge Cases

- What happens when the JSONL file is missing entirely (file deleted while session is running)?
- What happens if the process ID check fails due to OS permission restrictions?
- How does the system behave if the clock changes (DST or NTP correction) while a session is idle?
- What if a session is idle longer than the 24-hour retention period?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The backend MUST distinguish between a session that is idle (process still running, no recent JSONL writes) and a session that has ended (process exited).
- **FR-002**: A session MUST only be marked `ended` when its associated Claude Code process is confirmed to have exited, not based on JSONL file inactivity alone.
- **FR-003**: A session with no JSONL writes beyond the inactivity threshold but with an active process MUST be classified as `idle`.
- **FR-004**: An `idle` session MUST remain visible on the dashboard regardless of the `hideEndedSessions` setting.
- **FR-005**: The dashboard MUST display an idle indicator on sessions that exceed the inactivity threshold, distinct from the active and ended states.
- **FR-006**: The inactivity threshold used to classify a session as `idle` MUST be configurable via application settings.
- **FR-007**: The default inactivity threshold MUST be increased from 30 minutes to 60 minutes.
- **FR-008**: When an idle session receives new JSONL activity, the backend MUST restore it to `active` status.
- **FR-009**: During reconciliation, when JSONL mtime exceeds the inactivity threshold, the backend MUST use a PID liveness check to disambiguate: if the process has exited, mark `ended`; if the process is still running, mark `idle`. The JSONL mtime check remains the primary trigger; PID is the tiebreaker only when mtime is stale.

### Key Entities

- **Session**: Tracks a Claude Code session; now has an additional `idle` status value alongside `active`, `ended`, `completed`, `error`, `waiting`.
- **Liveness Check**: A backend operation that verifies whether a session's process (by PID) is still running on the host OS.
- **Inactivity Threshold**: A configurable duration after which a session with no JSONL writes transitions from `active` to `idle`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A session with no activity for 31 minutes is still visible on the dashboard after a page refresh, with zero session disappearances due to JSONL inactivity alone.
- **SC-002**: 100% of sessions where the Claude Code process has exited are correctly marked as `ended`; 100% of sessions where the process is still running but idle are marked as `idle`.
- **SC-003**: Users can adjust the inactivity threshold through settings without restarting the application.
- **SC-004**: When an idle session receives new activity, it returns to active status within 10 seconds.
- **SC-005**: The change produces zero regressions in detection of genuinely ended sessions (sessions that were correctly marked `ended` before the fix continue to be detected correctly).

## Clarifications

### Session 2026-04-07

- **PID liveness strategy (FR-009)**: Use JSONL mtime as the primary trigger (unchanged). When mtime is stale beyond the threshold, perform a PID check as a tiebreaker: PID dead → `ended`; PID alive → `idle`. This avoids over-engineering PID reuse concerns (rare in practice) while keeping the reliable file-based detection working.

## Assumptions

- The PID stored in the session record accurately corresponds to the Claude Code process that created the JSONL file.
- The host OS exposes a reliable way to check if a process by PID is still running (available on Windows, macOS, and Linux).
- The `hideEndedSessions` frontend setting is intentionally scoped to sessions with `ended` or `completed` status and should NOT apply to `idle` sessions.
- Users with existing sessions in `ended` status (incorrectly classified) will not have those retroactively reclassified; the fix applies to sessions going forward.
- The 24-hour retention period applies to idle sessions the same as ended sessions once they do eventually end.
