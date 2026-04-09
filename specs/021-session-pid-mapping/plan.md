# Implementation Plan: Session-to-PID Mapping

**Branch**: `021-session-pid-mapping` | **Date**: 2026-04-09 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/021-session-pid-mapping/spec.md`

## Summary

Replace heuristic-based PID resolution for Claude Code sessions with deterministic mapping from `~/.claude/sessions/{PID}.json`. Add a new `SessionRegistryScanner` service that reads this directory on every poll cycle, matching entries to sessions by `sessionId`. Add `pid_source` column to the sessions table. Harden Copilot CLI lock file detection. Remove the single-process assumption from the existing detector.

## Technical Context

**Language/Version**: TypeScript 5.x (Node.js 22 LTS)
**Primary Dependencies**: better-sqlite3, chokidar, ps-list, fastify, @tanstack/react-query
**Storage**: SQLite (better-sqlite3), `~/.argus/argus.db`
**Testing**: Vitest (unit), Playwright (e2e)
**Target Platform**: Windows 11, macOS, Linux (localhost developer tool)
**Project Type**: Web application (backend API + React frontend)
**Performance Goals**: Poll cycle completes in <100ms; session detection within 10s
**Constraints**: Single-user localhost tool; no auth required (§VI exception)
**Scale/Scope**: >=10 concurrent sessions (§VIII exception for localhost tools)

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| §I Engineering | PASS | Simple file-read approach; observable via pidSource field |
| §II Architecture | PASS | All changes within existing backend service layer |
| §III Code Standards | PASS | New scanner is a focused service <50 lines per function |
| §IV Test-First | PASS | Tests written before implementation per phase |
| §V Testing | PASS | Unit tests for scanner, integration tests for API |
| §VI Security | EXCEPTION | Localhost-only, single user; declared in spec |
| §VII Observability | PASS | pidSource field provides traceability; structured logging |
| §VIII Performance | EXCEPTION | Localhost tool; target >=10 concurrent sessions |
| §IX AI Usage | PASS | Implementation code only; architecture decided by human |
| §X Definition of Done | PASS | Tests, docs, README update included |
| §XI Documentation | PASS | README update task in final phase |
| §XII Error Handling | PASS | Graceful degradation when session registry missing |

## Project Structure

### Documentation (this feature)

```text
specs/021-session-pid-mapping/
  plan.md              # This file
  research.md          # Phase 0 research
  data-model.md        # Entity definitions
  contracts/           # API changes
  tasks.md             # Task list
  checklists/          # Requirements checklist
```

### Source Code (repository root)

```text
backend/
  src/
    services/
      claude-session-registry.ts    # NEW: reads ~/.claude/sessions/*.json
      claude-code-detector.ts       # MODIFIED: uses registry for PID, removes psList heuristics
      session-monitor.ts            # MODIFIED: integrates registry scan into poll cycle
      copilot-cli-detector.ts       # MODIFIED: minor hardening of lock file handling
    models/
      index.ts                      # MODIFIED: add pidSource to Session type
    db/
      database.ts                   # MODIFIED: add pid_source column, migration
      schema.ts                     # MODIFIED: add pid_source to CREATE TABLE
    api/
      routes/
        sessions.ts                 # MODIFIED: expose pidSource in API response
  tests/
    unit/
      claude-session-registry.test.ts   # NEW
      claude-code-detector-scan.test.ts # MODIFIED
      session-monitor.test.ts           # MODIFIED

frontend/
  src/
    types.ts                        # MODIFIED: add pidSource to Session type
```

**Structure Decision**: All changes are within existing backend services. One new file (`claude-session-registry.ts`) encapsulates the session registry reading logic. No new directories or packages.

## Phases

### Phase 0: Research

See [research.md](research.md).

### Phase 1: Design

See [data-model.md](data-model.md) and [contracts/](contracts/).

### Phase 2: Implementation (via tasks.md)

1. **Setup**: DB migration for `pid_source` column, type updates
2. **Core**: `ClaudeSessionRegistry` scanner service
3. **Integration**: Wire scanner into poll cycle, update detector to use it
4. **Reconciliation**: PID-first session end detection
5. **API**: Expose `pidSource` in session responses
6. **Polish**: README update, cleanup old heuristics
