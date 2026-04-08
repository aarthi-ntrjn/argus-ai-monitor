# Data Model: Session-to-PID Mapping

## Modified Entity: Session

### Schema Change

Add `pid_source` column to the `sessions` table:

```sql
ALTER TABLE sessions ADD COLUMN pid_source TEXT CHECK(pid_source IN ('session_registry', 'pty_registry', 'lockfile'));
```

### Updated TypeScript Type

```typescript
export interface Session {
  id: string;
  repositoryId: string;
  type: SessionType;              // 'claude-code' | 'copilot-cli'
  launchMode: 'pty' | 'detected' | null;
  pid: number | null;
  pidSource: PidSource | null;    // NEW
  status: SessionStatus;
  startedAt: string;
  endedAt: string | null;
  lastActivityAt: string;
  summary: string | null;
  expiresAt: string | null;
  model: string | null;
}

export type PidSource = 'session_registry' | 'pty_registry' | 'lockfile';
```

### PID Source Values

| Value | Used For | Description |
|-------|----------|-------------|
| `session_registry` | Claude Code (detected) | PID read from `~/.claude/sessions/{PID}.json` |
| `pty_registry` | Claude Code / Copilot CLI (PTY launched) | PID from the Argus launcher's PTY process |
| `lockfile` | Copilot CLI (detected) | PID extracted from `inuse.{PID}.lock` filename |
| `null` | Any | PID not yet resolved |

## New Transient Type: ClaudeSessionRegistryEntry

Not persisted in the database. Read from `~/.claude/sessions/{PID}.json` on each scan.

```typescript
export interface ClaudeSessionRegistryEntry {
  pid: number;
  sessionId: string;
  cwd: string;
  startedAt: number;    // epoch ms
  kind: string;         // "interactive"
  entrypoint: string;   // "cli"
}
```

## State Transitions

### PID Assignment

```
Session created (hook/scan) → pid=null, pidSource=null
  ↓
Registry scan finds {PID}.json matching sessionId
  → pid={value}, pidSource="session_registry"

OR

PTY launcher claims session
  → pid={launcherPid}, pidSource="pty_registry"

OR

Copilot lock file found
  → pid={lockfilePid}, pidSource="lockfile"
```

### Session End Detection (updated)

```
Session with pid != null:
  PID not in process list → status="ended"

Session with pid == null AND age < 60s:
  Skip (grace period for registry file to appear)

Session with pid == null AND age >= 60s:
  JSONL file missing or stale → status="ended"
```

## Database Migration

The migration adds the `pid_source` column. Since SQLite does not support `ALTER TABLE ... ADD COLUMN` with constraints in all versions, use:

```sql
-- Add column (nullable, no constraint initially)
ALTER TABLE sessions ADD COLUMN pid_source TEXT;

-- Backfill existing sessions
UPDATE sessions SET pid_source = 'pty_registry' WHERE launch_mode = 'pty' AND pid IS NOT NULL;
UPDATE sessions SET pid_source = 'lockfile' WHERE type = 'copilot-cli' AND pid IS NOT NULL AND launch_mode IS NULL;
```

The CHECK constraint is enforced at the application layer (TypeScript type), not the database layer, for SQLite compatibility.
