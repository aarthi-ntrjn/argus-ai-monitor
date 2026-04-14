# Data Model: Microsoft Teams Channel Integration (Graph API)

**Branch**: `031-teams-channel-integration` | **Date**: 2026-04-14
**Revision**: Updated for Graph API approach (replaces Bot Framework model of 2026-04-13).

## Entities

### TeamsConfig

Stored in `~/.argus/teams-config.json`. Contains all credentials and config needed to connect Argus to Teams via Microsoft Graph API.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| enabled | boolean | yes | Whether the integration is active |
| clientId | string | yes (when enabled) | Azure AD Application (client) ID for the self-registered app |
| tenantId | string | yes (when enabled) | Azure AD Tenant ID |
| teamId | string | yes (when enabled) | Microsoft Teams team ID (the team containing the target channel) |
| channelId | string | yes (when enabled) | Teams channel ID to post session threads into |
| ownerUserId | string | yes (when enabled) | AAD Object ID of the authenticating user — captured automatically during Device Code Flow via `GET /me` |
| refreshToken | string | yes (when enabled) | OAuth2 refresh token obtained after Device Code Flow; used to acquire access tokens at runtime. Masked as `"***"` in all API responses. |

**Validation rules**:
- All required fields must be non-empty strings when `enabled` is true.
- `clientId` and `tenantId` must be non-empty GUIDs when `enabled` is true.
- `refreshToken` must be present and non-empty when `enabled` is true (set after Device Code Flow completes).
- `ownerUserId` must be present (set automatically after Device Code Flow — not user-editable).

---

### TeamsThread

Persisted in SQLite. Links an Argus session to its corresponding Teams channel thread and tracks delta polling state.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | TEXT (UUID) | yes | Primary key |
| session_id | TEXT (FK → sessions.id) | yes | The Argus session this thread represents |
| teams_thread_id | TEXT | yes | The Graph API message ID of the root thread post |
| teams_channel_id | TEXT | yes | The Teams channel ID where the thread lives |
| current_output_message_id | TEXT | null | Graph message ID of the current rolling output reply (updated in place) |
| delta_link | TEXT | null | Graph API delta link for polling replies. Null until first poll. |
| created_at | TEXT (ISO 8601) | yes | When the thread was created |

**Uniqueness**: `session_id` is unique — one thread per session. `teams_thread_id` is unique.

**State transitions**:
- Created when a session starts and integration is enabled.
- `current_output_message_id` is null initially; set after first output reply is posted.
- `delta_link` is null initially; set after first delta poll call.
- Not deleted when a session ends (thread persists for reference; polling stops).

---

### TeamsMessageBuffer (in-memory, not persisted)

Per-session circular buffer for outbound messages queued during Teams connectivity loss.

| Field | Type | Description |
|-------|------|-------------|
| sessionId | string | Owning session ID |
| entries | string[] | Ordered queue of buffered content strings |
| maxSize | number | Cap: 1000 entries per session |
| droppedCount | number | Running count of dropped entries since last flush |

---

## SQL Migration

**File**: `backend/src/db/migrations/003-teams-threads.sql`

The existing table gains a `delta_link` column (added as a runtime migration in `database.ts` to handle existing databases):

```sql
CREATE TABLE IF NOT EXISTS teams_threads (
  id                        TEXT PRIMARY KEY,
  session_id                TEXT NOT NULL UNIQUE REFERENCES sessions(id),
  teams_thread_id           TEXT NOT NULL UNIQUE,
  teams_channel_id          TEXT NOT NULL,
  current_output_message_id TEXT,
  delta_link                TEXT,
  created_at                TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_teams_threads_session ON teams_threads(session_id);
```

Runtime migration (in `database.ts`): `ALTER TABLE teams_threads ADD COLUMN delta_link TEXT` if not present.

---

## TypeScript Types

Updated in `backend/src/models/index.ts`:

```typescript
export interface TeamsConfig {
  enabled: boolean;
  clientId: string;
  tenantId: string;
  teamId: string;
  channelId: string;
  ownerUserId: string;
  refreshToken: string;
}

export interface TeamsThread {
  id: string;
  sessionId: string;
  teamsThreadId: string;
  teamsChannelId: string;
  currentOutputMessageId: string | null;
  deltaLink: string | null;
  createdAt: string;
}
```

---

## Relationships

```
sessions 1──────0..1 teams_threads
                        ├── teamsThreadId → Graph message ID (root post)
                        └── deltaLink     → Graph delta URL for reply polling

TeamsConfig (file)
  ├── clientId / tenantId → used by MSAL to acquire tokens
  ├── ownerUserId         → compared against reply sender ID in polling
  └── refreshToken        → stored by MSAL, used for silent token refresh
```

