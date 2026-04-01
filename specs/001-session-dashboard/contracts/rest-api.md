# REST API Contract: Session Dashboard

**Base URL**: `http://127.0.0.1:{port}/api/v1` (default port: `7411`)

> All routes are prefixed `/api/v1/`. The unversioned `/api/health` and `/hooks/claude` paths are exempt from versioning as they are infrastructure/internal endpoints.

---

## Health

### GET /api/health

Returns server health status.

**Response 200**:
```json
{
  "status": "ok",
  "version": "1.0.0",
  "uptime": 3600
}
```

---

## Repositories

### GET /api/v1/repositories

Returns all registered repositories.

**Response 200**:
```json
[
  {
    "id": "uuid",
    "path": "/Users/user/repos/argus",
    "name": "argus",
    "source": "config",
    "addedAt": "2026-04-01T10:00:00Z",
    "lastScannedAt": "2026-04-01T12:00:00Z",
    "activeSessions": 2
  }
]
```

### POST /api/v1/repositories

Register a new repository.

**Request body**:
```json
{ "path": "/absolute/path/to/repo" }
```

**Response 201**: Repository object (same shape as GET item)

**Response 400**: Path does not exist, is not a git repo, or is already registered
```json
{ "error": "INVALID_PATH", "message": "Path is not a git repository" }
```

### DELETE /api/v1/repositories/:id

Unregister a repository. Active sessions are terminated first.

**Response 204**: No content

**Response 404**: Repository not found

---

## Sessions

### GET /api/v1/sessions

Returns all sessions. Supports filtering.

**Query params**:
- `repositoryId` (optional) — filter by repo
- `status` (optional) — `active`, `idle`, `waiting`, `error`, `completed`, `ended`
- `type` (optional) — `copilot-cli`, `claude-code`, `copilot-vscode`

**Response 200**:
```json
[
  {
    "id": "uuid",
    "repositoryId": "uuid",
    "repositoryName": "argus",
    "repositoryPath": "/path/to/repo",
    "type": "copilot-cli"  // or "claude-code",
    "pid": 12345,
    "status": "active",
    "startedAt": "2026-04-01T10:00:00Z",
    "endedAt": null,
    "lastActivityAt": "2026-04-01T12:30:00Z",
    "summary": "Working on authentication module"
  }
]
```

### GET /api/v1/sessions/:id

Returns a single session.

**Response 200**: Session object (same shape as above)

**Response 404**: Session not found

### GET /api/v1/sessions/:id/output

Returns paginated output records for a session, newest first.

**Query params**:
- `limit` (optional, default `100`, max `1000`) — number of records
- `before` (optional) — return records with `sequenceNumber` < this value

**Response 200**:
```json
{
  "items": [
    {
      "id": "uuid",
      "sessionId": "uuid",
      "timestamp": "2026-04-01T12:30:00Z",
      "type": "tool_use",
      "content": "Reading file src/index.ts",
      "toolName": "Read",
      "sequenceNumber": 42
    }
  ],
  "nextBefore": 41,
  "total": 42
}
```

---

## Session Control

### POST /api/v1/sessions/:id/stop

Stop a running session by terminating the OS process.

**Response 202**: Action accepted
```json
{
  "actionId": "uuid",
  "status": "sent"
}
```

**Response 404**: Session not found

**Response 409**: Session already ended

### POST /api/v1/sessions/:id/send

Send a prompt to a running session.

**Request body**:
```json
{ "prompt": "Please add unit tests for the authentication module" }
```

**Response 202**: Action accepted
```json
{
  "actionId": "uuid",
  "status": "sent"
}
```

**Response 404**: Session not found

**Response 409**: Session already ended

**Response 501**: Prompt injection not supported for this session type
```json
{
  "error": "NOT_SUPPORTED",
  "message": "Prompt injection is not supported for copilot-cli sessions in this version"
}
```

---

## Hooks (internal — for AI tool callbacks)

### POST /hooks/claude

Receives hook event payloads from Claude Code's hook system (injected via `~/.claude/settings.json`).

**Request body**: Claude hook JSON payload (varies by event type)

**Response 200**: Acknowledged
```json
{ "ok": true }
```

This endpoint is intentionally unauthenticated. It binds only to `127.0.0.1`.

---

## Error Response Format

All error responses follow this shape:
```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable description"
}
```

| HTTP Status | Error Code | Meaning |
|---|---|---|
| 400 | `INVALID_INPUT` | Request body or query param invalid |
| 400 | `INVALID_PATH` | Path missing, non-git, or duplicate |
| 404 | `NOT_FOUND` | Resource does not exist |
| 409 | `SESSION_ENDED` | Cannot act on an ended session |
| 501 | `NOT_SUPPORTED` | Feature not yet implemented for this session type |
| 500 | `INTERNAL_ERROR` | Unexpected server error |
