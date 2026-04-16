# API Contract: Teams Settings (Graph API)

**Revision**: 2026-04-14 — Graph API / Device Code Flow approach

## Base URL: `/api/v1/settings/teams`

---

## GET /api/v1/settings/teams

Returns current Teams configuration. `refreshToken` always masked as `"***"`.

### Response 200 — configured
```json
{
  "enabled": true,
  "clientId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "tenantId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "teamId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "channelId": "19:xxxxx@thread.tacv2",
  "ownerUserId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "refreshToken": "***",
  "connectionStatus": "connected"
}
```

### Response 200 — not configured
```json
{ "enabled": false, "connectionStatus": "unconfigured" }
```

`connectionStatus` values: `"connected"` | `"disconnected"` | `"error"` | `"unconfigured"`

---

## PATCH /api/v1/settings/teams

Update config fields. `refreshToken: "***"` preserves existing token. Changing `clientId` or `tenantId` clears the stored refreshToken (re-auth required).

### Request body (all optional)
```json
{
  "enabled": true,
  "clientId": "...",
  "tenantId": "...",
  "teamId": "...",
  "channelId": "...",
  "refreshToken": "***"
}
```

### Response 200 — saved
Same shape as GET.

### Response 400 — missing required field
```json
{ "error": "TEAMS_CONFIG_INVALID", "message": "clientId is required when enabling Teams integration.", "requestId": "..." }
```

### Response 422 — no valid refresh token
```json
{ "error": "TEAMS_NOT_AUTHENTICATED", "message": "Teams authentication is required. Use Device Code Flow to authenticate before enabling.", "requestId": "..." }
```

---

## POST /api/v1/settings/teams/auth/device-code

Initiates Device Code Flow. Returns the user code and verification URL to display in the UI.

### Request body
```json
{ "clientId": "...", "tenantId": "..." }
```

### Response 200
```json
{
  "userCode": "ABCD-1234",
  "verificationUrl": "https://microsoft.com/devicelogin",
  "expiresIn": 900,
  "message": "Open https://microsoft.com/devicelogin and enter the code ABCD-1234 to authenticate."
}
```

### Response 400
```json
{ "error": "TEAMS_CONFIG_INVALID", "message": "clientId and tenantId are required.", "requestId": "..." }
```

---

## POST /api/v1/settings/teams/auth/poll

Polls for Device Code Flow completion. On success, stores refresh token and ownerUserId automatically. Call every 5s until `status !== "pending"`.

### Request body
```json
{ "clientId": "...", "tenantId": "..." }
```

### Response 200 — pending
```json
{ "status": "pending" }
```

### Response 200 — completed
```json
{ "status": "completed", "ownerUserId": "...", "displayName": "Ada Lovelace" }
```

### Response 200 — expired
```json
{ "status": "expired", "message": "Device code expired. Restart the authentication flow." }
```

---

## Test Cases

| # | Scenario | Expected |
|---|----------|----------|
| 1 | GET unconfigured | 200 `{ enabled: false, connectionStatus: "unconfigured" }` |
| 2 | GET configured, valid token | 200, masked refreshToken, `connectionStatus: "connected"` |
| 3 | GET configured, stale token | 200, `connectionStatus: "error"` |
| 4 | PATCH enable, all fields + valid token | 200, `connectionStatus: "connected"` |
| 5 | PATCH `refreshToken: "***"` | Preserves existing token, 200 |
| 6 | PATCH enable, no refreshToken | 422 `TEAMS_NOT_AUTHENTICATED` |
| 7 | PATCH enable, missing clientId | 400 `TEAMS_CONFIG_INVALID` |
| 8 | PATCH `enabled: false` | 200, `connectionStatus: "disconnected"` |
| 9 | PATCH new clientId clears refreshToken | 200, `connectionStatus: "unconfigured"` |
| 10 | POST device-code valid input | 200 with userCode + verificationUrl |
| 11 | POST device-code missing clientId | 400 `TEAMS_CONFIG_INVALID` |
| 12 | POST auth/poll while pending | 200 `{ status: "pending" }` |
| 13 | POST auth/poll after sign-in | 200 `{ status: "completed", ownerUserId, displayName }` |
| 14 | POST auth/poll after expiry | 200 `{ status: "expired" }` |

