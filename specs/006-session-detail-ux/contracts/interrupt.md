# API Contract: POST /api/v1/sessions/:id/interrupt

## Purpose
Sends an interrupt signal to the active process associated with a session. For sessions with a known PID, this sends SIGINT (Unix) or Ctrl+Break (Windows). Semantically: cancel the current running command without ending the session itself.

## Request

```
POST /api/v1/sessions/:id/interrupt
Content-Type: application/json
Body: (empty)
```

| Parameter | Location | Type | Required | Description |
|-----------|----------|------|----------|-------------|
| `id` | path | string | yes | Session ID |

## Responses

### 202 Accepted — interrupt dispatched

```json
{
  "actionId": "uuid",
  "status": "sent"
}
```

### 404 Not Found — session does not exist

```json
{
  "error": "NOT_FOUND",
  "message": "Session {id} not found",
  "requestId": "uuid"
}
```

### 409 Conflict — session already ended

```json
{
  "error": "CONFLICT",
  "message": "Session already ended",
  "requestId": "uuid"
}
```

### 501 Not Implemented — session type does not support interrupt

```json
{
  "error": "NOT_SUPPORTED",
  "message": "Interrupt not supported for this session type",
  "requestId": "uuid"
}
```

## Control Action Record

A `ControlAction` record with `type: 'interrupt'` is created and broadcast via WebSocket:

```json
{
  "id": "uuid",
  "sessionId": "abc-123",
  "type": "interrupt",
  "payload": null,
  "status": "sent",
  "createdAt": "2026-04-02T01:00:00.000Z",
  "completedAt": null,
  "result": null
}
```

## Notes

- Does not change the session `status` field — the session remains `active` after an interrupt (unless Claude Code handles the SIGINT by ending the session)
- If the session has no PID (`pid: null`) and the OS process cannot be found, returns 501 `NOT_SUPPORTED`
- Callers should poll `GET /api/v1/sessions/:id` after interrupt to observe status changes
