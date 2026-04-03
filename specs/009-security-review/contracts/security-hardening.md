# API Contract Changes: Security Review & Hardening

**Branch**: `009-security-review` | **Date**: 2026-04-02

These are delta changes to existing contracts. Only security-impacted behaviours are documented here.

---

## POST /hooks/claude

**New constraints**:

| Constraint | Behaviour |
|-----------|-----------|
| Body > 64 KB | `413 Payload Too Large` (Fastify bodyLimit default) |
| `session_id` not UUID v4 | `400 Bad Request` `{ error: 'INVALID_SESSION_ID', message: 'session_id must be a valid UUID', requestId }` |
| `session_id` matches existing active session with non-null `pid`, payload carries different `pid` | `409 Conflict` `{ error: 'SESSION_PID_CONFLICT', message: 'Session already has an established PID', requestId }` |
| `cwd` not in registered repository list | Silent discard — `200 { ok: true }` (no watcher started, no session created) — existing behaviour, now enforced |

**Unchanged**: `200 { ok: true }` for valid payloads.

---

## POST /api/v1/sessions/:id/stop

**New constraints**:

| Constraint | Behaviour |
|-----------|-----------|
| Session PID fails registry check (PID is null) | `422 Unprocessable Entity` `{ error: 'PID_NOT_SET', message: 'Session has no PID on record', requestId }` |
| Session PID not found in OS process list | `422 Unprocessable Entity` `{ error: 'PID_NOT_FOUND', message: 'Process is no longer running', requestId }` |
| Session PID belongs to non-AI-tool process | `403 Forbidden` `{ error: 'PID_NOT_AI_TOOL', message: 'PID does not belong to a monitored AI process', requestId }` |

**Unchanged**: `200 ControlAction` for valid requests.

---

## POST /api/v1/sessions/:id/interrupt

Same new constraints as `/stop` above.

---

## GET /api/v1/fs/browse

**New constraints**:

| Constraint | Behaviour |
|-----------|-----------|
| `path` resolves outside home dir and registered repos | `403 Forbidden` `{ error: 'PATH_OUTSIDE_BOUNDARY', message: 'Path is outside the allowed directory boundary', requestId }` |
| `path` contains traversal sequences (resolved by `path.resolve`) | Covered by boundary check above |

---

## GET /api/v1/fs/scan

Same new constraints as `/browse` above.

---

## POST /api/v1/fs/scan-folder

Same new constraints. `path` in request body is subject to boundary check.

---

## All Responses — Security Headers

Every HTTP response (all routes) will include:

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
```

No `Server` version header will be present in any response (already true for Fastify; verified by integration test).
