# Feature Specification: Performance Fixes and UX Improvements

**Feature Branch**: `041-perf-and-fixes`
**Created**: 2026-04-16
**Status**: Complete

## User Scenarios & Testing

### User Story 1 - PTY Session Reconnect After Server Restart (Priority: P1)

When the Argus backend restarts while a PTY session is running, the launcher
WebSocket should automatically reconnect and the session should remain active
rather than being lost.

**Why this priority**: Losing active sessions on server restart is disruptive.

**Independent Test**: Start a PTY session, restart the backend, verify the session
remains active and the prompt bar still works.

**Acceptance Scenarios**:

1. **Given** a running PTY session with a known `ptyLaunchId`, **When** the backend restarts, **Then** the launcher reconnects and the session stays active.
2. **Given** a launcher WebSocket connects with `?id=<ptyLaunchId>`, **When** a DB session with that `ptyLaunchId` already exists and the process is alive, **Then** the session is immediately re-linked without waiting for the next scan.

---

### User Story 2 - Output Pane Selection Persisted on Refresh (Priority: P2)

When the user selects a session and refreshes the page, the previously selected
session's output pane reopens automatically.

**Why this priority**: Prevents losing context on accidental refresh.

**Independent Test**: Select a session, refresh the page, verify the output pane
reopens for the same session.

**Acceptance Scenarios**:

1. **Given** a session is selected and its output pane is open, **When** the page is refreshed, **Then** the same session is selected and its output pane is visible.
2. **Given** the user closes the output pane via the X button, **When** the page is refreshed, **Then** no output pane opens.

---

### User Story 3 - Rescan Remote URLs (Priority: P2)

A user can trigger a re-scan of all repository remote URLs from the Settings panel
to update compare links after a remote has been added or changed.

**Why this priority**: Remote URLs are only captured on registration; users who
change remotes have no way to refresh them without removing and re-adding repos.

**Independent Test**: Register a repo, change its remote URL on disk, click
"Rescan Remote URLs" in Settings, verify the compare link updates.

**Acceptance Scenarios**:

1. **Given** a repo with a stale `remoteUrl`, **When** the user clicks "Rescan Remote URLs", **Then** `git remote get-url origin` is re-run for all repos and changed ones are updated in the DB.
2. **Given** the rescan runs, **When** a remote URL changes, **Then** a `repository.updated` WebSocket event is broadcast and the compare link refreshes live.

---

### User Story 4 - Correct Session Card Hover vs Selection States (Priority: P3)

Session cards use distinct colors for hover (neutral gray) and selected (blue)
states so users can clearly distinguish them.

**Why this priority**: Visual consistency and usability.

**Acceptance Scenarios**:

1. **Given** an unselected session card, **When** the user hovers over it, **Then** the card shows a neutral gray background.
2. **Given** a selected session card, **When** it is displayed, **Then** the card shows a blue background distinct from the hover color.

---

### Edge Cases

- Launcher connects without `?id=` query param (old client): server closes connection immediately with a warning log.
- PID reuse: `ptyLaunchId` in DB is used instead of PID alone to re-link sessions, preventing false positives from OS PID recycling.

## Requirements

### Functional Requirements

- **FR-001**: The server MUST persist `pty_launch_id` on PTY sessions so reconnect works after restart.
- **FR-002**: The launcher MUST include `?id=<ptyLaunchId>` in the WebSocket URL.
- **FR-003**: `notifySessionEnded` MUST include `sessionId` in the `session_ended` message.
- **FR-004**: The selected session ID MUST be persisted in `localStorage` and restored on page load.
- **FR-005**: `POST /api/v1/repositories/rescan-remotes` MUST update remote URLs for all registered repos in parallel and broadcast `repository.updated` for any that changed.
- **FR-006**: Session cards MUST use neutral gray for hover and blue for selected state.

## Success Criteria

- **SC-001**: All 308 backend unit/integration tests pass.
- **SC-002**: Frontend build succeeds with no TypeScript errors.
- **SC-003**: E2E Tier 1 tests pass (152 tests).
- **SC-004**: PTY sessions survive a backend restart without manual intervention.
