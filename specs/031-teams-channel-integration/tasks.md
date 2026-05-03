# Tasks: Microsoft Teams Channel Integration (Graph API)

**Branch**: `031-teams-channel-integration` | **Revised**: 2026-04-14
**Input**: Revised design documents — Graph API + Device Code Flow approach.
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓

---

## Phase 1: Setup

**Purpose**: Install the single new runtime dependency for MSAL Device Code Flow.

- [ ] T001 Install `@azure/msal-node` in backend workspace: `npm install @azure/msal-node --workspace=backend`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure shared by all user stories — types, DB, config, Graph client, MSAL, message buffer.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T002 Update `backend/src/db/migrations/003-teams-threads.sql`: add `delta_link TEXT` column to the `teams_threads` table definition per data-model.md
- [ ] T003 Update `backend/src/db/database.ts`: (a) add runtime migration `ALTER TABLE teams_threads ADD COLUMN delta_link TEXT` if column is absent; update `upsertTeamsThread` to include `deltaLink`; add `updateTeamsThreadDeltaLink(sessionId, deltaLink)` helper; add `updateTeamsThreadOutputMessageId(sessionId, messageId)` helper if not already present; (b) add runtime migration `ALTER TABLE control_actions ADD COLUMN source TEXT` if column is absent; update `insertControlAction` to accept optional `source?: string` parameter (FR-013: Teams commands must be audit-logged with source="Teams")
- [ ] T004 [P] Update `TeamsConfig` and `TeamsThread` interfaces in `backend/src/models/index.ts` to match data-model.md: `TeamsConfig` uses `clientId`, `tenantId`, `teamId`, `channelId`, `ownerUserId`, `refreshToken`; `TeamsThread` adds `deltaLink: string | null`; also add `source: string | null` field to `ControlAction` interface (required by FR-013)
- [ ] T005 [P] Rewrite `backend/src/config/teams-config-loader.ts`: `loadTeamsConfig()` / `saveTeamsConfig(config)` / `maskTeamsConfig(config)` — mask `refreshToken` as `"***"` (not botAppPassword); remove Bot Framework fields
- [ ] T006 [P] Keep `backend/src/services/teams-message-buffer.ts` as-is (no changes needed — buffer logic is approach-agnostic)
- [ ] T007 Create `backend/src/services/teams-graph-client.ts`: wraps Microsoft Graph API via native `fetch`; accepts an `accessToken` string on each call (caller obtains token via T008); methods: `createThreadPost(teamId, channelId, text): Promise<{ messageId }>`, `postReply(teamId, channelId, threadId, text): Promise<{ messageId }>`, `updateReply(teamId, channelId, threadId, replyId, text): Promise<void>`, `pollReplies(teamId, channelId, threadId, deltaLink?): Promise<{ replies: GraphReply[], nextDeltaLink: string }>`, `getMe(accessToken): Promise<{ id, displayName }>`; throw `TeamsGraphError` (structured: code, message, statusCode) on non-2xx
- [ ] T008 Create `backend/src/services/teams-msal-service.ts`: wraps `@azure/msal-node`; methods: `initiateDeviceCodeFlow(clientId, tenantId): Promise<DeviceCodeInfo>`, `pollDeviceCodeFlow(clientId, tenantId): Promise<DeviceCodeResult>` where result is `{ status: "pending"|"completed"|"expired", accessToken?, refreshToken?, ownerUserId?, displayName? }`; `getAccessToken(config: TeamsConfig): Promise<string>` using stored refreshToken via `acquireTokenByRefreshToken`; on token refresh failure throw `TeamsAuthError`
- [ ] T009 Verify `backend/src/services/output-store.ts` singleton and listener API are present (already implemented in prior iteration — confirm `outputStore` export, `addOutputListener`, `removeOutputListener` exist; no changes needed)

**Checkpoint**: Foundation complete — DB migrated, types updated, config loader rewritten, Graph client and MSAL service implemented.

---

## Phase 3: US1 — Monitor Session Output in Teams

**Goal**: When a session starts, create a Teams thread via Graph API and stream output into it.

**Independent Test**: Configure integration (mock Graph API), start session, verify `createThreadPost` called, output flushed to `postReply`/`updateReply`.

### Tests (write first — must fail before implementation)

- [ ] T010 [P] Create `backend/tests/unit/teams-graph-client.test.ts`: mock native `fetch`; test `createThreadPost` sends correct Graph URL and body; test `postReply` sends to replies endpoint; test `updateReply` sends PATCH; test `pollReplies` uses deltaLink and returns replies + nextDeltaLink; test non-2xx throws `TeamsGraphError`
- [ ] T011 [P] Create `backend/tests/unit/teams-msal-service.test.ts`: mock `@azure/msal-node` PublicClientApplication; test `initiateDeviceCodeFlow` returns userCode/verificationUrl/expiresIn; test `pollDeviceCodeFlow` returns `{ status: "pending" }` while waiting; test `pollDeviceCodeFlow` returns `{ status: "completed", accessToken, ownerUserId }` on success; test `getAccessToken` calls acquireTokenByRefreshToken
- [ ] T012 [P] Verify/update `backend/tests/unit/teams-message-buffer.test.ts`: confirm existing tests pass with current implementation (no changes expected)

### Implementation

- [ ] T013 Rewrite `backend/src/services/teams-integration.ts`: replace `TeamsApiClient` with `TeamsGraphClient` + `TeamsMsalService`; on session start, call `getTeamsThread(sessionId)` first — if a thread already exists (reconnect after restart), reuse it without calling `createThreadPost` again (FR-012); otherwise call `graphClient.createThreadPost` using token from `msalService.getAccessToken(config)`; update `_flush` to call `graphClient.postReply` or `graphClient.updateReply`; update `onSessionEnded` to call `graphClient.postReply` with session-end message; remove all `botAppId`/`botAppPassword`/`serviceUrl` references
- [ ] T014 Wire updated `TeamsIntegrationService` in `backend/src/server.ts`: update constructor arguments to pass `TeamsGraphClient` and `TeamsMsalService` instances; remove `TeamsApiClient` instantiation; keep session lifecycle event wiring and outputStore listener unchanged
- [ ] T015 [P] Create `backend/tests/integration/teams-session-lifecycle.test.ts`: mock `TeamsGraphClient` and `TeamsMsalService`; simulate session created → output → flush → session ended; assert `createThreadPost` called once; assert `postReply`/`updateReply` called; assert reconnect reuses existing thread (no second `createThreadPost`)

---

## Phase 4: US2 — Send Commands from Teams via Delta Polling

**Goal**: Poll Teams thread replies every 10s, route owner replies as ControlActions, reject non-owner replies.

**Independent Test**: Start polling service with mock graph client returning a reply; assert ControlAction created for owner reply; assert notice posted for non-owner reply.

### Tests (write first — must fail before implementation)

- [ ] T020 [P] Create `backend/tests/unit/teams-polling-service.test.ts`: mock `TeamsGraphClient` and `TeamsMsalService`; test poll cycle processes owner reply → inserts ControlAction; test poll cycle processes non-owner reply → calls `postReply` with notice; test poll cycle skips ended sessions; test deltaLink is stored after each poll; test polling skips sessions with no TeamsThread; test error in poll cycle is caught + logged without crashing

### Implementation

- [ ] T021 Create `backend/src/services/teams-polling-service.ts`: `start()` launches a `setInterval` at 10s; each tick: load config, get all sessions with status in `['active', 'idle', 'running']`, for each session with a TeamsThread call `graphClient.pollReplies(teamId, channelId, threadId, deltaLink)`; for each reply: if `from.user.id === config.ownerUserId` and session active → `insertControlAction(sessionId, 'send_prompt', payload, source: 'Teams')` (FR-013); if non-owner → `graphClient.postReply(...)` with notice; if session ended → `graphClient.postReply(...)` with ended notice; always update `deltaLink` via `updateTeamsThreadDeltaLink`; `stop()` clears the interval
- [ ] T022 [P] Delete `backend/src/api/routes/teams-webhook.ts` and remove its registration from `backend/src/server.ts` (Bot Framework webhook no longer used)
- [ ] T023 Wire `TeamsPollingService` in `backend/src/server.ts`: instantiate after `TeamsIntegrationService`; call `pollingService.start()`; call `pollingService.stop()` in SIGTERM/SIGINT handlers

---

## Phase 5: US3 — Configure Teams Integration in Settings UI

**Goal**: User enters clientId + tenantId, clicks Authenticate, completes Device Code Flow, saves — status shows "Connected".

**Independent Test**: POST `/auth/device-code`, assert userCode returned; POST `/auth/poll`, assert completed status; GET settings, assert `connectionStatus: "connected"`.

### Tests (write first — must fail before implementation)

- [ ] T030 [P] Create `backend/tests/contract/teams-settings.test.ts`: test all 14 cases from contracts/teams-settings-api.md; mock `TeamsMsalService` to avoid real MSAL calls
- [ ] T031 [P] Create `frontend/src/__tests__/TeamsSettingsSection.test.tsx`: render component; assert clientId/tenantId/teamId/channelId fields render; assert "Authenticate" button visible when no refreshToken; assert Device Code Flow step shown (userCode + verificationUrl) after clicking Authenticate; assert "Connected" badge after poll completes; assert error shown on poll failure

### Implementation

- [ ] T032 Create `backend/src/api/routes/teams-auth.ts`: Fastify plugin for `POST /api/v1/settings/teams/auth/device-code` and `POST /api/v1/settings/teams/auth/poll`; uses `TeamsMsalService`; on device-code completion (`pollDeviceCodeFlow` returns `status: "completed"` with `accessToken`): call `graphClient.getMe(accessToken)` to retrieve ownerUserId and displayName; save `ownerUserId` + `refreshToken` to config; return ownerUserId + displayName
- [ ] T033 Rewrite `backend/src/api/routes/teams-settings.ts`: remove Bot Framework fields; use new `TeamsConfig` shape; required fields when enabling: `clientId`, `tenantId`, `teamId`, `channelId`, `refreshToken`; validate by calling `msalService.getAccessToken(config)` on save; clear refreshToken when clientId or tenantId changes
- [ ] T034 Register `teams-auth.ts` in `backend/src/server.ts` alongside updated `teams-settings.ts`; remove `teams-webhook.ts` registration if not already removed in T022
- [ ] T035 [P] Update `frontend/src/services/api.ts`: replace Bot Framework `TeamsSettings` interface with Graph API interface (`clientId`, `tenantId`, `teamId`, `channelId`, `ownerUserId`, `refreshToken`); add `initiateDeviceCodeFlow(clientId, tenantId)`, `pollDeviceCodeFlow(clientId, tenantId)` API helpers
- [ ] T036 [P] Rewrite `frontend/src/hooks/useTeamsSettings.ts`: add Device Code Flow state machine (`idle` → `device-code-pending` → `authenticated`); expose `startAuth(clientId, tenantId)`, `pollAuth()` alongside existing `save()`
- [ ] T037 Rewrite `frontend/src/components/SettingsPanel/TeamsSettingsSection.tsx` (or equivalent Teams section in SettingsPanel): show clientId/tenantId/teamId/channelId fields; show "Authenticate with Microsoft" button when not authenticated; on click, call `startAuth` then display userCode + verificationUrl step; auto-poll every 5s via `pollAuth()`; on authenticated show ownerUserId as "Authenticated as: [displayName]"; show connection status badge; use shared `Button` component variants
- [ ] T038 Update `backend/src/api/routes/health.ts`: update Teams status section to check `config.refreshToken` existence (not `botAppId`) for `teams.enabled` / `teams.authenticated` fields

---

## Phase 6: US4 — Session Thread Headers

**Goal**: Opening and closing thread messages include full session metadata.

### Tests (write first — must fail before implementation)

- [ ] T040 Add tests to `backend/tests/unit/teams-integration.test.ts`: assert `_formatOpeningMessage` includes session ID, type, startedAt, ownerUserId; assert `onSessionEnded` posts reply containing session status and endedAt

### Implementation

- [ ] T041 Update `_formatOpeningMessage` in `backend/src/services/teams-integration.ts`: ensure HTML format (`<b>Argus Session Started</b><br>...`) includes session ID, type, startedAt, ownerUserId; matches contract in contracts/teams-webhook-api.md (Graph API contract)
- [ ] T042 Update `onSessionEnded` message format to include session type, ID, final status, and endedAt timestamp

---

## Phase 7: Polish

- [ ] T050 Update `README.md`: replace Bot Framework setup instructions with Graph API setup: (1) register Azure AD app at portal.azure.com with delegated scopes `ChannelMessage.Send ChannelMessage.Read.All User.Read`; (2) find your Teams team ID and channel ID; (3) open Argus Settings > Teams, enter clientId/tenantId/teamId/channelId, click Authenticate; (4) no ngrok or public endpoint needed
- [ ] T051 [P] Run full backend test suite: `npm run test --workspace=backend` — all tests must pass
- [ ] T052 [P] Run frontend build: `npm run build --workspace=frontend` — must succeed with no errors
- [ ] T053 [P] Run backend build: `npm run build --workspace=backend` — must succeed with no type errors

