# Data Model: Repository Compare Link and Session Focus Button

## Modified Entity: Repository

### New Field

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `remoteUrl` | `string` | Yes | The URL of the `origin` remote as returned by `git remote get-url origin`. May be SSH or HTTPS format. Null if no remote is configured. |

### SQL Schema Change

```sql
-- Added as runtime migration in database.ts (consistent with existing pattern)
ALTER TABLE repositories ADD COLUMN remote_url TEXT;
```

### Updated SCHEMA_SQL

```sql
CREATE TABLE IF NOT EXISTS repositories (
  id TEXT PRIMARY KEY, path TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
  source TEXT NOT NULL CHECK(source IN ('config','ui')),
  added_at TEXT NOT NULL, last_scanned_at TEXT, branch TEXT, remote_url TEXT
);
```

### TypeScript Type (backend: models/index.ts, frontend: types.ts)

```typescript
export interface Repository {
  id: string;
  path: string;
  name: string;
  source: RepositorySource;
  addedAt: string;
  lastScannedAt: string | null;
  branch: string | null;
  remoteUrl: string | null;   // NEW
}
```

### DB Query Changes (database.ts)

All `SELECT` queries on repositories must include `remote_url as remoteUrl`.
`insertRepository` must include `remote_url`.
New function: `updateRepositoryRemoteUrl(id: string, remoteUrl: string | null): void`.

---

## Derived Client-Side Entity: GitHubCompareLink

Not persisted. Computed in the `RepoCard` component from `repo.remoteUrl` and `repo.branch`.

| Field | Type | Description |
|-------|------|-------------|
| `url` | `string \| null` | Full GitHub compare URL or null if not a GitHub repo |
| `isDefaultBranch` | `boolean` | True when branch is master or main (affects URL shape) |

### URL Construction Logic

```
SSH:   git@github.com:owner/repo.git  → https://github.com/owner/repo
HTTPS: https://github.com/owner/repo.git → https://github.com/owner/repo

If branch is non-default (not master/main):
  compareUrl = `${baseUrl}/compare/${defaultBranch}...${branch}`
Else (on default branch or branch unknown):
  compareUrl = `${baseUrl}/compare`

If remoteUrl does not contain "github.com":
  compareUrl = null  (no link shown)
```

---

## Unchanged Entity: Session

No model changes. The focus feature uses the existing `pid` and `hostPid` fields.

| Existing Field | Used By Focus Feature |
|----------------|-----------------------|
| `pid` | Fallback PID for focus if `hostPid` is null |
| `hostPid` | Primary PID for focus (terminal host process) |
| `status` | Button is disabled when `ended` or `completed` |
