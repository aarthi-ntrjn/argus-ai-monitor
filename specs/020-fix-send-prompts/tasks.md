# Tasks: Fix Send Prompts (PTY Launcher)

**Feature**: 020-fix-send-prompts  
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

---

## Phase 1: Setup — Backend Foundation

**Goal**: Add node-pty, schema migration, PtyRegistry, and /launcher WebSocket route. The sendPrompt path is wired but prompts can be delivered.

**Independent test**: `sendPrompt()` on a PTY session with no launcher connected returns a `failed` ControlAction with a clear error message. `sendPrompt()` on a detected session also returns `failed` with a "use argus launch" message.

- [ ] T001 [P1] [US2] Write unit tests for `PtyRegistry`: verify `register`, `write`, `unregister`, and `has` return correct values and that `write` to an unregistered session throws — `backend/tests/unit/pty-registry.test.ts`
- [ ] T002 [P1] [US1] Create `backend/src/services/pty-registry.ts`: singleton `Map<sessionId, WebSocket>` with `register(sessionId, ws)`, `unregister(sessionId)`, `write(sessionId, text): boolean`, `has(sessionId): boolean`
- [ ] T003 [P1] [US1] Add `node-pty` to `backend/package.json` dependencies
- [ ] T004 [P1] [US1] Add `SessionLaunchMode` type and `launchMode` field to `Session` interface in `backend/src/models/index.ts`
- [ ] T005 [P1] [US1] Add DB migration for `launch_mode` column in `backend/src/db/database.ts` (pattern: existing `ALTER TABLE` migrations at top of `initDb`)
- [ ] T006 [P1] [US1] Update `upsertSession` in `backend/src/db/database.ts` to include `launch_mode` in INSERT and UPDATE
- [ ] T007 [P1] [US1] Update `getSession` / `getSessions` in `backend/src/db/database.ts` to map `launch_mode` column to `launchMode` field
- [ ] T008 [P1] [US2] Write unit tests for updated `SessionController.sendPrompt()`: PTY session + launcher connected = `completed`; PTY session + no launcher = `failed`; detected session = `failed` with actionable message — `backend/tests/unit/session-controller.test.ts`
- [ ] T009 [P1] [US1] Update `SessionController.sendPrompt()` in `backend/src/services/session-controller.ts`: check `session.launchMode === 'pty'` and `PtyRegistry.has(sessionId)`; route via `PtyRegistry.write()` with 10s timeout; update ControlAction to `completed`/`failed` based on ack; detected sessions return `failed` with message "Prompt delivery requires starting this session via argus launch"
- [ ] T010 [P1] [US1] Write integration tests for `/launcher` WebSocket route: register message creates session; send_prompt routes to launcher; session_ended marks session ended; disconnect without session_ended also marks session ended — `backend/tests/integration/launcher-ws.test.ts`
- [ ] T011 [P1] [US1] Create `backend/src/api/routes/launcher.ts`: Fastify WebSocket plugin handling `register`, `prompt_delivered`, `prompt_failed`, `session_ended` messages; upserts session with `launchMode: 'pty'`; routes `send_prompt` from backend to launcher; on disconnect marks session ended
- [ ] T012 [P1] [US1] Register launcher route in `backend/src/server.ts`
- [ ] T013 [P] [P1] [US1] Update `launchMode` field in `frontend/src/types.ts` Session interface to include `launchMode: 'pty' | 'detected' | null`

---

## Phase 2: Launcher CLI

**Goal**: `argus launch <tool>` spawns the tool in a PTY, proxies terminal I/O, and connects to the Argus backend.

**Independent test**: Running `argus launch claude` in a terminal starts Claude Code normally. The Argus dashboard shows the session. Sending a prompt from the dashboard delivers it to Claude Code.

- [ ] T014 [P2] [US1] Write unit tests for `ArgusLaunchClient`: verify register message is sent on connect, send_prompt message triggers PTY write, session_ended is sent on process exit — `backend/tests/unit/argus-launch-client.test.ts`
- [ ] T015 [P2] [US1] Create `backend/src/cli/argus-launch-client.ts`: WebSocket client class that connects to `/launcher`, sends `register`, handles `send_prompt` by calling a callback, sends `prompt_delivered`/`prompt_failed` acks
- [ ] T016 [P2] [US1] Write unit tests for `resolveLaunchCommand()`: `"claude"` → `{ sessionType: 'claude-code', cmd: 'claude', args: [] }`; `"gh copilot suggest"` → `{ sessionType: 'copilot-cli', cmd: 'gh', args: ['copilot', 'suggest'] }` — `backend/tests/unit/launch-command-resolver.test.ts`
- [ ] T017 [P2] [US1] Create `backend/src/cli/launch-command-resolver.ts`: maps launch args to `{ sessionType, cmd, args }`; recognises `claude` → `claude-code`, `gh copilot` → `copilot-cli`; fallback to `'claude-code'` for unknown tools
- [ ] T018 [P2] [US1] Create `backend/src/cli/launch.ts`: main entrypoint — parses `process.argv`, calls `resolveLaunchCommand`, spawns PTY via `node-pty` with `cols: process.stdout.columns`, `rows: process.stdout.rows`, pipes PTY output to `process.stdout`, pipes `process.stdin` to PTY, connects `ArgusLaunchClient`, handles PTY exit by sending `session_ended` and calling `process.exit`
- [ ] T019 [P2] [US1] Add `"launch": "tsx src/cli/launch.ts"` script to `backend/package.json`
- [ ] T020 [P] [P2] [US3] Write e2e test for Merge quick command: send "merge current branch with main" via prompt bar on a PTY session, verify ControlAction status is `completed` — `frontend/src/__tests__/e2e/pty-send-prompt.test.ts` (mock backend)

---

## Phase 3: Frontend

**Goal**: Session UI reflects whether prompt injection is available. Prompt bar is disabled with a clear message for read-only sessions.

**Independent test**: A detected (read-only) session shows a "read-only" indicator and the prompt bar input is disabled with a tooltip explaining how to enable it.

- [ ] T021 [P] [P3] [US2] Write unit tests for `SessionCard` PTY badge: `launchMode: 'pty'` renders "prompt-capable" indicator; `launchMode: 'detected'` or null renders "read-only" indicator — `frontend/src/__tests__/SessionCard.test.tsx`
- [ ] T022 [P] [P3] [FR-009] Add `launchMode` badge to `frontend/src/components/SessionCard/SessionCard.tsx`: green "live" badge when `launchMode === 'pty'`, grey "read-only" badge otherwise
- [ ] T023 [P3] [FR-009] Write unit tests for `SessionPromptBar` read-only state: when `session.launchMode !== 'pty'`, input is disabled and tooltip shows "Start with argus launch to enable prompts" — `frontend/src/__tests__/SessionPromptBar.test.tsx`
- [ ] T024 [P3] [FR-009] Update `SessionPromptBar` in `frontend/src/components/SessionPromptBar/SessionPromptBar.tsx`: disable input and enter button when `session.launchMode !== 'pty'`; show tooltip on hover explaining how to enable

---

## Phase 4: Polish

**Goal**: README updated, full test suite passes, frontend build succeeds.

- [ ] T025 [P4] Update `README.md` with `argus launch` usage: install, how to start a session with `npm run launch -- claude`, what PTY mode enables
- [ ] T026 [P] [P4] Run full backend test suite: `npm test --workspace=backend`
- [ ] T027 [P] [P4] Run full frontend test suite and build: `npm test --workspace=frontend && npm run build --workspace=frontend`
