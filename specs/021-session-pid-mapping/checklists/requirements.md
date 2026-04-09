# Requirements Checklist: 021-session-pid-mapping

## Spec Quality

- [x] All user stories have P1/P2/P3 priority assigned
- [x] All user stories have independent test criteria
- [x] All user stories have acceptance scenarios in Given/When/Then format
- [x] All functional requirements are measurable and testable
- [x] All success criteria are measurable with specific thresholds
- [x] Edge cases are documented
- [x] Assumptions are stated explicitly
- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Key entities are identified
- [x] Discovery section documents the `~/.claude/sessions/` mechanism

## FR Coverage

- [x] FR-001: Scan ~/.claude/sessions/*.json every poll cycle
- [x] FR-002: Match sessionId to existing session or create new
- [x] FR-003: Store PID and set pidSource to "session_registry"
- [x] FR-004: Detect session end when {PID}.json disappears
- [x] FR-005: PID liveness check via process list
- [x] FR-006: Copilot CLI lock file mechanism maintained
- [x] FR-007: PTY registry PID takes precedence
- [x] FR-008: JSONL freshness fallback for no-PID sessions
- [x] FR-009: pid_source column added to sessions table
- [x] FR-010: No duplicate sessions from multiple discovery mechanisms
- [x] FR-011: pidSource exposed in API responses
- [x] FR-012: Graceful degradation when ~/.claude/sessions/ missing

## SC Coverage

- [x] SC-001: Two simultaneous sessions get PIDs within 10s
- [x] SC-002: Session ends within 10s of process exit
- [x] SC-003: pidSource correctly set for all session types
- [x] SC-004: Copilot CLI end detection within 10s
- [x] SC-005: Graceful fallback when session registry missing
- [x] SC-006: No duplicate sessions from multiple discovery paths
