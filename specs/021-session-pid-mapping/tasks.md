# Tasks: 021-session-pid-mapping

## Phase 1: Setup

**Goal**: Database migration and type updates for `pidSource`.

- [ ] T001 [P] Add `pid_source` column to sessions table schema in `backend/src/db/schema.ts`
- [ ] T002 [P] Add migration logic in `backend/src/db/database.ts` to ALTER TABLE and backfill existing sessions
- [ ] T003 [P] Add `PidSource` type and `pidSource` field to `Session` interface in `backend/src/models/index.ts`
- [ ] T004 [P] Add `pidSource` to frontend `Session` type in `frontend/src/types.ts`
- [ ] T005 Update all `upsertSession` and `getSession` SQL queries to include `pid_source` column in `backend/src/db/database.ts`

## Phase 2: Core scanner (US1)

**Goal**: Create `ClaudeSessionRegistry` that reads `~/.claude/sessions/*.json` and returns PID-to-session mappings.

**Independent Test**: Unit tests mock the filesystem. Given a directory with two `{PID}.json` files, the scanner returns two entries with correct `pid`, `sessionId`, and `cwd`. Given an empty or missing directory, the scanner returns an empty array.

- [ ] T006 Write unit tests for `ClaudeSessionRegistry` in `backend/tests/unit/claude-session-registry.test.ts`: read entries, handle missing dir, handle malformed JSON, handle empty dir
- [ ] T007 Implement `ClaudeSessionRegistry` service in `backend/src/services/claude-session-registry.ts`: `scanEntries()` returns `ClaudeSessionRegistryEntry[]` by reading `~/.claude/sessions/*.json`
- [ ] T008 Add `ClaudeSessionRegistryEntry` type to `backend/src/models/index.ts`

## Phase 3: Integration into poll cycle (US1, US3)

**Goal**: Wire the registry scanner into `SessionMonitor.runScan()` so sessions get PIDs from the registry on every cycle.

**Independent Test**: With a mock registry returning entries, after one poll cycle, sessions in the DB have the correct `pid` and `pidSource="session_registry"`. Sessions whose registry files disappear are marked ended.

- [ ] T009 Write unit tests in `backend/tests/unit/session-monitor.test.ts`: registry scan assigns PID, registry file disappearance ends session, PTY PID not overwritten by registry, null-PID sessions retried
- [ ] T010 Add `ClaudeSessionRegistry` instance to `SessionMonitor` constructor in `backend/src/services/session-monitor.ts`
- [ ] T011 Add `reconcileClaudeSessionRegistry()` method to `SessionMonitor` that: reads registry entries, matches `sessionId` to DB sessions, assigns PID + pidSource for unmatched sessions, detects disappeared files and ends sessions
- [ ] T012 Call `reconcileClaudeSessionRegistry()` in `SessionMonitor.runScan()` before `reconcileClaudeCodeSessions()`
- [ ] T013 In `reconcileClaudeSessionRegistry()`, skip PID assignment for sessions that already have `pidSource="pty_registry"` (PTY takes precedence)

## Phase 4: Update detector to use registry (US1)

**Goal**: Remove heuristic PID resolution from `ClaudeCodeDetector`. Registry is now the PID source.

**Independent Test**: With registry providing PIDs, the detector no longer calls `psList` for PID matching. Sessions created by hooks get `pid=null` initially, then the registry scan assigns the PID on the next cycle.

- [ ] T014 Write unit tests in `backend/tests/unit/claude-code-detector-scan.test.ts`: hook creates session with pid=null, scanExistingSessions no longer assigns PID via psList heuristic
- [ ] T015 Remove single-process PID assumption from `scanExistingSessions()` in `backend/src/services/claude-code-detector.ts` (remove the `claudeProcesses.length === 1` logic)
- [ ] T016 Remove psList-based PID assignment from `handleHookPayload()` in `backend/src/services/claude-code-detector.ts` (new read-only sessions start with pid=null)
- [ ] T017 Keep the `psList` import only for `reconcileStaleSessions()` PID liveness checks

## Phase 5: Copilot CLI hardening (US2)

**Goal**: Ensure Copilot CLI PID detection via lock file is robust and sets `pidSource`.

**Independent Test**: Copilot session with lock file gets `pidSource="lockfile"`. Lock file disappearing marks session ended.

- [ ] T018 Write unit test in `backend/tests/unit/copilot-cli-detector.test.ts` (or existing test file): lock file PID stored with pidSource="lockfile", missing lock file ends session
- [ ] T019 Update `CopilotCliDetector` to set `pidSource="lockfile"` when assigning PID from lock file in `backend/src/services/copilot-cli-detector.ts`

## Phase 6: API exposure (US4)

**Goal**: Expose `pidSource` in session API responses.

**Independent Test**: `GET /api/v1/sessions` returns `pidSource` field for each session.

- [ ] T020 Write contract test in `backend/tests/contract/sessions-api.test.ts`: response includes pidSource field
- [ ] T021 Update session SQL queries in `backend/src/api/routes/sessions.ts` (if needed) to include `pid_source` column mapping
- [ ] T022 [P] Update `backend/src/db/database.ts` getSessions/getSession to map `pid_source` as `pidSource` in the SELECT

## Phase 7: Polish & cross-cutting

**Goal**: README update, remove dead code, full test run.

- [ ] T023 Update `README.md` to document PID detection mechanism (session registry for Claude Code, lock file for Copilot CLI)
- [ ] T024 Remove dead `psList`-based PID matching code from `claude-code-detector.ts` (the code removed in T015/T016 may leave unused imports)
- [ ] T025 Run full test suite (`npm test`) and fix any failures
- [ ] T026 Run frontend build (`npm run build --workspace=frontend`) and verify no errors
