# Tasks: Fix Send Prompts (PTY Launcher)

**Feature**: 020-fix-send-prompts  
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

---

## Phase 1: Setup — Backend Foundation

**Goal**: Add node-pty, schema migration, PtyRegistry, and /launcher WebSocket route. The sendPrompt path is wired but prompts can be delivered.

**Independent test**: `sendPrompt()` on a PTY session with no launcher connected returns a `failed` ControlAction with a clear error message. `sendPrompt()` on a detected session also returns `failed` with a "use argus launch" message.

- [x] T001 [P1] [US2] Write unit tests for `PtyRegistry` — `backend/tests/pty-registry.test.ts`
- [x] T002 [P1] [US1] Create `backend/src/services/pty-registry.ts`
- [x] T003 [P1] [US1] Add `node-pty` to `backend/package.json` dependencies
- [x] T004 [P1] [US1] Add `SessionLaunchMode` type and `launchMode` field to `Session` interface in `backend/src/models/index.ts`
- [x] T005 [P1] [US1] Add DB migration for `launch_mode` column in `backend/src/db/database.ts`
- [x] T006 [P1] [US1] Update `upsertSession` in `backend/src/db/database.ts` to include `launch_mode`
- [x] T007 [P1] [US1] Update `getSession` / `getSessions` in `backend/src/db/database.ts` to map `launch_mode`
- [x] T008 [P1] [US2] Write unit tests for updated `SessionController.sendPrompt()` — `backend/tests/unit/session-controller.test.ts`
- [x] T009 [P1] [US1] Update `SessionController.sendPrompt()` in `backend/src/services/session-controller.ts`
- [x] T010 [P1] [US1] Write integration tests for `/launcher` WebSocket route — `backend/tests/launcher-ws.test.ts`
- [x] T011 [P1] [US1] Create `backend/src/api/routes/launcher.ts`
- [x] T012 [P1] [US1] Register launcher route in `backend/src/server.ts`
- [x] T013 [P] [P1] [US1] Update `launchMode` field in `frontend/src/types.ts`

---

## Phase 2: Launcher CLI

**Goal**: `argus launch <tool>` spawns the tool in a PTY, proxies terminal I/O, and connects to the Argus backend.

**Independent test**: Running `argus launch claude` in a terminal starts Claude Code normally. The Argus dashboard shows the session. Sending a prompt from the dashboard delivers it to Claude Code.

- [x] T014 [P2] [US1] Write unit tests for `ArgusLaunchClient` — `backend/tests/argus-launch-client.test.ts`
- [x] T015 [P2] [US1] Create `backend/src/cli/argus-launch-client.ts`
- [x] T016 [P2] [US1] Write unit tests for `resolveLaunchCommand()` — `backend/tests/launch-command-resolver.test.ts`
- [x] T017 [P2] [US1] Create `backend/src/cli/launch-command-resolver.ts`
- [x] T018 [P2] [US1] Create `backend/src/cli/launch.ts`
- [x] T019 [P2] [US1] Add `"launch": "tsx src/cli/launch.ts"` script to `backend/package.json`
- [ ] T020 [P] [P2] [US3] e2e test for Merge quick command on a PTY session (deferred — requires running Argus backend)

---

## Phase 3: Frontend

**Goal**: Session UI reflects whether prompt injection is available. Prompt bar is disabled with a clear message for read-only sessions.

**Independent test**: A detected (read-only) session shows a "read-only" indicator and the prompt bar input is disabled with a tooltip explaining how to enable it.

- [x] T021 [P] [P3] [US2] Write unit tests for `SessionCard` PTY badge — `frontend/src/__tests__/SessionCard.test.tsx`
- [x] T022 [P] [P3] [FR-009] Add `launchMode` badge to `frontend/src/components/SessionCard/SessionCard.tsx`
- [x] T023 [P3] [FR-009] Write unit tests for `SessionPromptBar` read-only state — `frontend/src/__tests__/SessionPromptBar.test.tsx`
- [x] T024 [P3] [FR-009] Update `SessionPromptBar` in `frontend/src/components/SessionPromptBar/SessionPromptBar.tsx`

---

## Phase 4: Polish

**Goal**: README updated, full test suite passes, frontend build succeeds.

- [x] T025 [P4] Update `README.md` with `argus launch` usage
- [x] T026 [P] [P4] Full backend test suite: 206 tests passed
- [x] T027 [P] [P4] Full frontend test suite and build: 139 tests passed, build successful
