# API Contract: Teams Bot Framework Webhook

**Endpoint**: `POST /api/botframework/messages`

This endpoint receives activity events from the Microsoft Bot Framework when users interact with the Argus bot in Teams (e.g., replying to a session thread). It is a standard Bot Framework messaging endpoint.

---

## POST /api/botframework/messages

### Authentication

All requests MUST include a valid Bot Framework JWT bearer token in the `Authorization` header. Argus validates this token against Microsoft's JWKS endpoint before processing any activity. Requests with invalid or missing tokens are rejected with `401`.

### Request body (Bot Framework Activity schema)

```json
{
  "type": "message",
  "id": "activity-id",
  "timestamp": "2026-04-13T17:00:00.000Z",
  "serviceUrl": "https://smba.trafficmanager.net/emea/",
  "channelId": "msteams",
  "from": {
    "id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "name": "Jane Smith"
  },
  "conversation": {
    "id": "19:thread-id@thread.tacv2",
    "isGroup": true
  },
  "recipient": {
    "id": "bot-app-id",
    "name": "Argus Bot"
  },
  "replyToId": "parent-message-id",
  "text": "Please summarise the last 10 changes."
}
```

### Processing logic

1. Validate Bot Framework JWT token. Reject with 401 if invalid.
2. Accept only `type: "message"` activities. Ignore all other activity types (respond 200 immediately).
3. Look up the `TeamsThread` record by `conversation.id` (the Teams thread ID).
4. If no matching thread found: respond 200 silently (thread not managed by Argus).
5. Look up the associated session. If session has ended: post a notice to the thread and respond 200.
6. Compare `from.id` to `ownerTeamsUserId` from config.
   - Not owner: post a notice to the thread, respond 200, do NOT forward command.
   - Owner: create a `ControlAction` of type `send_prompt` with `payload.text = activity.text`, enqueue for the session, respond 200.

### Response 200 — accepted (all valid cases, including rejections handled gracefully)

```json
{}
```

### Response 401 — invalid Bot Framework token

```json
{
  "error": "UNAUTHORIZED",
  "message": "Bot Framework token validation failed.",
  "requestId": "uuid"
}
```

### Response 400 — malformed activity

```json
{
  "error": "INVALID_ACTIVITY",
  "message": "Activity body is missing required fields.",
  "requestId": "uuid"
}
```

---

## Test Cases

| Scenario | Input | Expected Response | Side Effect |
|----------|-------|------------------|-------------|
| Valid message from owner | Valid JWT, `from.id` = ownerTeamsUserId, active session | 200 `{}` | `send_prompt` ControlAction created |
| Valid message from non-owner | Valid JWT, `from.id` ≠ ownerTeamsUserId | 200 `{}` | Notice posted to thread; no ControlAction |
| Message to ended session | Valid JWT, session status = ended/completed | 200 `{}` | Notice posted to thread |
| Unknown thread | Valid JWT, `conversation.id` not in teams_threads | 200 `{}` | No action |
| Non-message activity type | Valid JWT, `type: "conversationUpdate"` | 200 `{}` | No action |
| Invalid JWT token | No/bad Authorization header | 401 | No action |
| Malformed body | Missing `from` field | 400 | No action |
