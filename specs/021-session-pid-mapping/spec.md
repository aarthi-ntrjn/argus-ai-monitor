# Feature Specification: Session-to-PID Mapping

**Feature Branch**: `021-session-pid-mapping`
**Created**: 2026-04-09
**Status**: Clarified
**Input**: User description: "The detection of Claude Code sessions is super buggy. There is no mapping between Claude Code JSONL files and process ID. Argus should do this mapping and maintain it internally, for both Claude Code and Copilot CLI."

## Discovery

Claude Code maintains a session registry at `~/.claude/sessions/` containing one JSON file per active session, named `{PID}.json`:

```json
{
  "pid": 54428,
  "sessionId": "8ac5d40b-7f18-4e51-903d-1524bd288c33",
  "cwd": "C:\\source\\github\\artynuts\\argus2",
  "startedAt": 1775683858728,
  "kind": "interactive",
  "entrypoint": "cli"
}
```

This provides a **deterministic, Claude-maintained PID-to-session mapping** that eliminates the need for guessing, timestamp correlation, or process list heuristics. The `sessionId` matches the JSONL filename in `~/.claude/projects/`. Files are created when Claude starts and removed when it exits.

Copilot CLI already has an equivalent mechanism via `inuse.{PID}.lock` files in `~/.copilot/session-state/{sessionId}/`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Claude Code PID resolution via session registry (Priority: P1)

As a developer running one or more Claude Code sessions, I want Argus to read `~/.claude/sessions/*.json` to deterministically map each session to its PID, so that Argus can reliably detect session start, end, and liveness without guessing.

**Why this priority**: This replaces the broken heuristic-based PID resolution (single-process assumption, psList matching) with a deterministic source of truth maintained by Claude Code itself. Every session lifecycle feature depends on correct PID mapping.

**Independent Test**: Start two Claude Code sessions in two different repos. Both sessions appear on the dashboard, each with its own correct PID displayed. Stop one session (type `/exit`). That session transitions to "ended" within 10 seconds while the other remains "running".

**Acceptance Scenarios**:

1. **Given** Argus is running, **When** a new `{PID}.json` file appears in `~/.claude/sessions/`, **Then** Argus reads it, matches the `sessionId` to an existing session (or creates one), and stores the PID on the session record.
2. **Given** two Claude Code sessions are active in different repos, **When** Argus scans `~/.claude/sessions/`, **Then** each session gets the correct PID from its own JSON file (no ambiguity, even in the same repo).
3. **Given** a Claude Code session has an assigned PID, **When** the `{PID}.json` file is removed (Claude exited), **Then** the session is marked "ended" within one scan cycle (5 seconds).
4. **Given** Argus starts after Claude is already running, **When** `~/.claude/sessions/` already contains JSON files, **Then** Argus reads them and creates/updates sessions with the correct PIDs.

---

### User Story 2 - Copilot CLI PID mapping robustness (Priority: P2)

As a developer running Copilot CLI sessions, I want Argus to maintain PID mappings for Copilot CLI sessions using the existing lock file mechanism with improved end-of-session detection.

**Why this priority**: Copilot CLI already has a working PID mechanism via `inuse.{PID}.lock` files. This story ensures consistent behavior: lock file present + PID running = active; lock file missing or PID dead = ended.

**Independent Test**: Start a Copilot CLI session. Verify the PID is shown on the dashboard. Kill the Copilot process externally. Verify the session transitions to "ended" within 10 seconds.

**Acceptance Scenarios**:

1. **Given** a Copilot CLI session directory with `inuse.{PID}.lock`, **When** Argus scans, **Then** the PID from the lock filename is stored on the session.
2. **Given** a Copilot CLI session whose lock file disappears while the session is active, **When** the next scan runs, **Then** Argus marks the session ended.
3. **Given** a stale lock file referencing a PID that is no longer running, **When** Argus scans, **Then** the session is marked "ended".

---

### User Story 3 - PID-based session lifecycle (Priority: P1)

As a developer, I want session end detection to be driven primarily by PID liveness (is the process still running?), not JSONL file freshness, so that sessions end promptly when the process exits instead of waiting for a 60-minute timeout.

**Why this priority**: The current JSONL-freshness-based approach has a 60-minute delay before detecting ended sessions with null PIDs. With deterministic PID mapping, every session should have a PID, making PID liveness the primary and fast signal.

**Independent Test**: Start a Claude Code session. Verify PID is assigned. Kill the process externally (Task Manager / `kill`). Session transitions to "ended" within 10 seconds on the dashboard.

**Acceptance Scenarios**:

1. **Given** a session with an assigned PID, **When** that PID is no longer in the process list, **Then** the session is marked "ended" within one reconciliation cycle (5 seconds).
2. **Given** a session with `pid=null` (registry file not yet available), **When** the session is younger than 60 seconds, **Then** it is not ended (grace period for the registry file to appear).
3. **Given** a session with `pid=null` older than 60 seconds, **When** the JSONL file is stale (older than configurable threshold), **Then** the session is marked "ended" as a fallback.

---

### User Story 4 - Unified PID source tracking (Priority: P3)

As an Argus maintainer, I want each session to record where its PID came from (session registry, PTY registry, lock file), so that PID resolution is debuggable.

**Why this priority**: Nice-to-have observability. When PID assignment fails, knowing the source helps debug.

**Independent Test**: Query `GET /api/v1/sessions/:id` and verify the response includes a `pidSource` field (e.g., "session_registry", "pty_registry", "lockfile").

**Acceptance Scenarios**:

1. **Given** a session's PID was resolved from `~/.claude/sessions/{PID}.json`, **When** querying the session API, **Then** `pidSource` is "session_registry".
2. **Given** a session launched via Argus (PTY), **When** querying the session API, **Then** `pidSource` is "pty_registry".
3. **Given** a Copilot CLI session, **When** querying the session API, **Then** `pidSource` is "lockfile".

---

### Edge Cases

- What happens when two Claude Code sessions run in the same repo? Each has a distinct `{PID}.json` file with a distinct `sessionId`. Argus reads both and maps correctly with no ambiguity.
- What happens when a Claude process crashes without cleaning up its `{PID}.json`? The PID will no longer appear in the process list. `reconcileStaleSessions()` detects this and marks the session ended. The stale JSON file is ignored on subsequent scans (PID not running).
- What happens when Argus starts after Claude is already running? `~/.claude/sessions/` already contains JSON files. Argus reads them on the first scan cycle.
- What happens when `~/.claude/sessions/` does not exist? Argus falls back to the existing hook-based and JSONL-scan-based detection (graceful degradation for older Claude Code versions).
- What happens when hooks are not injected? Sessions are still discovered via the session registry scan and JSONL scan. Hooks provide faster detection but are not required.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST scan `~/.claude/sessions/*.json` on every poll cycle (5 seconds) to discover Claude Code session-to-PID mappings.
- **FR-002**: For each JSON file found, system MUST match the `sessionId` field to an existing session record, or create a new session if one does not exist for a registered repository matching the `cwd`.
- **FR-003**: System MUST store the PID from the JSON file on the session record and set `pidSource` to "session_registry".
- **FR-004**: System MUST detect session end when a previously seen `{PID}.json` file disappears from the directory, and mark the corresponding session as "ended".
- **FR-005**: System MUST also detect session end via PID liveness: if the session's PID is no longer in the process list, mark it "ended" within one reconciliation cycle (5 seconds).
- **FR-006**: System MUST continue to use the `inuse.{PID}.lock` mechanism for Copilot CLI sessions, with `pidSource` set to "lockfile".
- **FR-007**: For PTY-launched sessions, system MUST use the PTY registry PID (deterministic) and set `pidSource` to "pty_registry". The session registry file confirms the mapping but does not override the PTY PID.
- **FR-008**: System MUST fall back to JSONL file freshness checks for sessions where no PID could be resolved (e.g., `~/.claude/sessions/` does not exist).
- **FR-009**: System MUST add a `pid_source` column to the `sessions` table (TEXT, nullable) to persist the PID assignment source.
- **FR-010**: System MUST NOT create duplicate session records when the same session is discovered via multiple mechanisms (session registry, hooks, JSONL scan).
- **FR-011**: System MUST expose `pidSource` in the `GET /api/v1/sessions` and `GET /api/v1/sessions/:id` API responses.
- **FR-012**: System MUST handle the `~/.claude/sessions/` directory not existing gracefully (older Claude Code versions or first run before any session starts).

### Key Entities

- **Session**: Existing entity, gains reliable `pid` field and new `pidSource` column ("session_registry", "pty_registry", "lockfile", null).
- **ClaudeSessionRegistryEntry**: Transient structure from `{PID}.json`: `{ pid, sessionId, cwd, startedAt, kind, entrypoint }`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: When two Claude Code sessions run simultaneously (same or different repos), both sessions have non-null PIDs on the dashboard within 10 seconds.
- **SC-002**: When a Claude Code process exits, the corresponding session transitions to "ended" within 10 seconds.
- **SC-003**: The `pidSource` field is correctly set for all sessions: "session_registry" for detected Claude sessions, "pty_registry" for PTY-launched sessions, "lockfile" for Copilot CLI sessions.
- **SC-004**: Copilot CLI sessions continue to detect PID from lock files and transition to "ended" within 10 seconds of process exit.
- **SC-005**: When `~/.claude/sessions/` does not exist, Argus falls back to JSONL-based detection without errors.
- **SC-006**: No duplicate sessions are created when the same session is discovered via session registry, hooks, and JSONL scan simultaneously.

## Clarifications

### Session 2026-04-09

- **PID source of truth**: `~/.claude/sessions/{PID}.json` is the primary PID source for Claude Code. No timestamp correlation or process list heuristics needed.
- **PTY override**: For "Launch with Argus" sessions, the PTY registry provides the PID deterministically. The session registry file confirms but does not override.
- **Hooks-off resilience**: If hooks are disabled, sessions are still discovered via the session registry scan and JSONL scan. Hooks provide faster initial detection but are not required.
- **Audit table**: Not needed (dropped US3 from original spec). The `pidSource` column on the session record provides sufficient observability. Full audit trail can be added later if needed.
- **Unregistered repos**: Session registry entries whose `cwd` does not match any registered repository are ignored. Argus is repo-centric; users add repos they want to monitor. The session is detected if the user later registers the repo.

## Assumptions

- Claude Code versions used with Argus maintain the `~/.claude/sessions/` directory with `{PID}.json` files.
- The JSON files are created when Claude starts and removed when Claude exits cleanly. Crash scenarios leave stale files (handled by PID liveness check).
- Copilot CLI continues to use `inuse.{PID}.lock` files in session state directories.
- The Argus server polls every 5 seconds (existing behavior, not changed by this feature).
- `psList` is still used for PID liveness checks (is this PID running?) but no longer for PID discovery/matching.
