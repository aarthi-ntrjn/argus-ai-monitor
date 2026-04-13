# Data Model: Microsoft Teams Channel Integration

**Branch**: `031-teams-channel-integration` | **Date**: 2026-04-13

## Entities

### TeamsConfig

Stored in `~/.argus/teams-config.json`. Contains all configuration needed to connect Argus to Teams.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| enabled | boolean | yes | Whether the integration is active |
| botAppId | string | yes (when enabled) | Azure Bot registration Application (client) ID |
| botAppPassword | string | yes (when enabled) | Azure Bot client secret / app password |
| channelId | string | yes (when enabled) | Teams channel ID to post session threads into |
| serviceUrl | string | yes (when enabled) | Bot Framework service URL (e.g. `https://smba.trafficmanager.net/emea/`) |
| tenantId | string | no | Azure AD tenant ID (optional; used for token audience validation) |
| ownerTeamsUserId | string | yes (when enabled) | Teams AAD Object ID of the session owner; used to authorise inbound commands |

**Validation rules**:
- `botAppId` must be a non-empty string when `enabled` is true.
- `botAppPassword` must be a non-empty string when `enabled` is true.
- `channelId` must be a non-empty string when `enabled` is true.
- `serviceUrl` must be a valid HTTPS URL when `enabled` is true.
- `ownerTeamsUserId` must be a non-empty string when `enabled` is true.

---

### TeamsThread

Persisted in SQLite. Links an Argus session to its corresponding Teams thread.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | TEXT (UUID) | yes | Primary key |
| session_id | TEXT (FK → sessions.id) | yes | The Argus session this thread represents |
| teams_thread_id | TEXT | yes | The Teams conversation/thread ID (from Bot Framework activity) |
| teams_channel_id | TEXT | yes | The Teams channel ID where the thread lives |
| current_output_message_id | TEXT | null | Teams message ID of the current rolling output message (updated in place) |
| created_at | TEXT (ISO 8601) | yes | When the thread was created |

**Uniqueness**: `session_id` is unique — one thread per session. `teams_thread_id` is unique.

**State transitions**:
- Created when a session starts and integration is enabled.
- `current_output_message_id` is null initially; set after the first output message is posted.
- Updated with new `current_output_message_id` when a rolling message is replaced.
- Not deleted when a session ends (thread persists for reference).

---

### TeamsMessageBuffer (in-memory, not persisted)

Per-session circular buffer for outbound messages queued during Teams connectivity loss.

| Field | Type | Description |
|-------|------|-------------|
| sessionId | string | Owning session ID |
| entries | MessageEntry[] | Ordered queue of buffered message content strings |
| maxSize | number | Cap = 1000 entries per session |
| droppedCount | number | Running count of dropped entries since last flush |

---

## SQL Migration

**File**: `backend/src/db/migrations/003-teams-threads.sql`

```sql
CREATE TABLE IF NOT EXISTS teams_threads (
  id                        TEXT PRIMARY KEY,
  session_id                TEXT NOT NULL UNIQUE REFERENCES sessions(id),
  teams_thread_id           TEXT NOT NULL UNIQUE,
  teams_channel_id          TEXT NOT NULL,
  current_output_message_id TEXT,
  created_at                TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_teams_threads_session ON teams_threads(session_id);
```

---

## TypeScript Types

Added to `backend/src/models/index.ts`:

```typescript
export interface TeamsConfig {
  enabled: boolean;
  botAppId: string;
  botAppPassword: string;
  channelId: string;
  serviceUrl: string;
  tenantId?: string;
  ownerTeamsUserId: string;
}

export interface TeamsThread {
  id: string;
  sessionId: string;
  teamsThreadId: string;
  teamsChannelId: string;
  currentOutputMessageId: string | null;
  createdAt: string;
}
```

---

## Relationships

```
sessions 1──────0..1 teams_threads
                        └── teamsThreadId → (external: Teams conversation ID)

TeamsConfig (file)
  └── ownerTeamsUserId → verified against activity.from.id in inbound events
```
