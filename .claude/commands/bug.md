---
description: Add a bug task to tasks.md, investigate root cause, implement the fix, and commit — all in one step.
---

## User Input

```text
$ARGUMENTS
```

The text after `/bug` is the bug description. You **MUST** use it. Do not proceed if it is empty — ask the user to describe the bug.

## Outline

You are a senior engineer triaging and fixing a bug in this codebase. Follow these steps precisely:

---

### Step 1 — Investigate

Read the bug description from `$ARGUMENTS` and investigate the codebase to understand the root cause:

1. Identify which files are most likely involved based on the description
2. Read the relevant source files
3. Form a clear, specific hypothesis for the root cause (not just symptoms)
4. Note the exact files and lines that need to change

Do **not** skip this step. The task description you write must reflect the actual root cause.

---

### Step 2 — Determine next task ID

Read `specs/001-session-dashboard/tasks.md` and find the highest existing task number (e.g. T072). The new task ID is that number + 1.

---

### Step 3 — Add the task to tasks.md

Append a new addendum section at the bottom of the task list (just before the `**Checkpoint**` line) in this format:

```
### Addendum: Bug — [short description]

- [ ] T### [root cause summary and exact fix]: describe what is broken, why, and precisely what code changes are needed including file paths
```

The task description must be specific enough that any engineer could implement it without reading additional context. Include:
- The broken behaviour
- The root cause (file, function, line if known)
- The exact fix (what to change and how)

Commit the tasks.md change:
```
git add specs/001-session-dashboard/tasks.md
git commit -m "feat(tasks): add T### bug <short description>\n\nCo-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
git push
```

---

### Step 4 — Implement the fix

Make the code changes identified in Step 1. Rules:
- Make **only** the changes needed to fix this bug — no refactoring, no unrelated cleanup
- If the fix touches shared functions, ensure callers are still compatible
- Add or update a unit/integration test that would have caught this bug if it existed before

---

### Step 5 — Verify

Run the backend test suite:
```
cd backend && npm test
```

All tests must pass. If they fail, fix the failure before proceeding.

If the fix involves frontend changes, also run:
```
cd frontend && npm run build
```

Build must succeed with no errors.

---

### Step 6 — Commit and mark done

1. Mark the task as `[X]` in `specs/001-session-dashboard/tasks.md`
2. Commit all changed files:
   ```
   git add <files>
   git commit -m "fix(T###): <short description of fix>

   Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
   git push
   ```

---

### Step 7 — Report

Summarise what was done:
- **Bug**: what the symptom was
- **Root cause**: what was actually wrong
- **Fix**: what was changed (files + brief description)
- **Tests**: pass/fail status
