# Argus Database

Argus uses **SQLite** via the [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) Node.js library.

## File location

| Default path | Override |
|---|---|
| `~/.argus/argus.db` | Set the `ARGUS_DB_PATH` environment variable |

The directory is created automatically on first run if it doesn't exist.

## Initialization

The database is lazily initialized on the first call to `getDb()` in `backend/src/db/database.ts`. On creation, the following SQLite pragmas are applied:

| Pragma | Value | Purpose |
|---|---|---|
| `journal_mode` | WAL | Write-Ahead Logging for better concurrency |
| `synchronous` | NORMAL | Balanced safety and performance |
| `foreign_keys` | ON | Enforce referential integrity |
| `cache_size` | -64000 | 64 MB page cache |
| `temp_store` | MEMORY | Temporary tables stored in memory |
| `mmap_size` | 268435456 | 256 MB memory-mapped I/O |
| `busy_timeout` | 5000 | 5-second lock wait before returning SQLITE_BUSY |

After pragmas, the full schema (`backend/src/db/schema.ts`) is applied using `CREATE TABLE IF NOT EXISTS`, so it is safe to run repeatedly.

## Schema

### repositories

Tracks code repositories being monitored.

| Column | Type | Notes |
|---|---|---|
| id | TEXT | Primary key |
| path | TEXT | Unique, normalized file path |
| name | TEXT | Display name |
| source | TEXT | `'config'` or `'ui'` |
| added_at | TEXT | ISO 8601 timestamp |
| last_scanned_at | TEXT | Nullable |
| branch | TEXT | Current branch (added via runtime migration) |

### sessions

AI coding sessions (Claude Code or Copilot CLI).

| Column | Type | Notes |
|---|---|---|
| id | TEXT | Primary key |
| repository_id | TEXT | FK to `repositories.id` |
| type | TEXT | `'claude-code'` or `'copilot-cli'` |
| pid | INTEGER | OS process ID |
| status | TEXT | Session status |
| started_at | TEXT | ISO 8601 |
| ended_at | TEXT | Nullable |
| last_activity_at | TEXT | ISO 8601 |
| summary | TEXT | Nullable |
| expires_at | TEXT | Nullable, used by pruning job |
| model | TEXT | AI model name (runtime migration) |
| launch_mode | TEXT | `'pty'` or `'detected'` (runtime migration) |

### session_output

Stores the message history for each session.

| Column | Type | Notes |
|---|---|---|
| id | TEXT | Primary key |
| session_id | TEXT | FK to `sessions.id` |
| timestamp | TEXT | ISO 8601 |
| type | TEXT | Message type |
| content | TEXT | Message body |
| tool_name | TEXT | Nullable |
| sequence_number | INTEGER | Ordering key |
| role | TEXT | Nullable (runtime migration) |

### control_actions

User commands sent to live sessions.

| Column | Type | Notes |
|---|---|---|
| id | TEXT | Primary key |
| session_id | TEXT | FK to `sessions.id` |
| type | TEXT | Action type |
| payload | TEXT | JSON string, nullable |
| status | TEXT | Action status |
| created_at | TEXT | ISO 8601 |
| completed_at | TEXT | Nullable |
| result | TEXT | Nullable |

### todos

User to-do items.

| Column | Type | Notes |
|---|---|---|
| id | TEXT | Primary key |
| user_id | TEXT | Defaults to `'default'` |
| text | TEXT | To-do content |
| done | INTEGER | 0 = false, 1 = true |
| created_at | TEXT | ISO 8601 |
| updated_at | TEXT | ISO 8601 |

## Indexes

```
idx_sessions_repo    ON sessions(repository_id)
idx_sessions_status  ON sessions(status)
idx_output_session   ON session_output(session_id)
idx_output_seq       ON session_output(session_id, sequence_number)
idx_output_type      ON session_output(type)
idx_todos_user       ON todos(user_id)
```

## Migrations

Schema evolution uses two mechanisms:

1. **SQL migration files** in `backend/src/db/migrations/` serve as reference records.
2. **Runtime migrations** in `database.ts` check for missing columns on startup and add them with `ALTER TABLE`. This handles columns like `branch`, `model`, `launch_mode`, and `role` that were added after the initial schema.

The canonical schema is always `backend/src/db/schema.ts`.

## Data retention

A pruning job runs every 60 seconds (`backend/src/services/pruning-job.ts`):

- **Expired sessions**: deletes sessions where `expires_at` has passed.
- **Output pruning**: trims session output that exceeds `outputRetentionMbPerSession` (default: 10 MB per session, configurable in `~/.argus/config.json`).

## Viewing the database

Since the database is a plain SQLite file, you can inspect it directly using any SQLite client.

### Using the `sqlite3` CLI

```bash
sqlite3 ~/.argus/argus.db
```

Once inside the SQLite shell:

```sql
-- List all tables
.tables

-- Show schema for a table
.schema sessions

-- Pretty-print query results
.mode column
.headers on

-- Example queries
SELECT * FROM repositories;
SELECT id, type, status, started_at FROM sessions ORDER BY started_at DESC LIMIT 10;
SELECT COUNT(*) FROM session_output;
```

### Using DB Browser for SQLite (GUI)

[DB Browser for SQLite](https://sqlitebrowser.org/) is a free GUI tool. Open `~/.argus/argus.db` directly from File > Open Database.

### Using the VS Code extension

Install the **SQLite Viewer** or **SQLite Explorer** extension in VS Code, then open the `.db` file from the explorer.

### Important notes

- **Close the Argus server first** (or open the database in read-only mode) to avoid WAL lock contention.
- To open read-only from the CLI: `sqlite3 -readonly ~/.argus/argus.db`
- The WAL journal means you may also see `argus.db-wal` and `argus.db-shm` files alongside the main database. These are normal and managed by SQLite automatically.
