# API Contract: Teams Settings

**Route prefix**: `/api/v1/settings/teams`

---

## GET /api/v1/settings/teams

Returns the current Teams integration configuration. The `botAppPassword` field is masked in the response (replaced with `"***"` if set) to avoid exposing secrets to the frontend.

### Response 200

```json
{
  "enabled": false,
  "botAppId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "botAppPassword": "***",
  "channelId": "19:xxxx@thread.tacv2",
  "serviceUrl": "https://smba.trafficmanager.net/emea/",
  "tenantId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "ownerTeamsUserId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "connectionStatus": "connected"
}
```

`connectionStatus` values: `"connected"` | `"disconnected"` | `"error"` | `"unconfigured"`

### Response 200 (not configured)

```json
{
  "enabled": false,
  "connectionStatus": "unconfigured"
}
```

---

## PATCH /api/v1/settings/teams

Updates Teams integration configuration and validates credentials against the Teams API.

### Request body

```json
{
  "enabled": true,
  "botAppId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "botAppPassword": "my-secret",
  "channelId": "19:xxxx@thread.tacv2",
  "serviceUrl": "https://smba.trafficmanager.net/emea/",
  "tenantId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "ownerTeamsUserId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
}
```

All fields optional in PATCH; only provided fields are updated. If `botAppPassword` is omitted or `"***"`, the existing password is preserved.

### Response 200 — saved and validated

```json
{
  "enabled": true,
  "botAppId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "botAppPassword": "***",
  "channelId": "19:xxxx@thread.tacv2",
  "serviceUrl": "https://smba.trafficmanager.net/emea/",
  "ownerTeamsUserId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "connectionStatus": "connected"
}
```

### Response 422 — validation failed (bad credentials or unreachable)

```json
{
  "error": "TEAMS_CONNECTION_FAILED",
  "message": "Could not connect to Teams. Check your Bot App ID, password, and service URL.",
  "requestId": "uuid"
}
```

### Response 400 — missing required field

```json
{
  "error": "TEAMS_CONFIG_INVALID",
  "message": "botAppId is required when enabling Teams integration.",
  "requestId": "uuid"
}
```

---

## Test Cases

| Scenario | Method | Input | Expected Status | Expected Body |
|----------|--------|-------|----------------|---------------|
| Get config when not configured | GET | — | 200 | `{ enabled: false, connectionStatus: "unconfigured" }` |
| Get config when configured | GET | — | 200 | Full config with password masked |
| Enable with valid credentials | PATCH | valid all fields | 200 | Config with `connectionStatus: "connected"` |
| Enable with bad password | PATCH | wrong botAppPassword | 422 | `TEAMS_CONNECTION_FAILED` |
| Enable missing required field | PATCH | `{ enabled: true }` only | 400 | `TEAMS_CONFIG_INVALID` |
| Disable integration | PATCH | `{ enabled: false }` | 200 | Config with `enabled: false` |
| Update password only | PATCH | `{ botAppPassword: "new" }` | 200 | Config with masked password |
| Preserve existing password | PATCH | `{ botAppPassword: "***" }` | 200 | Password unchanged |
