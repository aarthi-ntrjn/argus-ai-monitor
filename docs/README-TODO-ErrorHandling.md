# Error Handling Audit

Status snapshot as of 2026-04-15. Covers `backend/src/` and `frontend/src/` only.

---

## Robust (surfaced to user + logged)

| Area | Mechanism |
|---|---|
| All HTTP errors | `setErrorHandler` in `server.ts` catches every unhandled route error, fires `request_error` telemetry, returns HTTP response |
| Process startup | `startServer().catch()` logs to stderr and exits cleanly |
| Route: stop / interrupt / send | Explicit `try/catch` mapping domain error codes (NOT_FOUND, CONFLICT, etc.) to HTTP 404 / 409 / 422 |
| Route: fs/scan-folder | `try/catch` with `app.log.error` and 500 response |
| `session-controller.ts` | `try/catch` on all methods, logs failures, updates action status to `failed` |
| `session-monitor.ts` | `try/catch` in `reconcileStaleSessions` with `logger.warn` / `logger.error` |
| `useRepositoryManagement.ts` | All handlers surface errors via `setAddError` |
| `LaunchDropdown` | `handleLaunch` shows error in red text below the button |
| `SessionPromptBar` | `handleSend` / `handleInterrupt` show errors as `role="alert"` |
| Dashboard / Session / OutputPane pages | React Query `isError` checked and displayed to user |

---

## Logged only (no UI feedback)

| Area | Notes |
|---|---|
| `socket.ts` `handleMessage` | JSON parse errors: `console.warn` |
| `socket.ts` `ws.onerror` | Closes connection but no detail logged |
| `telemetry-service.ts` | Intentional: telemetry must never crash the app |

---

## Silently swallowed (not logged, not shown)

| Area | Risk |
|---|---|
| `repository-scanner.ts` scan errors | Permission errors during folder recursion are ignored |
| `claude-code-detector.ts` settings file errors | Hook injection failures are silently ignored |
| `copilot-cli-detector.ts` readdir errors | Detector scan failures produce no log |
| `pruning-job.ts` | Pruning session / output cleanup failures are completely hidden |
| `database.ts` schema migrations | `ALTER TABLE` errors on startup have no `try/catch` |
| `useSettings.ts` localStorage | Read and write failures are silent; app falls back to defaults |
| `onboardingStorage.ts` | Intentional: tour continues in-memory if storage is unavailable |
| `api.ts` `postTelemetryEvent` | Intentional fire-and-forget (`.catch(() => {})`) |
| `TodoPanel` mutation `onError` | Removes item from pending set but shows no error to the user |

---

## Critical gaps to address

1. **Pruning job failures**: Expired sessions and outputs may not be cleaned up, with no indication to the operator.
2. **Database schema migration errors**: `ALTER TABLE` commands on startup have no error handling. A failure could leave the DB in a broken state.
3. **File-watcher silent failures**: `repository-scanner`, `copilot-cli-detector`, and `claude-code-detector` all swallow I/O errors. These could explain why sessions are not detected without any trace in the logs.
4. **localStorage settings**: Users silently lose settings on storage quota or security errors with no warning.
