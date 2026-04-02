# Tasks: Session Dashboard

**Branch**: `001-session-dashboard` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)
**Input**: Design documents from `specs/001-session-dashboard/`

**Tests**: Included per constitution (Principles IV & V — Test-First, Testing Requirements).

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- **Test tasks**: Written FIRST; must FAIL before implementation begins

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize monorepo structure, tooling, and test runners. All Phase 1 tasks can run in parallel after T001.

- [X] T001 Create monorepo directory structure: `backend/`, `frontend/`, root `package.json` workspace config
- [X] T002 [P] Initialize backend `package.json` with TypeScript 5, Fastify 4, ws, better-sqlite3, chokidar, pino, js-yaml, ps-list at `backend/package.json`
- [X] T003 [P] Initialize frontend with Vite + React 18 + TypeScript: `frontend/package.json` and `frontend/vite.config.ts`
- [X] T004 [P] Configure backend `tsconfig.json` for Node 22, strict mode, ESM output at `backend/tsconfig.json`
- [X] T005 [P] Configure frontend `tsconfig.json` for Vite + React at `frontend/tsconfig.json`
- [X] T006 [P] Configure ESLint + Prettier for backend at `backend/.eslintrc.json` and `backend/.prettierrc`
- [X] T007 [P] Configure ESLint + Prettier for frontend at `frontend/.eslintrc.json` and `frontend/.prettierrc`
- [X] T008 [P] Configure Vitest for backend at `backend/vitest.config.ts` with coverage reporting
- [X] T009 [P] Configure Playwright for E2E tests at `playwright.config.ts` (targets `http://localhost:7411`)

**Checkpoint**: Project structure exists, all tooling configured. `npm install` runs clean across both workspaces.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure required by ALL user stories. No story work begins until this phase is complete.

**⚠️ CRITICAL**: These tasks BLOCK all user stories.

- [X] T010 Define TypeScript model interfaces: `Repository`, `Session`, `SessionOutput`, `ControlAction`, `ArgusConfig` at `backend/src/models/index.ts`
- [X] T011 [P] Implement `ArgusConfig` loader (read/write `~/.argus/config.json`, create with defaults if absent) at `backend/src/config/config-loader.ts`
- [X] T012 Implement SQLite schema (tables: `repositories`, `sessions`, `session_output`, `control_actions`) at `backend/src/db/schema.ts`
- [X] T013 Implement database connection, query helpers, and migration runner at `backend/src/db/database.ts`
- [X] T014 Implement Fastify server entry point bound to `127.0.0.1`, pino structured logging, graceful shutdown at `backend/src/server.ts`
- [X] T014b Implement Fastify `requestIdHeader` and inject `requestId` into all pino log entries; return `X-Request-Id` header in all error responses for failure traceability at `backend/src/server.ts`
- [X] T015 Implement WebSocket event dispatcher (register clients, broadcast typed events) at `backend/src/api/ws/event-dispatcher.ts`
- [X] T016 [P] Implement frontend WebSocket client with exponential backoff reconnection at `frontend/src/services/socket.ts`
- [X] T017 [P] Implement frontend REST API client with TanStack Query base configuration (queryClient, axios instance) at `frontend/src/services/api.ts`

**Checkpoint**: Server starts, connects to SQLite, serves WebSocket upgrades at `ws://localhost:7411/ws`. Frontend compiles and connects.

---

## Phase 3: User Story 1 — Repository & Session Overview (Priority: P1) 🎯 MVP

**Goal**: Developer opens Argus and sees all registered repositories with active session counts, updating in real time.

**Independent Test**: Register 2 repos, start Copilot CLI in one and Claude Code in the other. Open dashboard → both repos appear within 5s; sessions are labeled with correct type; no manual refresh needed (SC-001, SC-005).

### Tests for User Story 1

> **Write these tests FIRST. Verify they FAIL before writing any implementation.**

- [X] T018 [P] [US1] Write contract tests for `GET /api/v1/repositories`, `POST /api/v1/repositories`, `DELETE /api/v1/repositories/:id` at `backend/tests/contract/repositories.test.ts`
- [X] T019 [P] [US1] Write contract test for `GET /api/v1/sessions` (with `repositoryId`, `status`, `type` filters) at `backend/tests/contract/sessions.test.ts`
- [X] T020 [P] [US1] Write integration test for `CopilotCliDetector`: mock `~/.copilot/session-state/` directory with fixture files; assert sessions detected with correct PID, CWD, status at `backend/tests/integration/copilot-cli-detector.test.ts`
- [X] T021 [P] [US1] Write integration test for `ClaudeCodeDetector`: simulate hook POST payload; assert session record created with correct repo association at `backend/tests/integration/claude-code-detector.test.ts`

### Implementation for User Story 1

- [X] T022 [P] [US1] Implement `RepositoryScanner` service: scan configured directories for `.git` repos, persist to SQLite, detect new/removed repos at `backend/src/services/repository-scanner.ts`
- [X] T023 [P] [US1] Implement `CopilotCliDetector`: scan `~/.copilot/session-state/`, parse `inuse.{PID}.lock` + `workspace.yaml`, map CWD to registered repo. **Validate each PID against running processes via `ps-list`** — if process is gone but lock file exists, mark session as `ended` (stale lock) at `backend/src/services/copilot-cli-detector.ts`
- [X] T024 [P] [US1] Implement `ClaudeCodeDetector`: inject hooks into `~/.claude/settings.json`, receive `POST /hooks/claude` payloads, create/update session records at `backend/src/services/claude-code-detector.ts`
- [X] T025 [US1] Implement `SessionMonitor` orchestrator: coordinate detectors, manage session lifecycle, emit typed domain events at `backend/src/services/session-monitor.ts`
- [X] T026 [US1] Implement `GET`, `POST`, `DELETE /api/v1/repositories` route handlers with input validation at `backend/src/api/routes/repositories.ts`
- [X] T027 [US1] Implement `GET /api/v1/sessions` route handler with filter support at `backend/src/api/routes/sessions.ts`
- [X] T028 [US1] Implement `POST /hooks/claude` event receiver route at `backend/src/api/routes/hooks.ts`
- [X] T029 [US1] Wire `repository.added`, `repository.removed`, `session.created`, `session.updated`, `session.ended` events through `event-dispatcher.ts` at `backend/src/api/ws/event-dispatcher.ts`
- [X] T030 [P] [US1] Implement frontend `DashboardPage` with repository list, session count badges, and loading states at `frontend/src/pages/DashboardPage.tsx`
- [X] T031 [P] [US1] Implement frontend `SessionCard` component: session type badge, status indicator, `startedAt` timestamp at `frontend/src/components/SessionCard/SessionCard.tsx`
- [X] T032 [US1] Connect `session.created`, `session.updated`, `session.ended`, `repository.added`, `repository.removed` WebSocket events to `DashboardPage` live state at `frontend/src/services/socket.ts` *(extends T016 — must be implemented after T016 is complete)*

**Checkpoint**: US1 fully functional. Open dashboard, see repos and sessions, watch live updates without refresh.

---

## Phase 4: User Story 2 — Session State & Results (Priority: P1)

**Goal**: Select a session and see its current state, activity, and output stream updating in real time.

**Independent Test**: Start an active Copilot CLI session. Open its detail view. Type a prompt in the terminal. Confirm new output events appear in the dashboard within 2 seconds (SC-002, SC-003).

### Tests for User Story 2

> **Write these tests FIRST. Verify they FAIL before writing any implementation.**

- [X] T033 [P] [US2] Write contract tests for `GET /api/v1/sessions/:id` and `GET /api/v1/sessions/:id/output` (pagination with `limit`, `before` params) at `backend/tests/contract/sessions.test.ts`
- [X] T034 [P] [US2] Write unit test for `events.jsonl` parser: assert each Copilot CLI event type maps to correct `SessionOutput.type` at `backend/tests/unit/events-parser.test.ts`
- [X] T035 [P] [US2] Write integration test for `OutputStore`: persist 200 output records, assert paginated reads and size-limit pruning (oldest removed when limit exceeded) at `backend/tests/integration/output-store.test.ts`

### Implementation for User Story 2

- [X] T036 [US2] Implement `OutputStore` service: persist `SessionOutput` to SQLite, paginated reads, enforce per-session size limit with oldest-first pruning at `backend/src/services/output-store.ts`
- [X] T037 [P] [US2] Implement `events.jsonl` event parser: map Copilot CLI event types (`tool.execution_start`, `assistant.message`, etc.) to `SessionOutput` records at `backend/src/services/events-parser.ts`
- [X] T038 [US2] Add `chokidar` file watcher to `CopilotCliDetector` to tail `events.jsonl` on active sessions and feed `OutputStore` at `backend/src/services/copilot-cli-detector.ts`
- [X] T039 [US2] Add `GET /api/v1/sessions/:id` and `GET /api/v1/sessions/:id/output` route handlers to `backend/src/api/routes/sessions.ts`
- [X] T040 [US2] Wire `session.output` WebSocket broadcast in `event-dispatcher.ts` triggered by `OutputStore` writes at `backend/src/api/ws/event-dispatcher.ts`
- [X] T041 [P] [US2] Implement frontend `SessionPage`: session metadata header (type, status, PID, duration), navigation back to dashboard at `frontend/src/pages/SessionPage.tsx`
- [X] T042 [P] [US2] Implement frontend `SessionDetail` component: virtualized scrollable output stream with type labels and timestamps at `frontend/src/components/SessionDetail/SessionDetail.tsx`
- [X] T043 [US2] Connect `session.output` WebSocket events to live-append `SessionDetail` feed; integrate TanStack Query for initial output load with pagination at `frontend/src/services/socket.ts` *(extends T016 and T032 — must be implemented after T032 is complete)*

**Checkpoint**: US2 fully functional. Session detail view shows live output stream, status, and paginated history.

---

## Phase 5: User Story 3 — Session Control (Priority: P2)

**Goal**: Stop a running session or send it a prompt directly from the dashboard.

**Independent Test**: Open detail view for an active Copilot CLI session. Click Stop → confirm session terminates within 5s and status updates to `ended` (SC-004). Attempt stop on an already-ended session → error message shown.

### Tests for User Story 3

> **Write these tests FIRST. Verify they FAIL before writing any implementation.**

- [X] T044 [P] [US3] Write contract tests for `POST /api/v1/sessions/:id/stop` (202, 404, 409) at `backend/tests/contract/sessions.test.ts`
- [X] T045 [P] [US3] Write contract tests for `POST /api/v1/sessions/:id/send` (202, 404, 409, 501 for copilot-cli) at `backend/tests/contract/sessions.test.ts`
- [X] T046 [P] [US3] Write unit test for `SessionController`: mock `process.kill` and `exec('taskkill')`; assert `ControlAction` records created with correct status transitions at `backend/tests/unit/session-controller.test.ts`

### Implementation for User Story 3

- [X] T047 [US3] Implement `SessionController`: stop via `process.kill(pid, 'SIGTERM')` (Unix) or `taskkill /PID {pid} /T` (Windows); persist `ControlAction` records at `backend/src/services/session-controller.ts`
- [X] T048 [US3] Implement `POST /api/v1/sessions/:id/stop` route handler using `SessionController` at `backend/src/api/routes/sessions.ts`
- [X] T049 [US3] Implement `POST /api/v1/sessions/:id/send` route handler: `501` for `copilot-cli` with message "Prompt injection not supported for Copilot CLI in v1", `202` accepted for `claude-code`; persist `ControlAction` at `backend/src/api/routes/sessions.ts`
- [X] T050 [US3] Wire `action.updated` WebSocket broadcast in `event-dispatcher.ts` triggered by `ControlAction` status changes at `backend/src/api/ws/event-dispatcher.ts`
- [X] T051 [P] [US3] Implement frontend `ControlPanel` component: Stop button with confirmation dialog, Send Prompt form with disabled state for `copilot-cli` at `frontend/src/components/ControlPanel/ControlPanel.tsx`
- [X] T052 [US3] Integrate `ControlPanel` into `SessionPage`; wire TanStack Query mutations to `POST /api/sessions/:id/stop` and `POST /api/sessions/:id/send` at `frontend/src/pages/SessionPage.tsx`

**Checkpoint**: US3 fully functional. Can stop any active session from the dashboard; send-prompt works for Claude Code, shows clear unsupported message for Copilot CLI.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Health, resilience, retention, empty states, and acceptance validation.

- [X] T053 [P] Implement `GET /api/health` route (status, version, uptime) at `backend/src/api/routes/health.ts`
- [X] T053b [P] Implement `GET /api/metrics` route (counters: `sessions_active`, `sessions_ended`, `output_records_written`, `control_actions_total`) at `backend/src/api/routes/metrics.ts`
- [X] T053c [P] Configure `@fastify/swagger` and `@fastify/swagger-ui` to auto-generate OpenAPI spec from route schemas; serve at `GET /api/docs` at `backend/src/server.ts`
- [X] T054 [P] Implement global Fastify error handler middleware with pino-structured error logging at `backend/src/server.ts`
- [X] T055 Implement background pruning job: purge expired sessions (past `expiresAt`) and over-limit output records on a configurable interval at `backend/src/services/pruning-job.ts`
- [X] T056 [P] Add frontend empty-state screens (no repos registered, no sessions on a repo, loading skeleton) at `frontend/src/components/EmptyState/EmptyState.tsx`
- [X] T057 [P] Write Playwright E2E test for SC-001: register 2 repos with active sessions, open dashboard, assert both visible within 5s at `frontend/tests/e2e/sc-001-repo-overview.spec.ts`
- [X] T058 [P] Write Playwright E2E test for SC-002: observe active session, trigger output, assert it appears in dashboard within 2s at `frontend/tests/e2e/sc-002-real-time-output.spec.ts`
- [X] T059 [P] Write Playwright E2E test for SC-004: click Stop on active session, assert status changes to `ended` within 5s at `frontend/tests/e2e/sc-004-stop-session.spec.ts`
- [X] T060 Run all quickstart.md acceptance scenarios manually and confirm SC-001 through SC-005 pass
  > **Note**: T060 requires manual validation with live sessions. See quickstart.md for steps.

### Addendum: Remove axios dependency

- [X] T061 Remove `axios` from `frontend/package.json` and replace all usages in `frontend/src/services/api.ts` with native `fetch`; ensure all existing TypeScript types are preserved and no behaviour changes

### Addendum: Test isolation

- [X] T062 Fix integration and contract tests to use an isolated test DB (via `ARGUS_DB_PATH` env var) instead of `~/.argus/argus.db`; add afterAll cleanup in `output-store.test.ts` at `backend/tests/integration/output-store.test.ts`, `backend/src/db/database.ts`, `backend/vitest.config.ts`

### Addendum: Folder navigation UX for Add Repository

- [X] T063 Add `GET /api/v1/fs/browse` route: accepts `?path=` query param (defaults to `homedir()`), returns `{ current: string, parent: string|null, entries: { name, path, isGitRepo }[] }` listing immediate subdirectories only at `backend/src/api/routes/fs.ts`; register in `backend/src/server.ts`
- [X] T064 [P] Create `frontend/src/components/FolderBrowser/FolderBrowser.tsx`: shows current path as breadcrumb, lists subdirs (git repos highlighted with a badge), click to navigate into subdir, "Select" button emits chosen path to parent via `onSelect(path: string)` callback; uses `GET /api/v1/fs/browse`
- [X] T065 Wire `FolderBrowser` into the Add Repository modal in `frontend/src/pages/DashboardPage.tsx`: replace text input with FolderBrowser; keep manual path input as a fallback below the browser; pre-populate input when user clicks Select

### Addendum: Scan parent folder for git repositories

- [X] T067 Add `GET /api/v1/fs/scan` route: accepts `?path=` query param, walks immediate subdirectories (non-recursive) checking for `.git` folder, returns `{ scannedPath: string, repos: { name: string, path: string }[] }`; register handler in `backend/src/api/routes/fs.ts` alongside T063's browse route
- [X] T068 Add "Scan Folder" tab to the Add Repository modal in `frontend/src/pages/DashboardPage.tsx`: user picks a parent folder via `FolderBrowser` (T064), clicks "Scan", modal shows a checklist of discovered git repos, user selects any subset, "Add Selected" calls `POST /api/v1/repositories` for each; existing single-repo tab unchanged

### Addendum: Detect pre-existing sessions on startup

- [X] T066 On startup, scan `~/.claude/projects/` for Claude Code sessions that were already running before Argus started: for each project subdir check for active `claude` process via ps-list, map `cwd` to a registered repo, and upsert a `claude-code` session with `status: active`; add this scan to `ClaudeCodeDetector` as `scanExistingSessions()` called from `SessionMonitor.start()` at `backend/src/services/claude-code-detector.ts`

### Addendum: Bug — session not marked ended when process stops

- [X] T069 Fix `SessionMonitor.runScan()` in `backend/src/services/session-monitor.ts` to detect sessions that were active but are no longer returned by `CopilotCliDetector.scan()` (e.g., because the session directory was cleaned up on process exit): after each scan, diff the set of currently-returned active session IDs against a `Map<string, Session>` of previously-active sessions; for any session that has disappeared or now has `status: 'ended'`, call `updateSessionStatus(id, 'ended', endedAt)` in `backend/src/db/database.ts` and emit `session.ended`; add `updateSessionStatus` export to `database.ts` if not present

### Addendum: Bug — Copilot CLI session not detected (path mismatch)

- [X] T070 Fix `getRepositoryByPath` in `backend/src/db/database.ts` and `CopilotCliDetector.processSessionDir` in `backend/src/services/copilot-cli-detector.ts` to handle path variations on Windows (case, trailing separator, forward vs backslash): normalize both the registered repo path and the `workspace.cwd` to lowercase with `path.normalize()` before comparing; update `getRepositoryByPath` to perform a case-insensitive lookup using `LOWER(path) = LOWER(?)` so sessions whose `cwd` differs only in case or separators are correctly matched to their repo

### Addendum: Fix README

- [X] T071 Rewrite `README.md` at repo root to be crisp, concise and accurate: include a one-line description, what Argus does (monitors Copilot CLI + Claude Code sessions, real-time output, remote stop), how to run it (`npm run dev` from repo root + `npm run build` in frontend/), how to add a repo, key features list (folder browser, scan-folder bulk-add, pre-existing session detection), and a brief tech stack note (Node/Fastify backend, React frontend, SQLite); remove all placeholder text ("Coming soon", etc.)

### Addendum: Bug — stale active sessions persist across restarts

- [X] T072 On startup, reconcile stale sessions in `SessionMonitor.start()` at `backend/src/services/session-monitor.ts`: query `getSessions({ status: 'active' })` from the DB, fetch current running PIDs via ps-list, and call `updateSessionStatus(id, 'ended', now)` for any session whose `pid` is not in the running PID set (or whose `pid` is null); this must run before the first `runScan()` so the frontend never sees stale `active` sessions

### Addendum: Bug — Copilot CLI sessions not detected (js-yaml Date coercion)

- [X] T073 Fix `CopilotCliDetector.processSessionDir` in `backend/src/services/copilot-cli-detector.ts`: `js-yaml` silently coerces ISO timestamp strings (e.g. `created_at`, `updated_at`) into JavaScript `Date` objects; passing these to `upsertSession` throws "SQLite3 can only bind numbers, strings, bigints, buffers, and null" which is caught and swallowed, making every `processSessionDir` return `null`; fix by converting date fields to ISO strings when constructing the Session: `startedAt: workspace.created_at ? new Date(workspace.created_at as string | Date).toISOString() : new Date().toISOString()` and same for `endedAt`/`lastActivityAt`; update `WorkspaceYaml` interface to type these fields as `string | Date` to make the coercion visible

### Addendum: Bug — Claude Code sessions marked ended on server restart

- [X] T074 Fix `reconcileStaleSessions()` in `backend/src/services/session-monitor.ts`: the condition `if (!session.pid || ...)` evaluates `!null` as `true`, so every Claude Code session created via hooks (which always have `pid: null`) is incorrectly marked `ended` on every server restart; fix by changing the condition to `if (session.pid != null && !runningPids.has(session.pid))` so sessions without a known PID are skipped — their lifecycle is managed by hooks, not by PID presence

### Addendum: Bug — Claude Code sessions not re-detected on restart (scanExistingSessions broken on Windows)

- [X] T075 Fix `ClaudeCodeDetector.scanExistingSessions()` in `backend/src/services/claude-code-detector.ts`: two bugs: (1) it requires `psList` to return a process `cwd` to match the project path, but on Windows psList never returns `cwd`, so `matchedProcess` is always `undefined` and the entire method is a no-op; (2) even if a process is matched, it creates a new `claude-startup-{repo.id}-{pid}` session rather than re-activating an existing `ended` session — so already-ended hook sessions (e.g. incorrectly ended by the pre-T074 bug) are never restored. Fix: (a) remove the per-process `cwd` match — instead check if ANY `claude` process is running at all (`processes.some(p => p.name.toLowerCase().includes('claude'))`); (b) for each project directory matching a registered repo, if no `active` claude-code session exists for that repo: find the most recently ended claude-code session and call `updateSessionStatus(id, 'active', null)` to re-activate it, or create a new startup session if none exists. Import `getSessions` and `updateSessionStatus` from `../db/database.js`

### Addendum: Feature — Remove Repository

- [X] T076 Add cascade delete for sessions and session output when a repository is removed: update `deleteRepository` in `backend/src/db/database.ts` to first `DELETE FROM session_output WHERE session_id IN (SELECT id FROM sessions WHERE repository_id = ?)`, then `DELETE FROM sessions WHERE repository_id = ?`, then `DELETE FROM repositories WHERE id = ?`; this ensures no orphaned session or output records remain after a repo is removed
- [X] T077 Add Claude hook cleanup on repository removal: add a `removeHooksForRepo(repoPath: string)` method to `ClaudeCodeDetector` in `backend/src/services/claude-code-detector.ts` that reads `~/.claude/settings.json`, removes any hook entries whose `cwd` or script arguments reference the given repo path, and writes the file back; call this method from the `DELETE /api/v1/repositories/:id` handler in `backend/src/api/routes/repositories.ts` before calling `deleteRepository`
- [X] T078 Add "Remove" button to each repository card in `frontend/src/pages/DashboardPage.tsx`: render a small remove/trash icon button on the repo card header; clicking it shows a confirmation dialog ("Remove [repo name]? This will also delete all associated sessions."); on confirm, call the existing `removeRepository(id)` from `frontend/src/services/api.ts` (already implemented but never used), handle loading and error states, and close the dialog on success

### Addendum: Feature — Native OS Folder Picker

Replace the custom `FolderBrowser` web component (hard to navigate, poor UX) with a native OS folder selection dialog triggered via a backend endpoint.

- [X] T079 Add `POST /api/v1/fs/pick-folder` endpoint to `backend/src/api/routes/fs.ts`: spawn a platform-appropriate native folder picker dialog using `child_process.spawnSync` — on Windows use PowerShell `Add-Type -AssemblyName System.Windows.Forms; $d = New-Object System.Windows.Forms.FolderBrowserDialog; $d.ShowNewFolderButton = $true; if ($d.ShowDialog() -eq 'OK') { $d.SelectedPath }`, on macOS use `osascript -e 'POSIX path of (choose folder)'`, on Linux use `zenity --file-selection --directory`; wait for the subprocess to exit and return `{ path: string | null }` (null if user cancelled or dialog unavailable); if the platform command is not found, return `{ path: null, error: "not_supported" }` gracefully without throwing
- [X] T080 [P] Replace `FolderBrowser` component usage in `frontend/src/pages/DashboardPage.tsx` with a single "Browse…" button that calls `POST /api/v1/fs/pick-folder` via a new `pickFolder()` function in `frontend/src/services/api.ts`; on success, populate the path input with the returned path; on `null` result (user cancelled), do nothing; on error, show a small inline message "Folder picker not available — enter path manually"; remove all `showBrowser`, `showScanBrowser` state and `FolderBrowser` imports from `DashboardPage.tsx`; keep the manual text input as-is for fallback

### Addendum: Feature — Simplify Add Repository UX

Remove all modal complexity (tabs, scan folder, manual path input, FolderBrowser tree). "Add Repository" should directly invoke the native OS folder picker and register the selected path — zero intermediate UI.

- [ ] T081 Simplify "Add Repository" in `frontend/src/pages/DashboardPage.tsx`: clicking "Add Repository" calls `pickFolder()` directly (no modal); on a path being returned, immediately call `addRepository(path)` and invalidate queries; on cancel (null), do nothing; on error, show a brief inline toast/banner at the top of the dashboard; delete all modal state (`showAddModal`, `addTab`, `newRepoPath`, `adding`, `addError`, `pickingFolder`, `scanPath`, `scannedRepos`, `scanning`, `removeConfirmId` stays), all modal JSX, the `ScannedRepo` interface, `handleAddRepo`, `handleBrowse`, `handleBrowseForScan`, `handleScan`, `handleAddSelected`, `closeModal`; delete unused imports (`apiFetch`); also delete `frontend/src/components/FolderBrowser/FolderBrowser.tsx` and `frontend/src/components/FolderBrowser/index.ts` entirely since they are no longer used anywhere

### Addendum: Bug — model not detected for Claude Code sessions

- [X] T082 Fix `readNewJsonlLines` in `backend/src/services/claude-code-detector.ts`: the `updateModel` boolean parameter is `false` for all incremental file-change reads (chokidar `change` event calls `this.readNewJsonlLines(sessionId, jsonlPath, false)`), so model extraction is never attempted on new lines; if the initial load had no assistant entries yet (JSONL had only user messages or was empty at the time `watchJsonlFile` was called), the model stays `null` forever; fix by removing the `updateModel` parameter and instead computing `let needsModel = !(getSession(sessionId)?.model)` at the start of each call so model extraction runs whenever the session still lacks a model, and stop once found by setting `needsModel = false`; update both call sites to drop the boolean argument

### Addendum: Bug — Claude Code sessions not appearing as active on dashboard

- [ ] T083 Fix `handleHookPayload` in `backend/src/services/claude-code-detector.ts`: when a Claude Code hook fires (`SessionStart`, `PreToolUse`, `PostToolUse`, `Stop`), the method calls `upsertSession(session)` to write to the DB but emits **no WebSocket event**; `SessionMonitor.runScan()` only iterates `CopilotCliDetector.scan()` results so Claude Code sessions are never included in the broadcast loop; the frontend's TanStack Query cache is never invalidated so the dashboard never updates; fix by importing `broadcast` from `../api/ws/event-dispatcher.js` (already imported for model updates) and calling `broadcast({ type: isNew ? 'session.created' : 'session.updated', timestamp: now, data: session })` immediately after `upsertSession` in `handleHookPayload`, where `isNew = !existing`; similarly broadcast `session.updated` (or `session.created` for new startup sessions) from `scanExistingSessions` after each `upsertSession` call so reactivated sessions appear immediately on startup

**Checkpoint**: All acceptance criteria met. `npm test` passes. E2E suite green.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 completion — **BLOCKS all user stories**
- **Phase 3 (US1)**: Depends on Phase 2 — can start once foundational is complete
- **Phase 4 (US2)**: Depends on Phase 2 + T036 output store — builds on US1 session records
- **Phase 5 (US3)**: Depends on Phase 2 + US1 session detection (T025) — needs active sessions to control
- **Phase 6 (Polish)**: Depends on all desired user stories complete

### User Story Dependencies

| Story | Depends On | Notes |
|---|---|---|
| US1 (P1) | Phase 2 complete | Fully independent — delivers repo + session listing |
| US2 (P1) | Phase 2 + T025 (SessionMonitor) | Needs session records to display output for |
| US3 (P2) | Phase 2 + T025 (SessionMonitor) | Needs session records to control |

US2 and US3 can proceed in parallel once US1's SessionMonitor (T025) is complete.

### Within Each User Story

1. Tests written and **FAIL** verified before implementation begins
2. Models / services before route handlers
3. Route handlers before frontend pages
4. Core implementation before WebSocket integration
5. Story complete and checkpoint validated before moving on

### Parallel Opportunities

- All Phase 1 tasks after T001 can run in parallel
- T018–T021 (US1 tests) all run in parallel
- T022–T024 (US1 detectors) all run in parallel
- T030–T031 (US1 frontend) run in parallel
- T033–T035 (US2 tests) all run in parallel
- T041–T042 (US2 frontend) run in parallel
- T044–T046 (US3 tests) all run in parallel
- T053–T059 (Polish) mostly run in parallel

---

## Parallel Example: User Story 1

```bash
# Run all US1 tests in parallel:
Task T018: Contract tests for /api/repositories
Task T019: Contract test for GET /api/sessions
Task T020: Integration test for CopilotCliDetector
Task T021: Integration test for ClaudeCodeDetector

# Run all US1 detectors in parallel (after tests written):
Task T022: RepositoryScanner service
Task T023: CopilotCliDetector service
Task T024: ClaudeCodeDetector service
```

## Parallel Example: User Story 2

```bash
# Run all US2 tests in parallel:
Task T033: Contract tests for /api/sessions/:id and output
Task T034: Unit test for events.jsonl parser
Task T035: Integration test for OutputStore

# Run in parallel after tests:
Task T037: events.jsonl parser
Task T041: SessionPage frontend
Task T042: SessionDetail component
```

---

## Implementation Strategy

### MVP First (User Story 1 + 2 — full monitoring, no control)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (**CRITICAL**)
3. Complete Phase 3: User Story 1 → **STOP & VALIDATE**: repos and sessions appear on dashboard
4. Complete Phase 4: User Story 2 → **STOP & VALIDATE**: real-time output visible in detail view
5. Ship MVP: full read-only monitoring capability

### Full Feature (add control)

6. Complete Phase 5: User Story 3 → **STOP & VALIDATE**: stop session from dashboard
7. Complete Phase 6: Polish → run quickstart.md, confirm SC-001–SC-005

### Incremental Delivery

Each phase checkpoint delivers independently demonstrable value:
- After Phase 3: "I can see all my sessions at a glance"
- After Phase 4: "I can watch any session's output live"
- After Phase 5: "I can stop sessions without leaving the dashboard"

---

## Notes

- `[P]` tasks operate on different files — safe to parallelize
- `[Story]` label maps each task to its user story for traceability
- Constitution principle IV (Test-First): test tasks precede implementation in every story phase
- Commit after each completed checkpoint or logical group of tasks
- On Windows, use `taskkill /PID {pid} /T` for session stop; `process.kill` on macOS/Linux
- Claude Code `send-prompt` returns `501 Not Implemented` for `copilot-cli` sessions — UI must show "Not supported for Copilot CLI in v1"
- Hook injection modifies `~/.claude/settings.json` — must be idempotent (don't duplicate hooks on restart)
- All versioned REST routes use the `/api/v1/` prefix; `/api/health`, `/api/metrics`, `/api/docs`, and `/hooks/claude` are unversioned
- `frontend/src/services/socket.ts` is built incrementally across 3 phases: T016 (base) → T032 (US1 handlers) → T043 (US2 handlers). Each task MUST complete before the next begins.
- VS Code GitHub Copilot extension detection is **out of scope for v1**; `copilot-vscode` type is reserved in constitution but not implemented. Post-v1 work item.
