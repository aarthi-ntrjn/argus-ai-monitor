# API Contract: Sessions (updated)

## GET /api/v1/sessions

Returns all sessions. Response now includes `pidSource`.

### Response Shape (unchanged structure, new field)

```json
[
  {
    "id": "8ac5d40b-7f18-4e51-903d-1524bd288c33",
    "repositoryId": "repo-uuid",
    "type": "claude-code",
    "launchMode": null,
    "pid": 54428,
    "pidSource": "session_registry",
    "status": "active",
    "startedAt": "2026-04-09T06:30:00.000Z",
    "endedAt": null,
    "lastActivityAt": "2026-04-09T06:35:00.000Z",
    "summary": "what is 2 + 2?",
    "expiresAt": null,
    "model": "claude-opus-4-5"
  }
]
```

### New Field

| Field | Type | Values | Description |
|-------|------|--------|-------------|
| `pidSource` | `string \| null` | `"session_registry"`, `"pty_registry"`, `"lockfile"`, `null` | How the PID was resolved |

## GET /api/v1/sessions/:id

Same response shape as above for a single session.

## Test Cases

| # | Scenario | Expected pidSource |
|---|----------|-------------------|
| 1 | Claude Code session detected via session registry | `"session_registry"` |
| 2 | Claude Code session launched via Argus PTY | `"pty_registry"` |
| 3 | Copilot CLI session detected via lock file | `"lockfile"` |
| 4 | Session with no PID resolved yet | `null` |
| 5 | PTY session where registry also has a file | `"pty_registry"` (PTY takes precedence) |
