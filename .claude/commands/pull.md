---
description: Fetch the latest changes from the parent branch and merge them into the current feature branch. Resolve any conflicts automatically using AI judgment.
---

## User Input

```text
$ARGUMENTS
```

Optional. Any text supplied is treated as additional context or hints for resolving conflicts (e.g. "prefer our version of the config file").

## Outline

You are a senior engineer pulling the latest changes from the parent branch into the current feature branch. Follow these steps precisely.

---

### Step 1 — Identify branches

Run:
```
git branch --show-current
git rev-parse --abbrev-ref @{upstream} 2>/dev/null || echo ""
git branch --list main master
```

Record:
- `CURRENT_BRANCH` = current branch name
- `UPSTREAM` = the tracking upstream from `@{upstream}` (e.g. `origin/master`). Strip the remote prefix to get `PARENT_BRANCH` (e.g. `master`). If `@{upstream}` is not set, fall back to whichever of `main` / `master` exists.
- `REMOTE` = the remote portion of the upstream (e.g. `origin`). Default to `origin` if not set.

If `CURRENT_BRANCH` equals `PARENT_BRANCH`, sync the parent branch with its remote instead:

```
git fetch <REMOTE>
git --no-pager log HEAD...<REMOTE>/<PARENT_BRANCH> --oneline
```

If there are no new commits, tell the user: "Already up to date — no new commits on `<PARENT_BRANCH>`." and stop.

Otherwise run:
```
git merge --ff-only <REMOTE>/<PARENT_BRANCH>
git push <REMOTE> <PARENT_BRANCH>
```

Then report:
```
## Pull complete

- Branch: <PARENT_BRANCH> (synced)
- Commits pulled: N
- Pushed: ✅
```

And stop.

---

### Step 2 — Fetch latest from remote

```
git fetch <REMOTE>
```

Check whether the parent branch has any new commits ahead of the current branch:
```
git --no-pager log HEAD..<REMOTE>/<PARENT_BRANCH> --oneline
```

If there are no new commits, tell the user: "Already up to date — no new commits on `<PARENT_BRANCH>`." and stop.

Otherwise report how many commits are incoming (e.g. "Merging 4 commits from `master`").

---

### Step 3 — Merge parent into the current branch

Run:
```
git merge <REMOTE>/<PARENT_BRANCH> --no-edit -m "chore: merge <REMOTE>/<PARENT_BRANCH> into <CURRENT_BRANCH>

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

If the merge exits cleanly (exit code 0), skip to Step 5.

---

### Step 4 — Resolve conflicts (if any)

If the merge produced conflicts, find all conflicting files:
```
git diff --name-only --diff-filter=U
```

For **each** conflicting file:

1. Read the file contents. Conflict markers look like:
   ```
   <<<<<<< HEAD
   (current branch version)
   =======
   (incoming version from parent)
   >>>>>>> <REMOTE>/<PARENT_BRANCH>
   ```

2. Resolve using this judgment:
   - If the conflict is in generated or config files (lock files, build output), **prefer the incoming (parent) version**.
   - If the conflict is in feature code the current branch intentionally added, **prefer the current branch version**, unless the parent's change is a clear improvement or bug fix.
   - If both sides changed the same section in compatible ways (e.g. both added imports or entries to a list), **merge both** so neither change is lost.
   - Use any user-supplied context from `$ARGUMENTS` as an override hint.

3. Write the resolved content back to the file (no conflict markers remaining).

4. Stage the resolved file:
   ```
   git add <file>
   ```

After all conflicts are resolved, complete the merge:
```
git -c core.editor=true merge --continue
```

Commit the merge with:
```
git commit --no-edit -m "chore: merge <REMOTE>/<PARENT_BRANCH> into <CURRENT_BRANCH> (conflicts resolved)

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Step 5 — Push the updated branch

```
git push <REMOTE> <CURRENT_BRANCH>
```

---

### Step 6 — Report

Output a concise summary:

```
## Pull complete

- Branch: <CURRENT_BRANCH>
- Merged: <REMOTE>/<PARENT_BRANCH>
- Commits pulled: N
- Conflicts resolved: N files (list them) / None
- Pushed: ✅
```

If any conflict resolutions involved judgment calls, list the file and the choice made so the user can review them.
