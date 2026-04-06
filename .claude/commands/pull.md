---
description: Fetch the latest changes from the main branch and merge them into the current feature branch. Resolve any conflicts automatically using AI judgment.
---

## User Input

```text
$ARGUMENTS
```

Optional. Any text supplied is treated as additional context or hints for resolving conflicts (e.g. "prefer our version of the config file").

## Outline

You are a senior engineer pulling the latest changes from main into the current feature branch. Follow these steps precisely.

---

### Step 1 — Identify branches

Run:
```
git branch --show-current
git branch --list main master
```

Record:
- `CURRENT_BRANCH` = current branch name
- `MAIN_BRANCH` = whichever of `main` / `master` exists; default to `main`

If `CURRENT_BRANCH` equals `MAIN_BRANCH`, stop and tell the user: "You are already on the main branch. Nothing to pull into."

---

### Step 2 — Fetch latest from remote

```
git fetch origin
```

Check whether the main branch has any new commits ahead of the current branch:
```
git --no-pager log HEAD..origin/<MAIN_BRANCH> --oneline
```

If there are no new commits, tell the user: "Already up to date — no new commits on `<MAIN_BRANCH>`." and stop.

Otherwise report how many commits are incoming (e.g. "Merging 4 commits from `main`").

---

### Step 3 — Merge main into the current branch

Run:
```
git merge origin/<MAIN_BRANCH> --no-edit -m "chore: merge origin/<MAIN_BRANCH> into <CURRENT_BRANCH>

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
   (incoming version from main)
   >>>>>>> origin/<MAIN_BRANCH>
   ```

2. Resolve using this judgment:
   - If the conflict is in generated or config files (lock files, build output), **prefer the incoming (main) version**.
   - If the conflict is in feature code the current branch intentionally added, **prefer the current branch version**, unless main's change is a clear improvement or bug fix.
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
git commit --no-edit -m "chore: merge origin/<MAIN_BRANCH> into <CURRENT_BRANCH> (conflicts resolved)

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Step 5 — Push the updated branch

```
git push origin <CURRENT_BRANCH>
```

---

### Step 6 — Report

Output a concise summary:

```
## Pull complete

- Branch: <CURRENT_BRANCH>
- Merged: origin/<MAIN_BRANCH>
- Commits pulled: N
- Conflicts resolved: N files (list them) / None
- Pushed: ✅
```

If any conflict resolutions involved judgment calls, list the file and the choice made so the user can review them.
