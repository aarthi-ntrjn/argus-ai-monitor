# Tasks: Repository Compare Link and Session Focus Button

**Input**: Design documents from `/specs/032-repo-compare-session-focus/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No new infrastructure is needed; this feature extends the existing monorepo structure. The only shared work is adding the `remoteUrl` column to the DB and updating the `Repository` type used by both features.

- [x] T001 [P] [US1] Write unit tests for `getRemoteUrl()` and `buildGitHubCompareUrl()` in `backend/tests/unit/repository-scanner.test.ts` (tests must FAIL before implementation)
- [x] T002 [P] [US2] Write contract tests for `POST /api/v1/sessions/:id/focus` in `backend/tests/contract/sessions-focus.test.ts` (tests must FAIL before implementation)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: DB schema migration and shared type changes that both features depend on.

**⚠️ CRITICAL**: Both user story implementations depend on this phase.

- [x] T003 Add `remote_url TEXT` column to `SCHEMA_SQL` in `backend/src/db/schema.ts`
- [x] T004 Add runtime migration for `remote_url` in `getDb()` in `backend/src/db/database.ts` (follow the existing `repoCols.includes(...)` pattern)
- [x] T005 Update all repository `SELECT` queries in `backend/src/db/database.ts` to include `remote_url as remoteUrl`
- [x] T006 Update `insertRepository` in `backend/src/db/database.ts` to include `remote_url`
- [x] T007 Add `updateRepositoryRemoteUrl(id: string, remoteUrl: string | null): void` to `backend/src/db/database.ts`
- [x] T008 Add `remoteUrl: string | null` to `Repository` interface in `backend/src/models/index.ts`
- [x] T009 Add `remoteUrl: string | null` to `Repository` interface in `frontend/src/types.ts`

**Checkpoint**: Foundation ready — both user story phases can proceed.

---

## Phase 3: User Story 1 - GitHub Compare Link (Priority: P1)

**Goal**: Repository card shows a GitHub compare link icon that opens the branch comparison in a new tab.

**Independent Test**: Add a GitHub-backed repo on a feature branch; verify the compare icon appears and links to the correct GitHub compare URL.

### Backend Implementation for User Story 1

- [x] T010 Add `getRemoteUrl(repoPath: string): Promise<string | null>` to `backend/src/services/repository-scanner.ts` (runs `git remote get-url origin`)
- [x] T011 Add `buildGitHubCompareUrl(remoteUrl: string | null, branch: string | null): string | null` pure helper to `backend/src/services/repository-scanner.ts`
- [x] T012 Call `getRemoteUrl()` alongside `getCurrentBranch()` in `registerIfNew()` in `backend/src/services/repository-scanner.ts` and store the result
- [x] T013 Update `POST /api/v1/repositories` in `backend/src/api/routes/repositories.ts` to fetch and store `remoteUrl` when a new repo is registered
- [x] T014 Update `updateRepositoryBranch()` in `backend/src/db/database.ts` to also accept and update `remoteUrl`; update callers in `repository-scanner.ts`

### Frontend Implementation for User Story 1

- [x] T015 [P] Write frontend unit tests for compare link rendering in `frontend/src/__tests__/RepoCard.test.tsx` (tests must FAIL before component changes)
- [x] T016 Add `buildGitHubCompareUrl(remoteUrl: string | null, branch: string | null): string | null` pure utility to `frontend/src/utils/repoUtils.ts` (new file)
- [x] T017 Update `RepoCard.tsx` to render a compare link icon (external link SVG) next to the branch badge when `buildGitHubCompareUrl` returns a non-null URL; link opens in `target="_blank" rel="noopener noreferrer"`

**Checkpoint**: Repositories with GitHub remotes now show a working compare link.

---

## Phase 4: User Story 2 - Session Focus Button (Priority: P1)

**Goal**: Session card shows a Focus button that brings the terminal window to the foreground.

**Independent Test**: Launch a session, click Focus, verify the terminal window comes to front on Windows/macOS/Linux.

### Backend Implementation for User Story 2

- [x] T018 Add `focusProcess(pid: number): Promise<void>` helper to `backend/src/services/process-utils.ts` with platform-specific logic: PowerShell `SetForegroundWindow` on Windows, `osascript` on macOS, `wmctrl`/`xdotool` on Linux
- [x] T019 Add `focusSession(sessionId: string): Promise<{ pid: number }>` method to `backend/src/services/session-controller.ts` (validates session exists and is not ended; uses `hostPid` first, falls back to `pid`; throws `PID_NOT_SET`, `WINDOW_NOT_FOUND`, or `FOCUS_NOT_SUPPORTED` coded errors)
- [x] T020 Add `POST /api/v1/sessions/:id/focus` route to `backend/src/api/routes/sessions.ts` following the existing error-handling pattern from `stop` and `interrupt` routes

### Frontend Implementation for User Story 2

- [x] T021 [P] Add `focusSession(sessionId: string): Promise<void>` to `frontend/src/services/api.ts`
- [x] T022 [P] Add `useFocusSession()` hook to `frontend/src/hooks/useFocusSession.ts` using `useMutation` from React Query; exposes `focus(sessionId)`, `isPending`, and `error`
- [x] T023 Update `SessionCard.tsx` to render a Focus button (using shared `Button` component, variant `ghost`, size `sm`) visible when session is not `ended`/`completed`; disabled when `session.pid == null && session.hostPid == null`; clicking calls `useFocusSession().focus(session.id)`; brief error state shown on failure
- [x] T024 Update frontend unit tests in `frontend/src/__tests__/SessionCard.test.tsx` to cover: Focus button present for active session; button disabled when no PID; button absent for ended session

**Checkpoint**: Active sessions have a working Focus button; ended sessions do not.

---

## Phase 5: Polish and Cross-Cutting Concerns

**Purpose**: Documentation, cleanup, and final validation.

- [x] T025 [P] Update `README.md` to document the new compare link feature (repo card section) and the Focus button feature (session card section) per §XI
- [x] T026 [P] Run full backend test suite: `npm run test --workspace=backend` and confirm all tests pass
- [x] T027 [P] Build frontend: `npm run build --workspace=frontend` and confirm build succeeds
- [x] T028 Verify compare link appears and opens correct URL for a GitHub-backed repo on a feature branch
- [x] T029 Verify Focus button is present on active session cards and absent on ended session cards

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Tests first)**: Run in parallel; tests MUST fail before any implementation
- **Phase 2 (Foundation)**: Depends on Phase 1 — blocks both user story phases
- **Phase 3 (US1 - Compare Link)**: Depends on Phase 2 completion
- **Phase 4 (US2 - Focus Button)**: Depends on Phase 2 completion; can run in parallel with Phase 3
- **Phase 5 (Polish)**: Depends on Phase 3 and Phase 4

### Within Each Phase

- T001, T002 run in parallel (different test files)
- T003–T009 run sequentially (T003 before T004; T004–T007 before T008; T008 before T009)
- T010–T014 run sequentially; T015 and T016 can start in parallel after T009
- T018–T020 run sequentially; T021 and T022 run in parallel; T023 depends on T021, T022
- T025–T027 run in parallel in Phase 5
