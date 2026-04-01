# Data Model: Session Dashboard

**Date**: 2026-04-01 | **Feature**: [spec.md](./spec.md)

---

## Entities

### Repository

A local git directory registered with Argus for monitoring.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `path` | string | Absolute filesystem path |
| `name` | string | Derived from last path segment |
| `source` | enum | `config` \| `ui` — how it was registered |
| `addedAt` | ISO datetime | When registered |
| `lastScannedAt` | ISO datetime | Last time session scan ran |

**Validation**: `path` must exist and contain a `.git` directory. Duplicate paths rejected.

---

### Session

An active or recently completed AI coding assistant instance associated with a repository.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key; matches AI tool's own session ID where available |
| `repositoryId` | UUID FK → Repository | Owning repository |
| `type` | enum | `copilot-cli` \| `claude-code` *(VS Code Copilot: post-v1)* |
| `pid` | integer \| null | OS process ID; null if process no longer running |
| `status` | enum | `active` \| `idle` \| `waiting` \| `error` \| `completed` \| `ended` |
| `startedAt` | ISO datetime | When session was first detected |
| `endedAt` | ISO datetime \| null | When session ended; null if still active |
| `lastActivityAt` | ISO datetime | Timestamp of last output or event |
| `summary` | string \| null | Human-readable summary (sourced from workspace.yaml for copilot-cli) |
| `expiresAt` | ISO datetime \| null | When this record will be auto-removed (set on session end) |

**State transitions**:
```
detected → active → idle ⇄ waiting → completed
                         ↘ error
                         ↘ ended (unexpected termination)
```

**Retention**: When `endedAt` is set, `expiresAt` = `endedAt` + configurable retention period (default 24 hours). Records past `expiresAt` are pruned by a background job.

---

### SessionOutput

An individual unit of output produced by a session.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `sessionId` | UUID FK → Session | Owning session |
| `timestamp` | ISO datetime | When the output was produced |
| `type` | enum | `message` \| `tool_use` \| `tool_result` \| `error` \| `status_change` |
| `content` | text | The output content (truncated to 64KB per record) |
| `toolName` | string \| null | Tool name for `tool_use` / `tool_result` types |
| `sequenceNumber` | integer | Monotonically increasing within a session for ordering |

**Retention**: Pruned when total output for a session exceeds the configured size limit (default 10MB per session) — oldest records removed first.

---

### ControlAction

A user-initiated command sent to a session from the Argus dashboard.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `sessionId` | UUID FK → Session | Target session |
| `type` | enum | `stop` \| `send_prompt` |
| `payload` | JSON \| null | For `send_prompt`: `{"prompt": "..."}` |
| `status` | enum | `pending` \| `sent` \| `completed` \| `failed` \| `not_supported` |
| `createdAt` | ISO datetime | When the action was requested |
| `completedAt` | ISO datetime \| null | When the action resolved |
| `result` | text \| null | Result message or error detail |

---

### ArgusConfig (file, not DB)

Stored at `~/.argus/config.json`. Not persisted in SQLite.

| Field | Type | Default | Notes |
|---|---|---|---|
| `port` | integer | `7411` | Argus server port |
| `watchDirectories` | string[] | `[]` | Root directories to scan for git repos |
| `sessionRetentionHours` | integer | `24` | How long ended sessions appear on dashboard |
| `outputRetentionMbPerSession` | integer | `10` | Max MB of output stored per session |
| `autoRegisterRepos` | boolean | `false` | Whether to auto-add newly discovered repos |

---

## SQLite Schema (summary)

```sql
CREATE TABLE repositories (
  id TEXT PRIMARY KEY,
  path TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  source TEXT NOT NULL CHECK(source IN ('config','ui')),
  added_at TEXT NOT NULL,
  last_scanned_at TEXT
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  repository_id TEXT NOT NULL REFERENCES repositories(id),
  type TEXT NOT NULL CHECK(type IN ('copilot-cli','claude-code')),
  pid INTEGER,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  last_activity_at TEXT NOT NULL,
  summary TEXT,
  expires_at TEXT
);

CREATE TABLE session_output (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  timestamp TEXT NOT NULL,
  type TEXT NOT NULL,
  content TEXT NOT NULL,
  tool_name TEXT,
  sequence_number INTEGER NOT NULL
);

CREATE TABLE control_actions (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  type TEXT NOT NULL,
  payload TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  completed_at TEXT,
  result TEXT
);

CREATE INDEX idx_sessions_repository_id ON sessions(repository_id);
CREATE INDEX idx_sessions_status ON sessions(status);
CREATE INDEX idx_session_output_session_id ON session_output(session_id);
CREATE INDEX idx_session_output_sequence ON session_output(session_id, sequence_number);
```
