---

# Research: Anonymous Usage Telemetry

**Branch**: `034-anonymous-telemetry` | **Date**: 2026-04-13

## Decision 1: Fire-and-Forget HTTP POST with 2-Second Timeout

**Decision**: Use Node.js native `fetch` with `AbortSignal.timeout(2000)` wrapped in a fire-and-forget async function. No third-party HTTP library required.

**Rationale**: Node.js 18+ includes native `fetch`. Argus backend targets Node.js 18+. `AbortSignal.timeout(n)` is purpose-built for hard timeouts and automatically aborts the request after `n` ms. Wrapping the call in an immediately-invoked async arrow function with a `.catch(() => {})` ensures the caller is never blocked and errors are swallowed silently.

**Pattern**:
```ts
void (async () => {
  try {
    const ac = AbortSignal.timeout(2000);
    await fetch(TELEMETRY_URL, { method: 'POST', body: JSON.stringify(event), signal: ac, headers: { 'Content-Type': 'application/json' } });
  } catch {
    // silent — telemetry must not affect product behaviour
  }
})();
```

**Alternatives considered**:
- `axios`: unnecessary dependency for a one-line POST.
- `node-fetch`: superseded by native fetch in Node 18+.
- `setTimeout` + manual abort: more verbose than `AbortSignal.timeout`.

---

## Decision 2: Installation ID Storage

**Decision**: Store the installation ID as a plain UUID in `~/.argus/telemetry-id` (no extension, plain text). Read on backend startup; generate and persist if absent.

**Rationale**: Keeping the ID in a dedicated file separate from `config.json` prevents accidental exposure if config is logged or reset. Plain-text single-line file is the simplest possible persistence — no JSON parsing required.

**Alternatives considered**:
- Store in `config.json`: mixing user-editable config with auto-generated identity is an anti-pattern.
- Store in SQLite DB: overkill for a single UUID; adds DB migration complexity.
- Derive from machine ID: platform-specific and harder to reset if user wants to.

---

## Decision 3: App Version Source

**Decision**: Read `version` from `backend/package.json` at startup via `fs.readFileSync` + `JSON.parse`, cached in module scope. Falls back to `"unknown"` if the file is unreadable.

**Rationale**: `package.json` is the canonical version source in Node.js projects. Reading at startup (once) has zero runtime cost. No build-time injection needed.

**Alternatives considered**:
- Build-time env variable injection: adds build configuration complexity.
- Hardcoded constant: creates drift between code and package.json.

---

## Decision 4: Telemetry Preference Storage

**Decision**: Add two fields to `ArgusConfig` in `~/.argus/config.json`:
- `telemetryEnabled: boolean` — default `true`
- `telemetryPromptSeen: boolean` — default `false`

Both fields are added to `ALLOWED_KEYS` in the settings route so the frontend can update them via `PATCH /api/v1/settings`.

**Rationale**: Re-using the existing config + settings API pattern (as used by `yoloMode`) requires zero new infrastructure. The `telemetryPromptSeen` flag is separate from `telemetryEnabled` so the two concerns (has the user been notified? and is telemetry on?) are independently addressable.

**Alternatives considered**:
- Separate preferences file: unnecessary complexity given the existing config pattern.
- Frontend-only localStorage: preference would be lost on reinstall and not accessible to backend.

---

## Decision 5: Frontend UI Events Relay

**Decision**: Add a lightweight backend route `POST /api/v1/telemetry/event` accepting `{ type: string }`. Frontend calls this for UI-only events (compare view opened). Backend validates the type against the allowed event list, adds installation ID + version + timestamp, and dispatches to the external endpoint.

**Rationale**: All outbound network calls must originate from the backend (per clarification Q3). The frontend cannot send events directly to the external endpoint without violating CORS or leaking the endpoint URL to browser clients.

**Alternatives considered**:
- Frontend sends directly to external endpoint: leaks endpoint URL in browser network tab; CORS complexity.
- Drop `compare view opened` from event set: reduces product insight; not aligned with FR-003.

---

## Decision 6: External Collector — PostHog

**Decision**: Use PostHog Cloud as the telemetry collector. Ingest URL: `https://app.posthog.com/capture/` (or `https://eu.posthog.com/capture/` for EU data residency). Events are sent as HTTP POST with JSON body matching PostHog's capture API: `{ api_key, distinct_id, event, properties, timestamp }`.

**Mapping to spec payload**:
- `distinct_id` = `installationId`
- `event` = event type string (e.g. `session_started`)
- `properties` = `{ appVersion, sessionType? }`
- `timestamp` = UTC ISO 8601 string

**Rationale**: PostHog's free tier covers 1M events/month with no credit card required. It provides a built-in dashboard (aggregations, funnels, retention) at zero additional cost, accepts plain HTTP POST with no SDK, and has an EU-hosted option for data residency. Chosen over Cloudflare Worker + D1 (no dashboard) and Tinybird ($49/mo minimum paid tier).

**Alternatives considered**:
- Cloudflare Worker + D1: full data ownership but no dashboard; higher setup cost.
- Tinybird: good ingest API but $49/mo minimum paid tier is disproportionate for this scale.
- Custom serverless function: maximum control but requires building query/dashboard tooling separately.

**Prerequisite**: Maintainer must create a PostHog project and set `TELEMETRY_URL` and `TELEMETRY_API_KEY` build-time constants before telemetry is live. See Phase 0 in plan.md.
