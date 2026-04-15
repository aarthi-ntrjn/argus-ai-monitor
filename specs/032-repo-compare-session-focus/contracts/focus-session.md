# API Contract: POST /api/v1/sessions/:id/focus

## Overview

Brings the terminal window hosting the session's process to the foreground on the server OS.

## Request

```
POST /api/v1/sessions/:id/focus
Content-Type: application/json (no body required)
```

| Parameter | In | Type | Required | Description |
|-----------|----|------|----------|-------------|
| `id` | path | string (UUID) | Yes | Session ID |

## Responses

### 200 OK — Focus succeeded

```json
{ "focused": true, "pid": 12345 }
```

### 404 Not Found

```json
{ "error": "NOT_FOUND", "message": "Session <id> not found", "requestId": "..." }
```

### 409 Conflict — Session already ended

```json
{ "error": "CONFLICT", "message": "Session already ended", "requestId": "..." }
```

### 422 Unprocessable Entity — No PID available

```json
{ "error": "PID_NOT_SET", "message": "Session has no PID on record", "requestId": "..." }
```

### 422 Unprocessable Entity — Window not found

```json
{ "error": "WINDOW_NOT_FOUND", "message": "Could not locate a window for this process", "requestId": "..." }
```

### 422 Unprocessable Entity — Focus tool not available (Linux)

```json
{ "error": "FOCUS_NOT_SUPPORTED", "message": "Window focus is not supported on this system. Install wmctrl or xdotool.", "requestId": "..." }
```

## Test Cases

| Scenario | Input | Expected Status | Expected Body |
|----------|-------|-----------------|---------------|
| Active session, PID resolvable | valid session id | 200 | `{ focused: true, pid: N }` |
| Session not found | unknown id | 404 | NOT_FOUND error |
| Session already ended | ended session id | 409 | CONFLICT error |
| Session has no PID | active session, null pid | 422 | PID_NOT_SET error |
| Focus OS call fails | valid session, process has no window | 422 | WINDOW_NOT_FOUND error |

## Notes

- The endpoint uses `hostPid` if set, otherwise falls back to `pid`.
- The focus operation is synchronous: it waits for the OS call to complete before responding.
- On Linux, if neither `wmctrl` nor `xdotool` is installed, returns `FOCUS_NOT_SUPPORTED`.
- The endpoint does NOT create a `ControlAction` record (focus is not a session control action, it is a UI convenience operation).
