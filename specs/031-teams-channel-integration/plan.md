# Implementation Plan: Microsoft Teams Channel Integration (Graph API)

**Branch**: `031-teams-channel-integration` | **Date**: 2026-04-14 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/031-teams-channel-integration/spec.md`

## Summary

Replace the prior Bot Framework implementation with a Microsoft Graph API approach using OAuth2 Device Code Flow for authentication and delta polling for inbound command detection. Argus posts session output to a Teams channel thread via Graph API, polls for replies every 10 seconds, and routes owner replies as ControlActions. No public webhook endpoint, no Azure Bot resource, no admin consent required.

## Technical Context

**Language/Version**: TypeScript (Node.js 18+)
**Primary Dependencies**: `@azure/msal-node` (Device Code Flow + token refresh), `node-fetch` / native fetch (Graph API calls)
**Storage**: SQLite via better-sqlite3 (existing); `~/.argus/teams-config.json` (OAuth tokens, config)
**Testing**: vitest (existing pattern)
**Target Platform**: Local developer machine (macOS/Linux/Windows)
**Project Type**: Local developer tool — extension of existing Argus backend + React frontend
**Performance Goals**: Output appears in Teams within 5s; commands detected within 15s (10s poll + processing)
**Constraints**: No public endpoint; no Azure Bot registration; single-user localhost tool (§VIII exception applies)
**Scale/Scope**: ≥10 concurrent CLI sessions with active Teams threads

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| §I Engineering (reliable, observable, testable, reversible) | PASS | Integration is opt-in, disabled by default; all components unit-testable via mocks |
| §II Architecture (versioned API boundaries, async long-running work) | PASS | Settings API versioned at `/api/v1/settings/teams`; polling runs async with structured status |
| §III Code Standards (< 50 lines, structured logging) | PASS | All functions kept < 50 lines; pino used throughout |
| §IV Test-First | PASS | Tests written before implementation in tasks |
| §V Testing Requirements (unit, integration, e2e) | PASS | Unit tests for Graph client, polling service, buffer; contract tests for settings API |
| §VI Security (auth/authz, no secrets in code, audit logging) | EXCEPTION | Argus is bound to 127.0.0.1, single local user. OAuth refresh token stored in `~/.argus/teams-config.json` (file-system protected, not in source). All Teams commands audit-logged with source "Teams" per FR-013. §VI localhost exception explicitly declared per spec. |
| §VII Observability (structured logs, health check) | PASS | Polling loop logs structured events; `/api/v1/health` extended with teams status |
| §VIII Performance (500ms p95) | EXCEPTION | Localhost single-user tool. Actual target: 15s command detection latency (polling), 5s output latency (push) |
| §IX AI Usage | PASS | AI generates implementation; human reviews before merge |
| §X Definition of Done | PASS | Tracked via tasks.md |
| §XI Documentation | PASS | README.md update task included (T-polish) |
| §XII Error Handling | PASS | All API errors use `{ error, message, requestId }`; UX shows only `message` field |

## Project Structure

New files to create:

```
backend/src/
  services/
    teams-graph-client.ts         # Graph API client (send messages, poll replies)
    teams-polling-service.ts      # Delta polling loop (replaces webhook)
    teams-integration.ts          # Session lifecycle handler (create thread, stream output, end)
    teams-message-buffer.ts       # Per-session output buffer (keep existing)
  config/
    teams-config-loader.ts        # Load/save ~/.argus/teams-config.json (update for new model)
  api/routes/
    teams-settings.ts             # GET/PATCH /api/v1/settings/teams (rewrite)
    teams-auth.ts                 # POST /api/v1/settings/teams/auth/device-code
                                  # POST /api/v1/settings/teams/auth/poll
  db/
    migrations/003-teams-threads.sql   # (keep existing — no schema change needed)

frontend/src/
  hooks/
    useTeamsSettings.ts           # Teams settings + auth flow hook (rewrite)
  components/SettingsPanel/
    TeamsSettingsSection.tsx      # Teams section UI (rewrite for device code flow)
  services/api.ts                 # Add teams API helpers (update)
```

Files to remove / replace:

```
backend/src/api/routes/teams-webhook.ts   # DELETE — no longer needed (no public webhook)
backend/src/services/teams-api-client.ts  # REPLACE with teams-graph-client.ts
```

Files to keep (no changes needed):

```
backend/src/services/teams-message-buffer.ts    # Keep as-is
backend/src/db/database.ts                      # Add deltaLink column to teams_threads
backend/src/models/index.ts                     # Update TeamsConfig interface
```


### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
# [REMOVE IF UNUSED] Option 1: Single project (DEFAULT)
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/

# [REMOVE IF UNUSED] Option 2: Web application (when "frontend" + "backend" detected)
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/

# [REMOVE IF UNUSED] Option 3: Mobile + API (when "iOS/Android" detected)
api/
└── [same as backend above]

ios/ or android/
└── [platform-specific structure: feature modules, UI flows, platform tests]
```

**Structure Decision**: [Document the selected structure and reference the real
directories captured above]

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
