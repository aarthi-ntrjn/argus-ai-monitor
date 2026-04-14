# API Contract: Teams Graph API (Internal)

**Revision**: 2026-04-14 — Replaces `/api/botframework/messages` webhook (deleted).

No inbound webhook is exposed. Inbound commands arrive via delta polling, not HTTP push. This document describes the internal Graph API calls Argus makes.

---

## Outbound: Create Thread Post

**Graph API**: `POST https://graph.microsoft.com/v1.0/teams/{teamId}/channels/{channelId}/messages`

### Request body
```json
{
  "body": {
    "contentType": "html",
    "content": "<b>Argus Session Started</b><br>Session ID: ...<br>Type: claude-code<br>Started: 2026-04-14T00:00:00Z<br>Owner: Ada Lovelace"
  }
}
```

### Response 201
```json
{ "id": "1234567890", ... }
```

The returned `id` is stored as `teams_threads.teams_thread_id`.

---

## Outbound: Post Output Reply

**Graph API**: `POST https://graph.microsoft.com/v1.0/teams/{teamId}/channels/{channelId}/messages/{messageId}/replies`

### Request body
```json
{ "body": { "contentType": "html", "content": "<pre>session output text</pre>" } }
```

The returned `id` is stored as `current_output_message_id`.

---

## Outbound: Update Output Reply

**Graph API**: `PATCH https://graph.microsoft.com/v1.0/teams/{teamId}/channels/{channelId}/messages/{messageId}/replies/{replyId}`

### Request body
```json
{ "body": { "contentType": "html", "content": "<pre>updated cumulative output</pre>" } }
```

Used for rolling-window output updates (replaces previous content with full accumulated output).

---

## Inbound: Delta Poll for Replies

**Graph API**: `GET https://graph.microsoft.com/v1.0/teams/{teamId}/channels/{channelId}/messages/{messageId}/replies/delta`

First call (no deltaLink): returns all existing replies + `@odata.deltaLink`.
Subsequent calls: use stored `@odata.deltaLink` to get only new replies.

### Response item shape (relevant fields)
```json
{
  "id": "reply-message-id",
  "from": { "user": { "id": "aad-object-id", "displayName": "Ada Lovelace" } },
  "body": { "content": "please stop and summarise" },
  "createdDateTime": "2026-04-14T00:05:00Z"
}
```

**Processing logic**:
1. Compare `from.user.id` to stored `ownerUserId`.
2. If match and session is active: create `ControlAction` with `type: "send_prompt"`, `source: "Teams"`.
3. If no match: post a reply "Only the session owner can send commands to this session."
4. If session is ended: post a reply "This session has ended and no longer accepts commands."
5. Always update stored `deltaLink` to the new `@odata.deltaLink`.

---

## Auth: Graph API Access Token

All Graph API calls include `Authorization: Bearer {accessToken}`.

Access tokens are obtained via MSAL using the stored `refreshToken`:
- MSAL silent token acquisition: `acquireTokenByRefreshToken({ refreshToken, scopes: ['ChannelMessage.Send', 'ChannelMessage.Read.All', 'User.Read'] })`
- Token cached in memory; refreshed automatically when near expiry.
- On refresh failure: log `teams.token.refresh.failed`, disable integration temporarily, emit health event.

