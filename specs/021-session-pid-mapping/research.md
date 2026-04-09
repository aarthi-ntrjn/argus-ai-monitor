# Research: Session-to-PID Mapping

## Decision 1: Primary PID source for Claude Code

**Decision**: Use `~/.claude/sessions/{PID}.json` as the primary PID source.

**Rationale**: Claude Code maintains these files natively. Each file contains `pid`, `sessionId`, `cwd`, `startedAt`. The filename itself is the PID. This is a deterministic mapping that works with any number of concurrent sessions, including multiple sessions in the same repo.

**Alternatives considered**:
- **psList matching by cwd**: Rejected. `psList` on Windows does not return `cwd`. Even on macOS/Linux, multiple Claude processes in the same repo are ambiguous.
- **psList matching by single-process assumption**: Rejected. Breaks with >=2 concurrent sessions.
- **Timestamp correlation**: Rejected. Fragile heuristic; unnecessary now that deterministic data exists.
- **Hook payload PID field**: Rejected. Claude hooks do not include PID in the payload.

## Decision 2: Session end detection strategy

**Decision**: PID liveness is the primary signal. JSONL freshness is the fallback for sessions without PIDs.

**Rationale**: With deterministic PID mapping, every Claude session should have a PID. Checking if the PID is still running (via `psList`) is fast and definitive. JSONL freshness (60-min threshold) is kept only as a safety net for edge cases where PID assignment failed.

**Alternatives considered**:
- **JSONL freshness only**: Rejected. Too slow (60-min delay).
- **Session registry file disappearance only**: Considered but insufficient alone. Claude may not clean up the file on crash. PID liveness check handles both clean exit and crash.

## Decision 3: Integration point for registry scan

**Decision**: Add registry scan to `SessionMonitor.runScan()` poll cycle (every 5 seconds), before `reconcileClaudeCodeSessions()`.

**Rationale**: The poll cycle already runs every 5 seconds and handles session discovery. Adding the registry scan here keeps all detection in one place and ensures PIDs are assigned before reconciliation checks PID liveness.

**Alternatives considered**:
- **chokidar file watcher on ~/.claude/sessions/**: Rejected. Adds complexity; 5-second polling is sufficient for the use case.
- **Hook-triggered scan**: Rejected. Hooks may not be enabled. Registry scan should work independently.

## Decision 4: pidSource tracking

**Decision**: Add `pid_source TEXT` column to the `sessions` table. Store the source as a string enum: "session_registry", "pty_registry", "lockfile", null.

**Rationale**: Simple, observable, no additional table needed. The API exposes it for debugging. A full audit table (`session_pids`) was considered but rejected as over-engineering for a single-user tool.

## Decision 5: Handling stale session registry files

**Decision**: When a `{PID}.json` file exists but the PID is not in the process list, treat the session as ended and ignore the stale file.

**Rationale**: Claude removes the file on clean exit. If the file remains after a crash, the PID liveness check catches it. The stale file is not deleted by Argus (it's Claude's file), just ignored.
