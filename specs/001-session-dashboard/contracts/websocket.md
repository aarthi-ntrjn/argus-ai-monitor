# WebSocket Contract: Session Dashboard

**URL**: `ws://127.0.0.1:{port}/ws` (default port: `7411`)

> The WebSocket endpoint is not versioned. Version negotiation is handled via the `connected` event's `version` field.

---

## Connection

Connect with a plain WebSocket. No authentication required (localhost only).

On successful connection, the server sends a `connected` event with server metadata.

---

## Message Format

All messages are JSON objects with the following shape:

```json
{
  "type": "event.name",
  "timestamp": "2026-04-01T12:00:00Z",
  "data": { ... }
}
```

---

## Server → Client Events

### `connected`

Sent immediately after connection is established.

```json
{
  "type": "connected",
  "timestamp": "...",
  "data": {
    "serverId": "uuid",
    "version": "1.0.0"
  }
}
```

---

### `session.created`

A new session has been detected.

```json
{
  "type": "session.created",
  "timestamp": "...",
  "data": {
    "sessionId": "uuid",
    "repositoryId": "uuid",
    "repositoryName": "argus",
    "type": "copilot-cli",  // or "claude-code"
    "pid": 12345,
    "status": "active",
    "startedAt": "...",
    "summary": null
  }
}
```

---

### `session.updated`

A session's status or metadata has changed.

```json
{
  "type": "session.updated",
  "timestamp": "...",
  "data": {
    "sessionId": "uuid",
    "changes": {
      "status": "idle",
      "lastActivityAt": "...",
      "summary": "Updated summary text"
    }
  }
}
```

---

### `session.ended`

A session has ended (process terminated or lock file removed).

```json
{
  "type": "session.ended",
  "timestamp": "...",
  "data": {
    "sessionId": "uuid",
    "endedAt": "...",
    "expiresAt": "..."
  }
}
```

---

### `session.output`

New output has been produced by a session.

```json
{
  "type": "session.output",
  "timestamp": "...",
  "data": {
    "sessionId": "uuid",
    "output": {
      "id": "uuid",
      "type": "tool_use",
      "content": "Reading file src/index.ts",
      "toolName": "Read",
      "sequenceNumber": 43,
      "timestamp": "..."
    }
  }
}
```

---

### `repository.added`

A repository has been registered.

```json
{
  "type": "repository.added",
  "timestamp": "...",
  "data": {
    "repositoryId": "uuid",
    "path": "/Users/user/repos/argus",
    "name": "argus",
    "source": "ui"
  }
}
```

---

### `repository.removed`

A repository has been unregistered.

```json
{
  "type": "repository.removed",
  "timestamp": "...",
  "data": {
    "repositoryId": "uuid"
  }
}
```

---

### `action.updated`

A control action status has changed.

```json
{
  "type": "action.updated",
  "timestamp": "...",
  "data": {
    "actionId": "uuid",
    "sessionId": "uuid",
    "status": "completed",
    "result": null
  }
}
```

---

## Client → Server Messages

The client does **not** send messages over the WebSocket in v1. All commands are issued via REST endpoints. WebSocket is receive-only for the client.

> **Post-v1**: Consider adding a `subscribe` message to allow clients to filter events by `repositoryId` for multi-window setups.

---

## Reconnection

Clients should implement exponential backoff reconnection (initial: 1s, max: 30s). On reconnect, clients should re-fetch state via REST (`GET /api/sessions`, `GET /api/repositories`) to resync any events missed during disconnection.
