# Logging Design

## Overview

Argus uses two logging systems in the backend. This document explains the spec, the rationale for each, and the tradeoffs considered.

---

## Systems in Use

### 1. Fastify Request Logger (pino)

Used exclusively in HTTP route handlers via `request.log` and `reply.log`.

**Format (development, with pino-pretty or raw):**
```
[03:50:35.632] INFO (38124): incoming request {"reqId":"abff...","req":{...}}
[03:50:35.633] INFO (38124): request completed {"reqId":"abff...","res":{"statusCode":200},"responseTime":0.46}
```

**Capabilities:**
- Automatic `reqId` correlation: every log line emitted within a request handler shares the same request ID, enabling end-to-end tracing of a single HTTP call.
- Structured JSON output in production, queryable by log aggregators (Datadog, Loki, etc.).
- Built-in request lifecycle events: start and completion (with `responseTime`) are logged automatically without any manual instrumentation.
- Child logger per request: Fastify creates a scoped child logger for each request, so `reqId` is pre-bound without passing it around.

**Where it is used:**
- All route handlers under `backend/src/api/routes/`

---

### 2. `createTaggedLogger` (custom, `utils/logger.ts`)

Used by all backend components that run outside the HTTP request lifecycle.

**Format:**
```
2026-05-01T10:51:45.140Z [info] [SlackNotifier] slack.session.updated.received: session=... status=active
2026-05-01T10:51:45.141Z [warn] [TeamsNotifier] teams.session.updated.skipped: no meaningful changes
```

**Capabilities:**
- Colored ANSI output in TTY environments for easy local scanning.
- Lightweight: no dependencies beyond `console.log`.
- Level filtering via `LOG_LEVEL` environment variable (`debug`, `info`, `warn`, `error`, `silent`).
- Each component creates a module-level logger with a fixed tag and color, so log lines are self-identifying without per-call prefixes.

**Where it is used:**
- All backend services and components: `SessionMonitor`, `TeamsNotifier`, `TeamsListener`, `SlackNotifier`, `SlackListener`, `PtyRegistry`, detectors, and other background services.

**Color assignments:**

| Component | ANSI Color |
|---|---|
| `[PtyRegistry]` | magenta `\x1b[35m` |
| `[TeamsNotifier]` / `[TeamsListener]` | cyan `\x1b[36m` |
| `[SlackNotifier]` / `[SlackListener]` | green `\x1b[32m` |

---

## Design Rules

- **Never use `console.log`, `console.info`, `console.warn`, or `console.error`** in backend source files. They bypass level filtering and produce untagged output. The only exception is `utils/logger.ts` itself.
- **Never use `import * as logger`** from `utils/logger.ts`. It produces uncolored output and requires manually embedding the component name in every log string. Always use `createTaggedLogger`.
- **Route handlers use `request.log` / `reply.log`**, not `createTaggedLogger`. This is intentional: Fastify's per-request child logger provides automatic `reqId` correlation that `createTaggedLogger` cannot replicate.
- **Never log em dashes.** Use a comma or colon instead.

---

## Tradeoffs Considered

### Option A: Standardize on Fastify logger everywhere (rejected)

Fastify's `server.log` instance could be passed to every service constructor, unifying the log format across the codebase.

**Advantages:**
- Single log format: structured JSON everywhere.
- `reqId` correlation possible if the child logger is threaded from request handlers into service calls.
- Production-ready for log aggregators out of the box.

**Disadvantages:**
- Fastify's logger is request-scoped by design. Background services (`SessionMonitor`, notifiers, detectors) run outside any HTTP request, so there is no natural child logger to use. You would pass `server.log` directly, losing per-request correlation for those components anyway.
- Requires threading a logger dependency through every service constructor, adding boilerplate with little gain.
- pino's default output is JSON, which is noisy to read locally without a pretty-printer (`pino-pretty`) added as a dev dependency.
- For a locally-run developer tool, the observability benefits of full pino adoption are marginal compared to the cost.

**Verdict:** Not adopted. The split is the right model for Argus's current scale and deployment target.

### Option B: Standardize on `createTaggedLogger` everywhere (rejected)

Replace Fastify's request logger with `createTaggedLogger` in route handlers.

**Advantages:**
- Consistent format everywhere.
- Colored terminal output for all logs.

**Disadvantages:**
- Loses automatic `reqId` correlation across a request lifecycle.
- Loses automatic request start and completion timing.
- Requires manually logging request metadata that Fastify provides for free.

**Verdict:** Not adopted. Fastify's per-request structured logging is strictly better for the HTTP layer.

### Option C: Two systems, split by concern (adopted)

- Fastify logger for HTTP request/response lifecycle (route handlers only).
- `createTaggedLogger` for all background components and services.

**Advantages:**
- Each tool is used where it is best suited.
- No boilerplate in background services.
- Colored, readable output locally; structured JSON for HTTP tracing.

**Disadvantages:**
- Two visually distinct log formats appear in the same terminal output.
- A developer reading logs must know which system produced a given line.

**Verdict:** Adopted. The format difference is a minor readability cost; the functional benefits of each system outweigh the inconsistency.

---

## Adding a New Component

1. Import `createTaggedLogger` from `../utils/logger.js`.
2. Create a module-level logger with a unique tag and color:
   ```ts
   import { createTaggedLogger } from '../utils/logger.js';
   const log = createTaggedLogger('[MyComponent]', '\x1b[33m'); // yellow
   ```
3. Use `log.info`, `log.warn`, `log.error`, `log.debug` throughout the file.
4. Register the tag and color in the table above.
