# Tasks: Slack Event Notifications

**Input**: Design documents from `specs/037-slack-event-notifications/`
**Prerequisites**: plan.md, spec.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to
- All paths are relative to the repository root

---

## Phase 1: Setup

**Purpose**: Install dependencies and document environment variables.

- [x] T001 Add `@slack/web-api` and `@slack/socket-mode` to `backend/package.json` dependencies and run `npm install --workspace=backend`
- [x] T00X [P] Add `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN`, and `SLACK_CHANNEL_ID` entries (with comments) to `.env.example`

---

## Phase 2: Foundation (Blocking Prerequisites)

**Purpose**: Core types, config loading, and service skeleton that all user story phases depend on.

**CRITICAL**: No user story work can begin until this phase is complete.

- [x] T00X Add `SlackConfig` interface (botToken, appToken, channelId, enabled, enabledEventTypes) and `SlackEventType` string enum to `backend/src/models/index.ts`
- [x] T00X [P] Create `backend/src/constants/slack-events.ts` exporting named string constants for all `SessionMonitor` event names: `SESSION_CREATED = 'session.created'`, `SESSION_UPDATED = 'session.updated'`, `SESSION_ENDED = 'session.ended'`, `REPOSITORY_ADDED = 'repository.added'`, `REPOSITORY_REMOVED = 'repository.removed'`
- [x] T00X [P] Extend `backend/src/config/config-loader.ts` to read a `slack` config section from `~/.argus/config.json` and override with `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN`, `SLACK_CHANNEL_ID` environment variables; expose a typed `getSlackConfig(): SlackConfig` accessor
- [x] T00X Create `backend/src/services/slack-notifier.ts` with `SlackNotifier` class: constructor accepts `SlackConfig`, `initialize()` validates config and logs a warning then becomes a no-op if `botToken` or `channelId` is missing, `shutdown()` drains the send queue, and stub methods `postSessionStart()`, `postSessionEnd()`, `postEvent()`, `reconfigure()` that throw `NotImplementedError` until implemented
- [x] T00X Wire `SlackNotifier` into `backend/src/server.ts`: instantiate after `SessionMonitor` is created, call `initialize()` during server startup, call `shutdown()` during graceful shutdown

**Checkpoint**: Server starts and shuts down cleanly; `[SlackNotifier] Slack integration disabled` warning appears in logs when tokens are absent.

---

## Phase 3: User Story 1 — Session Lifecycle Notifications (Priority: P1) MVP

**Goal**: Slack receives a parent message when a session starts and a thread reply when it ends.

**Independent Test**: Start an AI session, verify a Slack message appears in the configured channel within 5 seconds containing session ID, model, and start time. End the session, verify a thread reply appears with duration and final status.

- [x] T00X [US1] Implement `postSessionStart(session: Session): Promise<void>` in `backend/src/services/slack-notifier.ts`: call `WebClient.chat.postMessage` with a Block Kit message containing session ID, model name, and ISO start time; store the returned `ts` in `Map<sessionId, string>`; wrap in try/catch and log failure with session ID on error
- [x] T00X [US1] Implement `postSessionEnd(session: Session): Promise<void>` in `backend/src/services/slack-notifier.ts`: look up stored `thread_ts` for the session, call `chat.postMessage` with `thread_ts` set, include formatted duration and final status; if no thread anchor found (server restarted mid-session), post as a new top-level message
- [x] T0XX [US1] Subscribe `SlackNotifier` to `session.created` and `session.ended` events from `SessionMonitor` inside `SlackNotifier.initialize()` in `backend/src/services/slack-notifier.ts`: use `sessionMonitor.on(SESSION_CREATED, async (s) => this.postSessionStart(s))` and `sessionMonitor.on(SESSION_ENDED, async (s) => this.postSessionEnd(s))`
- [x] T0XX [US1] Accept `sessionMonitor: SessionMonitor` as a constructor parameter in `SlackNotifier` in `backend/src/services/slack-notifier.ts` and update the wiring in `backend/src/server.ts` to pass the existing `SessionMonitor` instance

**Checkpoint**: US1 fully functional. Session lifecycle appears in Slack as threaded messages.

---

## Phase 4: User Story 2 — All-Event Notifications (Priority: P2)

**Goal**: Every event Argus tracks during a session posts a thread reply. Events can be filtered per type. Rate limits are respected.

**Independent Test**: Trigger a `session.updated` event; verify a thread reply appears in the session's Slack thread with the event type and metadata. Disable `session.updated` in config; verify no message is sent for subsequent updates.

- [x] T0XX [US2] Implement `postEvent(sessionId: string, eventType: string, payload: object): Promise<void>` in `backend/src/services/slack-notifier.ts`: check `enabledEventTypes` config (if list is set, skip events not in it), look up `thread_ts`, call `chat.postMessage` as thread reply with event type label and formatted payload; discard and log on any error
- [x] T0XX [US2] Subscribe `SlackNotifier` to `session.updated`, `repository.added`, and `repository.removed` events from `SessionMonitor` inside `SlackNotifier.initialize()` in `backend/src/services/slack-notifier.ts`; each handler calls `this.postEvent(session.id, SESSION_UPDATED, session)` (or equivalent per event)
- [x] T0XX [US2] Implement rate-limit send queue in `backend/src/services/slack-notifier.ts`: an async FIFO queue that chains each `chat.postMessage` call with a minimum 1100ms interval between sends; if queue depth exceeds 50 entries, drop the oldest pending item and log a warning with the dropped event type and session ID

**Checkpoint**: All Argus events appear as Slack thread replies. Rapid-fire events are spaced without crashes.

---

## Phase 5: User Story 3 — Notification Configuration (Priority: P3)

**Goal**: Channel and enabled event types can be changed at runtime without restarting Argus.

**Independent Test**: Call `PATCH /api/settings/slack` with `{ "enabledEventTypes": [] }`, trigger a `session.created` event, and verify no Slack message is sent. Then restore and verify notifications resume.

- [x] T0XX [US3] Implement `reconfigure(partial: Partial<SlackConfig>): void` in `backend/src/services/slack-notifier.ts`: merge the incoming partial config with the current config, update `channelId` and `enabledEventTypes` atomically (no lock needed — Node.js single-threaded event loop), log the reconfiguration
- [x] T0XX [US3] Add `GET /api/settings/slack` route to `backend/src/api/routes/settings.ts`: return the current `SlackConfig` with `botToken` and `appToken` replaced by `"***"` in the response; return `404` if Slack is not configured
- [x] T0XX [US3] Add `PATCH /api/settings/slack` route to `backend/src/api/routes/settings.ts`: accept `{ channelId?, enabledEventTypes?, enabled? }`, validate types, persist changes to `~/.argus/config.json`, and call `slackNotifier.reconfigure(body)` to apply without restart

**Checkpoint**: Configuration changes via API take effect immediately on the next event.

---

## Phase 6: User Story 4 — Slack-to-Argus Question Routing (Priority: P4)

**Goal**: Developer types a question to the Argus Slack bot and receives a formatted response with live session data, with no public HTTP endpoint required.

**Independent Test**: Send `@ArgusBot sessions` as an app mention in the configured Slack channel; verify a reply appears within 10 seconds listing active sessions.

- [x] T0XX [US4] Create `backend/src/services/slack-listener.ts` with `SlackListener` class: constructor accepts `SlackConfig` and a reference to `SessionMonitor`; `initialize()` creates a `SocketModeClient` with `appToken`, connects, and registers handlers; `shutdown()` disconnects; skip initialization silently if `appToken` is absent and log a single info message
- [x] T0XX [US4] Implement `app_mention` and `message.im` (direct message) event handlers in `backend/src/services/slack-listener.ts`: extract message text and channel/thread context, call `handleArgusQuery()`, post the result as a thread reply using the injected `WebClient`
- [x] T0XX [US4] Implement `handleArgusQuery(text: string): Promise<SlackBlock[]>` in `backend/src/services/slack-listener.ts`: match text against patterns `sessions?`, `status <sessionId>`, `help`; for "sessions" query `SessionMonitor` for active sessions and return a formatted Block Kit list; for "status <id>" return session detail; for "help" or unrecognized input return a help Block Kit message listing supported commands
- [x] T0XX [US4] Wire `SlackListener` into `backend/src/server.ts`: instantiate after `SlackNotifier`, pass the same `SessionMonitor` instance and the `WebClient` from `SlackNotifier`, call `initialize()` during startup and `shutdown()` during graceful shutdown

**Checkpoint**: Bot responds to app mentions and DMs with live session data.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [x] T0XX [P] Add Slack setup section to `README.md`: one-time Slack App creation steps (create app, add scopes, enable Socket Mode, generate tokens, invite bot to channel, set env vars)
- [x] T0XX [P] Add `slack` status field to `GET /api/health` response in `backend/src/api/routes/health.ts`: `{ "slack": { "notifier": "connected" | "disabled" | "error", "listener": "connected" | "disabled" | "error" } }`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - start immediately
- **Foundation (Phase 2)**: Depends on Phase 1 completion - BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 - no dependencies on other user stories
- **US2 (Phase 4)**: Depends on Phase 2 - builds on Phase 3 infrastructure but independently testable
- **US3 (Phase 5)**: Depends on Phase 2 - independently testable (wraps config that Phase 3/4 consume)
- **US4 (Phase 6)**: Depends on Phase 2 - independently testable (uses SessionMonitor, separate from notifier)
- **Polish (Phase 7)**: Depends on all desired user stories being complete

### User Story Dependencies

- **US1 (P1)**: No dependency on US2/US3/US4
- **US2 (P2)**: No hard dependency on US1 (uses same `postEvent` path), but benefits from US1's thread map
- **US3 (P3)**: No dependency on US1/US2/US4 - purely config surface
- **US4 (P4)**: No dependency on US1/US2/US3 - separate `SlackListener` service

### Within Each Story

- T003/T004/T005 can run in parallel (different files)
- T008/T009 can run in parallel (no mutual dependency until T010 wires them)
- T015/T016/T017 can run in parallel
- T018/T019/T020 can run in parallel (all in `slack-listener.ts`, coordinate if single developer)

---

## Parallel Example: Phase 2 (Foundation)

```
Parallel batch 1:
  T003 — Add SlackConfig and SlackEventType to models/index.ts
  T004 — Create constants/slack-events.ts
  T005 — Extend config-loader.ts

Sequential:
  T006 — Create slack-notifier.ts skeleton (depends on T003, T004, T005)
  T007 — Wire into server.ts (depends on T006)
```

---

## Implementation Strategy

### MVP Scope (User Story 1 Only)

1. Complete Phase 1: Setup (T001, T002)
2. Complete Phase 2: Foundation (T003–T007)
3. Complete Phase 3: US1 (T008–T011)
4. **STOP and VALIDATE**: Start a session, verify Slack thread appears, end it, verify reply
5. Ship or demo MVP

### Incremental Delivery

1. Phase 1 + 2 + 3 → MVP: Session start/end in Slack
2. + Phase 4 → All events in Slack threads
3. + Phase 5 → Runtime config changes without restart
4. + Phase 6 → Ask the bot questions from Slack
5. + Phase 7 → Docs and health endpoint

---

## Notes

- `[P]` tasks touch different files with no shared dependencies; run them in parallel
- Commit after each phase checkpoint
- All Slack calls are fire-and-forget; never `await` them from within event handlers in a way that could block `SessionMonitor`
- Token values must never be logged; always redact in log output and API responses
- Total tasks: 23 | US1: 4 | US2: 3 | US3: 3 | US4: 4 | Setup/Foundation/Polish: 9
