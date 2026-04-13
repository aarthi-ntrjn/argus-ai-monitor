# Tasks: Microsoft Teams Channel Integration

**Input**: Design documents from `/specs/031-teams-channel-integration/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add the one new runtime dependency required for Bot Framework JWT validation.

- [ ] T001 Install `jose` npm package in backend workspace for Bot Framework JWT token validation (`npm install jose --workspace=backend`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure shared by all user stories — types, DB schema, config loader, Teams API client, message buffer.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T002 Create DB migration `backend/src/db/migrations/003-teams-threads.sql` with the `teams_threads` table and `idx_teams_threads_session` index per data-model.md
- [ ] T003 Apply migration in `backend/src/db/database.ts`: import and execute `003-teams-threads.sql` in the migrations runner; add `upsertTeamsThread`, `getTeamsThread`, `getTeamsThreadByTeamsId` helper functions
- [ ] T004 [P] Add `TeamsConfig` and `TeamsThread` TypeScript interfaces to `backend/src/models/index.ts` per data-model.md
- [ ] T005 [P] Create `backend/src/config/teams-config-loader.ts`: `loadTeamsConfig()` reads `~/.argus/teams-config.json` (defaults to `{ enabled: false }`), `saveTeamsConfig(config)` writes it; masks `botAppPassword` in log output
- [ ] T006 Create `backend/src/services/teams-message-buffer.ts`: in-memory per-session circular buffer, max 1000 entries, FIFO eviction with pino log warning when cap is reached; `enqueue(sessionId, text)`, `flush(sessionId): string[]`, `clear(sessionId)`, `size(sessionId): number`
- [ ] T007 Create `backend/src/services/teams-api-client.ts`: wraps Bot Framework REST API via native `fetch`; methods: `getToken(): Promise<string>` (OAuth2 client credentials to login.microsoftonline.com), `createThread(config, text): Promise<{ threadId, messageId }>`, `updateMessage(config, threadId, messageId, text): Promise<void>`, `postReply(config, threadId, text): Promise<{ messageId }>` — all methods accept `TeamsConfig`; on network failure throw `TeamsApiError` with structured fields
- [ ] T008 [A-001 fix] Extend `backend/src/services/output-store.ts` to support internal output listeners: add `addOutputListener(listener: (sessionId: string, outputs: SessionOutput[]) => void)` and `removeOutputListener(listener)` methods; call all registered listeners inside `insertOutput` after the DB write and before the WS broadcast; export a singleton `outputStore` instance from `output-store.ts`

**Checkpoint**: Foundation ready — DB migrated, types defined, config loader working, API client and buffer implemented.

---

## Phase 3: User Story 1 — Monitor Session Output in Teams (Priority: P1) 🎯 MVP

**Goal**: When a CLI session starts in Argus and Teams integration is enabled, automatically create a Teams thread and stream all session output into it as a rolling updated message.

**Independent Test**: Configure Teams credentials in `~/.argus/teams-config.json`, start a session, verify a thread appears in Teams with real-time output.

### Tests for User Story 1

> **Write these tests FIRST and confirm they FAIL before implementing T013–T018**

- [ ] T010 [P] [US1] Unit tests for `TeamsIntegrationService` in `backend/tests/unit/teams-integration.test.ts`: test `onSessionCreated` creates a thread via mocked `TeamsApiClient`; test `onSessionOutput` enqueues to buffer and flushes on schedule; test `onSessionEnded` posts final status update; test no-op when `enabled: false`
- [ ] T011 [P] [US1] Unit tests for `TeamsMessageBuffer` in `backend/tests/unit/teams-message-buffer.test.ts`: test enqueue/flush order, cap eviction at 1000, dropped-count increment, clear

### Implementation for User Story 1

- [ ] T013 [US1] Create `backend/src/services/teams-integration.ts` — `TeamsIntegrationService` class: constructor accepts `TeamsApiClient` and `TeamsMessageBuffer`; `onSessionCreated(session)`, `onSessionOutput(sessionId, content)`, `onSessionEnded(session)` methods; periodic flush timer (every 3 s or 500 ms after last output); uses `upsertTeamsThread` to persist thread mapping; reads `loadTeamsConfig()` on each call (hot-reloadable)
- [ ] T014 [US1] In `TeamsIntegrationService.onSessionCreated`: first check if a `TeamsThread` record already exists for the session ID (for FR-012 reconnect after restart — reuse existing thread, do not create a new one); if no existing thread, call `TeamsApiClient.createThread` with opening message containing session metadata (name, owner identity `ownerTeamsUserId`, start time per FR-011); persist `TeamsThread` record via `upsertTeamsThread`; log structured event `teams.thread.created` or `teams.thread.reused`
- [ ] T015 [US1] In `TeamsIntegrationService.onSessionOutput`: enqueue content to `TeamsMessageBuffer`; on flush call `TeamsApiClient.updateMessage` if `currentOutputMessageId` exists, else `postReply` to create first output message and store ID; on Teams API failure enqueue to buffer and schedule retry; emit pino warning when buffer cap reached
- [ ] T016 [US1] In `TeamsIntegrationService.onSessionEnded`: flush remaining buffer; call `TeamsApiClient.postReply` with final status message (completed/failed/killed per FR-005); log `teams.session.ended`
- [ ] T017 [US1] Wire `TeamsIntegrationService` into `backend/src/server.ts`: instantiate after `SessionMonitor`; subscribe to `monitor.on('session.created')` and `monitor.on('session.ended')`; register an output listener via `outputStore.addOutputListener()` to receive `SessionOutput[]` batches for streaming (A-001 fix: use T008's listener API, not `session.updated`)
- [ ] T018 [US1] Integration test `backend/tests/integration/teams-session-lifecycle.test.ts`: mock `TeamsApiClient`; simulate session created → outputs → ended lifecycle; assert thread created, messages buffered and flushed, final status posted

**Checkpoint**: User Story 1 fully functional — sessions stream to Teams threads.

---

## Phase 4: User Story 2 — Send Commands to a Session from Teams (Priority: P1)

**Goal**: The session owner can reply to a Teams thread to send a free-text command to the active CLI session. Non-owners receive a notice and are ignored.

**Independent Test**: Reply to a session thread in Teams as the owner; verify a `send_prompt` ControlAction is created for the session and response appears in thread.

### Tests for User Story 2

> **Write these tests FIRST and confirm they FAIL before implementing T022–T028**

- [ ] T020 [P] [US2] Contract tests for `POST /api/botframework/messages` in `backend/tests/contract/teams-webhook.test.ts`: valid owner message → 200 + ControlAction created; non-owner message → 200 + no ControlAction + notice reply; ended-session message → 200 + no ControlAction + notice reply; invalid JWT → 401; missing `from` field → 400; unknown thread → 200 no-op; non-message activity type → 200 no-op
- [ ] T021 [P] [US2] Unit test for Bot Framework JWT validation in `backend/tests/unit/teams-webhook.test.ts`: valid token passes; expired token rejected; wrong audience rejected; missing header rejected

### Implementation for User Story 2

- [ ] T022 [US2] Create `backend/src/api/routes/teams-webhook.ts` Fastify plugin skeleton: register `POST /api/botframework/messages`; parse body as `BotFrameworkActivity`; return 200 `{}` for all valid processed cases per contract
- [ ] T023 [US2] Implement Bot Framework JWT validation in `teams-webhook.ts`: use `jose` to fetch Microsoft JWKS (`https://login.botframework.com/v1/.well-known/openidconfiguration`), validate `Authorization: Bearer <token>` JWT on every request; reject with 401 on failure (§VI, D-007)
- [ ] T024 [US2] Implement activity routing in `teams-webhook.ts`: ignore non-`message` types; look up `TeamsThread` by `conversation.id`; compare `activity.from.id` to `ownerTeamsUserId` from config; branch to owner-command or non-owner-notice path
- [ ] T025 [US2] Owner path: call existing `createControlAction` (or equivalent DB helper) to insert `ControlAction` of type `send_prompt` with `payload: { text: activity.text }` for the session; log `teams.command.received` with source `"Teams"`; this satisfies FR-003 and FR-013
- [ ] T026 [US2] Non-owner path: call `TeamsApiClient.postReply` with human-readable notice ("Only the session owner can send commands to this session."); log `teams.command.rejected` with `from.id`
- [ ] T027 [US2] Ended-session path: call `TeamsApiClient.postReply` with notice ("This session has ended and is no longer accepting commands.")
- [ ] T028 [US2] Register `teams-webhook` route plugin in `backend/src/server.ts`

**Checkpoint**: User Stories 1 and 2 fully functional — bidirectional Teams integration working end-to-end.

---

## Phase 5: User Story 3 — Configure Teams Integration in Argus Settings (Priority: P2)

**Goal**: An Argus administrator can configure and validate the Teams bot credentials and channel details via the Argus settings UI and see a live connection status indicator.

**Independent Test**: Open Argus settings, fill in Teams fields, save, see "Connected" status.

### Tests for User Story 3

> **Write these tests FIRST and confirm they FAIL before implementing T032–T038**

- [ ] T030 [P] [US3] Contract tests for `GET /api/v1/settings/teams` and `PATCH /api/v1/settings/teams` in `backend/tests/contract/teams-settings.test.ts`: all scenarios from `contracts/teams-settings-api.md`; verify password masking; verify `connectionStatus` field
- [ ] T031 [P] [US3] Frontend component tests in `frontend/src/__tests__/SettingsPanel.teams.test.tsx`: Teams section renders when no config; form fields bind correctly; save calls PATCH; connection status displays "Connected"/"Error"; disable button clears status

### Implementation for User Story 3

- [ ] T032 [US3] Create `backend/src/api/routes/teams-settings.ts` Fastify plugin: `GET /api/v1/settings/teams` returns config with masked password and `connectionStatus`; `PATCH /api/v1/settings/teams` merges patch, validates required fields when enabling, probes Teams API (attempt token acquisition), saves config, returns result per contract
- [ ] T033 [US3] Register `teams-settings` route plugin in `backend/src/server.ts`
- [ ] T034 [P] [US3] Add Teams API helpers to `frontend/src/services/api.ts`: `getTeamsSettings()`, `patchTeamsSettings(patch)`
- [ ] T035 [US3] Create `frontend/src/hooks/useTeamsSettings.ts`: wraps `getTeamsSettings`/`patchTeamsSettings` with loading/error state; returns `{ config, status, save, isSaving, error }`
- [ ] T036 [US3] Add Teams integration section to `frontend/src/components/SettingsPanel/SettingsPanel.tsx`: fields for Bot App ID, Bot App Password, Channel ID, Service URL, Tenant ID, Owner Teams User ID; Save button using shared `Button` component; connection status badge using shared `Badge` component; disable/enable toggle; human-readable validation error messages per §XII
- [ ] T037 [US3] Add `connectionStatus` field to `GET /api/v1/health` response: include `teams: { enabled, status }` object so monitoring tools can observe Teams integration health (§VII)

**Checkpoint**: Settings UI working — Teams integration fully configurable from the browser.

---

## Phase 6: User Story 4 — View All Sessions via Teams (Priority: P3)

**Goal**: Each session thread has a clear header showing session name, owner identity, start time, and final status so team members can browse sessions from Teams without opening Argus.

**Independent Test**: Start multiple sessions; verify each thread header shows session name, `ownerTeamsUserId`, start time; verify ended thread shows final status.

### Tests for User Story 4

> **Write these tests FIRST and confirm they FAIL before implementing T041–T042**

- [ ] T040 [P] [US4] Unit test in `backend/tests/unit/teams-integration.test.ts`: assert opening message contains session ID, type, start time, ownerTeamsUserId; assert ended message contains final status string

### Implementation for User Story 4

- [ ] T041 [US4] Update `TeamsIntegrationService.onSessionCreated` opening message template: include session type (claude-code/copilot-cli), session ID (truncated), start time (ISO 8601), and owner Teams user ID label; format as readable plain-text block
- [ ] T042 [US4] Update `TeamsIntegrationService.onSessionEnded` status message: include session type, session ID, end time, and status (completed/failed/killed) in a consistent format

**Checkpoint**: All four user stories delivered.

---

## Phase 7: Polish and Cross-Cutting Concerns

**Purpose**: Documentation, final test run, build validation, README update per §XI.

- [ ] T050 Update `README.md`: add "Microsoft Teams Integration" section with step-by-step setup instructions (Azure Bot registration, bot channel setup, ngrok for localhost, required config fields, how to find Teams user ID); link to contracts for API reference
- [ ] T051 [P] Run full backend test suite and confirm no regressions: `npm run test --workspace=backend`
- [ ] T052 [P] Run frontend build and confirm no regressions: `npm run build --workspace=frontend`
- [ ] T053 [P] Run backend build: `npm run build --workspace=backend`

---

## Dependencies and Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — BLOCKS all user stories
- **Phase 3 (US1)**: Depends on Phase 2 — tests first, then implementation
- **Phase 4 (US2)**: Depends on Phase 2 — tests first, then implementation; can run in parallel with Phase 3
- **Phase 5 (US3)**: Depends on Phase 2 — tests first, then implementation; can run after Phase 2
- **Phase 6 (US4)**: Depends on Phase 3 (extends T013/T014/T016) — must run after Phase 3
- **Phase 7 (Polish)**: Depends on all prior phases complete

### Parallel Opportunities

- T010, T011 (US1 tests) can run in parallel before T013
- T020, T021 (US2 tests) can run in parallel before T022
- T030, T031 (US3 tests) can run in parallel before T032
- T004, T005 (types, config loader) can run in parallel in Phase 2
- T034 (frontend API helpers) can run in parallel with T032 (backend route)
- T051, T052, T053 (final checks) can run in parallel
