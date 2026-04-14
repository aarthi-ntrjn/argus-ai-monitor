# Implementation Plan: Anonymous Usage Telemetry

**Branch**: `034-anonymous-telemetry` | **Date**: 2026-04-13 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/034-anonymous-telemetry/spec.md`

## Summary

Add lightweight, anonymous usage telemetry to Argus. The Node.js backend generates a persistent installation UUID, instruments key session lifecycle and UI relay events, and fire-and-forgets each event as an HTTP POST to a maintainer-hosted external endpoint. Users are notified via a first-launch banner (default: enabled) and can toggle telemetry at any time from Settings. No PII is collected. Telemetry must not block or degrade any product functionality.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 18+ (backend), React 18 (frontend)
**Primary Dependencies**: Fastify (backend API), Vitest + supertest (tests), React + TailwindCSS (frontend)
**Storage**: `~/.argus/config.json` (telemetry preference), `~/.argus/telemetry-id` (installation UUID)
**Testing**: Vitest (unit + contract), Playwright (e2e if needed)
**Target Platform**: Windows / macOS / Linux desktop (local backend + browser frontend)
**Project Type**: Web application (backend + frontend)
**Performance Goals**: Telemetry dispatch adds <50ms to any triggering action; hard timeout 2s per send
**Constraints**: Fire-and-forget only; zero retries; zero user-visible errors on failure; adds <5KB to app size
**Scale/Scope**: Single-user localhost tool; no concurrency concerns for telemetry

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| §I Engineering (reliable, observable, debuggable) | PASS | Structured logs on each dispatch attempt; installation ID traceable |
| §II Architecture (versioned API boundaries) | PASS | New relay endpoint `/api/v1/telemetry/event` has defined contract |
| §III Code Standards (<50 lines, structured logging) | PASS | TelemetryService split into focused functions |
| §IV Test-First | PASS | Tests written before implementation (tasks ordered accordingly) |
| §V Testing (unit + contract + e2e) | PASS | Unit tests for service, contract tests for relay endpoint |
| §VI Security (auth/authz) | PASS | Relay endpoint bound to localhost; §VI exception declared in spec |
| §VII Observability (structured logs) | PASS | Each send attempt logged with event type and outcome |
| §VIII Performance (<500ms p95) | PASS | Fire-and-forget; relay endpoint returns 204 immediately |
| §IX AI Usage | N/A | |
| §X Definition of Done | REQUIRED | README update + tests + security review tasks included |
| §XI Documentation | REQUIRED | README.md update task included |
| §XII Error Handling | PASS | 400/503 structured responses from relay; silent failure on external send |

## Project Structure

### Documentation (this feature)

```text
specs/034-anonymous-telemetry/
├── plan.md
├── research.md
├── data-model.md
├── contracts/
│   └── telemetry-relay-api.md
└── tasks.md
```

### Source Code

```text
backend/
├── src/
│   ├── models/index.ts                        (add telemetryEnabled, telemetryPromptSeen to ArgusConfig)
│   ├── config/config-loader.ts                (add telemetry defaults)
│   ├── services/
│   │   └── telemetry-service.ts               (NEW: installation ID, event dispatch)
│   └── api/routes/
│       ├── settings.ts                        (add telemetry keys to ALLOWED_KEYS)
│       └── telemetry.ts                       (NEW: relay endpoint POST /api/v1/telemetry/event)
└── tests/
    ├── unit/
    │   └── telemetry-service.test.ts          (NEW)
    └── contract/
        └── telemetry.test.ts                  (NEW)

frontend/
├── src/
│   ├── components/
│   │   ├── TelemetryBanner/                   (NEW: first-launch notice banner)
│   │   │   ├── TelemetryBanner.tsx
│   │   │   └── index.ts
│   │   └── SettingsPanel/
│   │       └── SettingsPanel.tsx              (add telemetry toggle section)
│   └── pages/
│       └── DashboardPage.tsx                  (mount TelemetryBanner when !telemetryPromptSeen)
```

**Structure Decision**: Web application layout. Backend-only telemetry dispatch; frontend contributes UI-only events via relay endpoint.

## Implementation Phases

### Phase 0: Maintainer Setup (Manual, Prerequisite)

**Goal**: Have a working PostHog project and ingest API key before any code is shipped.

**Tasks**:

1. Sign up at posthog.com and create a new project named "Argus".
2. Copy the project API key (starts with `phc_`).
3. Set the ingest URL: `https://app.posthog.com/capture/` (or EU: `https://eu.posthog.com/capture/`).
4. Add the API key and URL as build-time constants/env vars in the repo (document in `.env.example` as `TELEMETRY_URL` and `TELEMETRY_API_KEY`).
5. Verify the ingest endpoint accepts a test POST and the event appears in the PostHog Live Events view.

**Blocks**: Phase 1 code can be written without this, but telemetry will be a no-op until the key is set.

---

### Phase 1: Backend Core (Telemetry Service + Config)

**Goal**: Installation ID generation, preference storage, event dispatch capability. No instrumentation yet.

**Tasks**:

1. Add `telemetryEnabled: boolean` (default: `true`) and `telemetryPromptSeen: boolean` (default: `false`) to `ArgusConfig` interface in `models/index.ts` and to defaults in `config-loader.ts`.

2. Add `telemetryEnabled` and `telemetryPromptSeen` to `ALLOWED_KEYS` in `settings.ts`.

3. Create `backend/src/services/telemetry-service.ts`:
   - `loadOrCreateInstallationId(): string` — reads `~/.argus/telemetry-id`; generates UUID v4 if absent; logs creation
   - `readAppVersion(): string` — reads `version` from `package.json`; fallback `"unknown"`
   - `sendEvent(type, extra?): void` — fire-and-forget POST with `AbortSignal.timeout(2000)`; structured log on dispatch and on error

4. Write tests first:
   - `tests/unit/telemetry-service.test.ts`: installation ID creation, idempotency, fire-and-forget behaviour, silent failure on network error
   - `tests/contract/telemetry.test.ts`: relay endpoint 204, 400 on unknown type, 503 when disabled

### Phase 2: Relay Endpoint

**Goal**: `POST /api/v1/telemetry/event` — accepts frontend UI events, validates, relays via TelemetryService.

**Tasks**:

1. Create `backend/src/api/routes/telemetry.ts` implementing the contract in `contracts/telemetry-relay-api.md`.

2. Register route in `server.ts`.

3. Instrument `compare_view_opened` from the frontend (see Phase 4).

### Phase 3: Backend Event Instrumentation

**Goal**: Instrument all server-observable event types (FR-003).

**Instrumentation points**:

| Event | Location |
|-------|----------|
| `app_started` | `server.ts` — after `app.ready()` |
| `session_started` | `session-monitor.ts` — when a new session is first inserted |
| `session_ended` | `session-monitor.ts` — when session status transitions to `ended`/`completed` |
| `prompt_sent` | `session-controller.ts` — after `send_prompt` action completes |
| `session_stopped` | `session-controller.ts` — after `stop` action completes |

Each call is `telemetryService.sendEvent(type, extra?)` — non-blocking.

### Phase 4: Frontend (Banner + Settings Toggle)

**Goal**: First-launch banner and permanent Settings toggle.

**Tasks**:

1. Create `TelemetryBanner` component: non-blocking, dismissable, shows when `!telemetryPromptSeen`. Contains toggle (default on) + "Got it" dismiss button. On dismiss: `PATCH /api/v1/settings { telemetryEnabled: <choice>, telemetryPromptSeen: true }`.

2. Mount `TelemetryBanner` in `DashboardPage.tsx` conditional on `settings.telemetryPromptSeen === false`.

3. Add telemetry toggle section to `SettingsPanel.tsx` using `<Checkbox>` component with `patchSetting({ telemetryEnabled })`.

4. Call `POST /api/v1/telemetry/event { type: 'compare_view_opened' }` when the compare view is opened (locate the compare view navigation trigger in `DashboardPage.tsx`).

### Phase 5: Documentation + README

**Goal**: Satisfy §X Definition of Done and §XI Documentation.

**Tasks**:

1. Update `README.md`: document telemetry (what is collected, how to disable, endpoint configuration).

2. Ensure `TELEMETRY_URL` build-time constant is documented in contributor docs.
