# Implementation Plan: Microsoft Teams Channel Integration

**Branch**: `031-teams-channel-integration` | **Date**: 2026-04-13 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/031-teams-channel-integration/spec.md`

## Summary

Add bidirectional Microsoft Teams integration to Argus so that every CLI session automatically gets a Teams thread for real-time output streaming, and the session owner can send commands back to the session by replying to that thread. The integration is configured once via the Argus settings UI (bot credentials + channel details + owner Teams user ID captured during OAuth setup). A new `TeamsIntegrationService` hooks into `SessionMonitor` events and manages thread lifecycle, message buffering, and inbound command routing. A new webhook endpoint receives events posted by the Teams Bot Framework.

## Technical Context

**Language/Version**: TypeScript 5, Node.js >=22 (backend); React 18 + TypeScript 5 (frontend)
**Primary Dependencies**: Fastify 5, better-sqlite3, Vitest; Microsoft Bot Framework REST API (via native `fetch`) for outbound messages; Bot Framework activity schema for inbound webhook events
**Storage**: SQLite (better-sqlite3) — new `teams_threads` table; Teams credentials stored in `~/.argus/teams-config.json` (separate from general config to isolate secrets)
**Testing**: Vitest (backend unit + contract + integration); Playwright (frontend e2e)
**Target Platform**: Localhost developer tool (single user, Node.js server on 127.0.0.1:7411)
**Project Type**: Web service + integration service
**Performance Goals**: Output delivery to Teams within 5 s p95; inbound command delivery within 5 s p95; thread creation within 10 s of session start
**Constraints**: Teams bot endpoint must be reachable from the internet; localhost deployments require ngrok or equivalent tunnel (documented in README). Max 1000 buffered messages per session. Supports ≥10 concurrent sessions.
**Scale/Scope**: ≥10 concurrent sessions per §VIII exception (single-user localhost tool)

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| §I Engineering: reliable, observable, debuggable | PASS | TeamsIntegrationService emits structured logs; buffer state observable via health endpoint |
| §I Prefer simple solutions | PASS | Direct Bot Framework REST API calls via fetch; no heavy SDK |
| §I All functionality testable in isolation | PASS | TeamsIntegrationService injectable with mock Teams client |
| §I All changes reversible | PASS | Integration disabled by default; disabling removes future thread creation but preserves existing |
| §II Clear versioned API boundaries | PASS | New `/api/v1/teams/` route prefix; Bot Framework webhook at `/api/botframework/messages` |
| §II No direct cross-service DB access | PASS | All DB access through existing db/database.ts helpers |
| §II Long-running work asynchronous | PASS | Message delivery is async; buffer flush is async |
| §III Code readable, functions <50 lines | PASS | Enforced during implementation |
| §III Structured logging | PASS | All logs via Fastify/pino with JSON format |
| §IV Test-First NON-NEGOTIABLE | PASS | Tests written before implementation for each phase |
| §V Unit + integration + e2e tests | PASS | All three layers planned |
| §VI Auth/authz on all endpoints | EXCEPTION | Bot Framework webhook at `/api/botframework/messages` validates Bot Framework authentication tokens (JWT from Microsoft) rather than Argus session auth — this is the standard Bot Framework security model. All other new endpoints follow existing Argus auth model (local-only, no session auth required per §VI exception for localhost tools). |
| §VI No secrets in source code | PASS | Bot credentials stored in `~/.argus/teams-config.json`, never in source |
| §VI All actions audit-logged | PASS | Teams-originated commands logged in session history (FR-013) |
| §VII Structured logs + metrics + health | PASS | Teams connection status added to `/api/v1/health` response |
| §VIII Performance: 500ms API p95 | PASS | Teams config API endpoints are synchronous local file ops |
| §VIII Concurrent users exception | PASS | Localhost tool; spec declares ≥10 concurrent sessions target |
| §VIII Graceful degradation | PASS | Teams unavailable: buffer + warn; session continues normally |
| §IX AI usage | PASS | AI assists implementation; no AI in security-critical paths |
| §X Definition of Done | PASS | All items tracked in tasks.md |
| §XI README updated | PASS | Teams setup instructions added to README in final phase |
| §XII Error handling contract | PASS | Structured `{ error, message, requestId }` on all new API endpoints; UX shows human-readable messages |

## Project Structure

### Documentation (this feature)

```text
specs/031-teams-channel-integration/
├── plan.md              ← this file
├── research.md
├── data-model.md
├── contracts/
│   ├── teams-settings-api.md
│   └── teams-webhook-api.md
└── tasks.md
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── api/
│   │   └── routes/
│   │       ├── teams-settings.ts     ← GET/PATCH /api/v1/settings/teams
│   │       └── teams-webhook.ts      ← POST /api/botframework/messages
│   ├── config/
│   │   └── teams-config-loader.ts    ← load/save ~/.argus/teams-config.json
│   ├── db/
│   │   ├── migrations/
│   │   │   └── 003-teams-threads.sql ← teams_threads table
│   │   └── schema.ts                 ← updated with teams_threads
│   ├── models/
│   │   └── index.ts                  ← TeamsConfig, TeamsThread types added
│   └── services/
│       ├── teams-integration.ts      ← TeamsIntegrationService (core)
│       ├── teams-api-client.ts       ← Bot Framework REST API wrapper
│       └── teams-message-buffer.ts   ← per-session outbound message buffer
├── tests/
│   ├── unit/
│   │   ├── teams-integration.test.ts
│   │   ├── teams-api-client.test.ts
│   │   └── teams-message-buffer.test.ts
│   ├── contract/
│   │   ├── teams-settings.test.ts
│   │   └── teams-webhook.test.ts
│   └── integration/
│       └── teams-session-lifecycle.test.ts

frontend/
├── src/
│   ├── components/
│   │   └── SettingsPanel/
│   │       └── SettingsPanel.tsx     ← updated: Teams section added
│   ├── hooks/
│   │   └── useTeamsSettings.ts       ← fetch/save Teams config + connection status
│   └── services/
│       └── api.ts                    ← updated: Teams settings endpoints added
├── src/__tests__/
│   └── SettingsPanel.teams.test.tsx  ← Teams settings section tests
```

## Complexity Tracking

> No constitution violations requiring justification beyond the §VI exception documented above.

