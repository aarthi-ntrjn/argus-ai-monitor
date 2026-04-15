# Contract: Repository Remote URL Field

## Overview

The `remoteUrl` field is added to the `Repository` entity returned by all repository API endpoints.

## Updated GET /api/v1/repositories Response Shape

```json
[
  {
    "id": "uuid",
    "path": "/home/user/projects/my-repo",
    "name": "my-repo",
    "source": "ui",
    "addedAt": "2026-01-01T00:00:00.000Z",
    "lastScannedAt": "2026-01-02T00:00:00.000Z",
    "branch": "feature/my-feature",
    "remoteUrl": "https://github.com/owner/my-repo.git"
  }
]
```

## Updated POST /api/v1/repositories Response Shape

Same as GET, with `remoteUrl` populated from `git remote get-url origin` at registration time.

## remoteUrl Values

| Scenario | Value |
|----------|-------|
| GitHub HTTPS remote | `"https://github.com/owner/repo.git"` |
| GitHub SSH remote | `"git@github.com:owner/repo.git"` |
| GitLab remote | `"https://gitlab.com/owner/repo.git"` |
| No remote configured | `null` |
| `git` command fails | `null` |

## Backwards Compatibility

Existing repositories in the database that predate this feature will have `remoteUrl: null` until the backend is restarted and they are re-scanned, or until a new registration is triggered.

The `remoteUrl` is also refreshed when `updateRepositoryBranch` is called (on periodic scan).
