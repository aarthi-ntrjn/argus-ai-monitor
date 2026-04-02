---
description: Validate the current feature branch against the project constitution, fix any gaps, then merge into main and push.
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty). Any text supplied is treated as additional merge notes or override context.

## Outline

You are a senior engineer performing a pre-merge constitution gate check and merge for the current feature branch. Follow these steps precisely.

---

### Step 1 — Identify the feature branch and context

Run `.specify/scripts/powershell/check-prerequisites.ps1 -Json -RequireTasks -IncludeTasks` from the repo root and parse:
- `FEATURE_DIR` — absolute path to the feature spec folder
- Current branch name (from `git branch --show-current`)

If the current branch is `main` or `master`, stop and tell the user: "You are already on the main branch. Checkout a feature branch first."

Record:
- `FEATURE_BRANCH` = current branch name
- `MAIN_BRANCH` = detect by running `git branch --list main master` — use whichever exists; default to `main`

---

### Step 2 — Load the constitution

Read `.specify/memory/constitution.md`. Extract all principles as a checklist. Pay particular attention to the **§X Definition of Done** — these are the mandatory merge gates:

- Code written and reviewed
- Tests written test-first and passing
- Documentation written
- README.md updated to reflect the change
- Metrics and logs added (where applicable to this feature)
- Security reviewed (where applicable)

---

### Step 3 — Run the constitution compliance check

Perform each check below. Record findings as `PASS`, `FAIL`, or `N/A` with evidence.

#### §X Definition of Done

- **Tests passing**: Run the full test suite.
  - Backend: `cd backend && npm test`
  - Frontend: `cd frontend && npm run build` (build must succeed)
  - If tests fail, **STOP** at step 4 and fix them before continuing.

- **README updated**: Check if `README.md` was modified in this branch:
  ```
  git --no-pager diff main..HEAD -- README.md
  ```
  If the diff is empty and the feature added user-facing or architectural changes, mark as **FAIL**.

- **Documentation written**: Confirm that `specs/<feature>/` contains `spec.md`, `plan.md`, and `tasks.md` with tasks marked complete. If any unchecked `[ ]` task items remain, list them.

#### §IV Test-First

- Check that test files exist for new backend/frontend code added in this branch:
  ```
  git --no-pager diff --name-only main..HEAD
  ```
  For each new non-test source file, verify a corresponding test file exists or that tests were added to an existing test file. Mark **FAIL** if new source has zero test coverage.

#### §III Code Standards

- Spot-check new/modified TypeScript/JavaScript files from the diff for functions exceeding 50 lines. Flag any with `WARN`.

#### §XI Documentation

- If any user-facing behaviour changed, README.md MUST be updated (covered above).
- Check that internal docstrings/comments explain *why* not *what* in complex functions.

#### §XII Error Handling

- Check that any new frontend error display uses the `message` field only (not raw response body or HTTP status).
- Check that new backend error responses follow `{ error, message, requestId }` structure.

---

### Step 4 — Fix all FAIL items

For each **FAIL** finding:

1. Describe what is missing and why it violates the constitution.
2. Implement the fix immediately — do not ask permission for constitution-mandated items.
3. After fixing, re-run the relevant check to confirm it now passes.
4. Commit each fix with the message format:
   ```
   fix(merge-gate): <short description of constitution gap addressed>
   
   Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
   ```
   Then push: `git push`

For **WARN** items (style, non-blocking): report them but do not block the merge.

Do not proceed to Step 5 until all **FAIL** items are resolved.

---

### Step 5 — Final pre-merge summary

Output a pre-merge report:

```
## Pre-Merge Constitution Report — <FEATURE_BRANCH>

| Check | Status | Notes |
|-------|--------|-------|
| Tests passing | ✅ PASS | All N tests passed |
| README updated | ✅ PASS / ❌ FIXED / N/A | ... |
| Tasks complete | ✅ PASS | All T### tasks marked [X] |
| Test-first coverage | ✅ PASS | ... |
| Error handling | ✅ PASS | ... |
| Functions < 50 lines | ✅ PASS / ⚠ WARN | ... |

**Result: READY TO MERGE** ✅
```

---

### Step 6 — Merge into main

Execute the merge:

```
git checkout <MAIN_BRANCH>
git pull origin <MAIN_BRANCH>
git merge --no-ff <FEATURE_BRANCH> -m "merge(<FEATURE_BRANCH>): merge feature into <MAIN_BRANCH>

Constitution gate: PASSED
Branch: <FEATURE_BRANCH>

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
git push origin <MAIN_BRANCH>
```

If the merge has conflicts, stop and report: list the conflicting files and ask the user to resolve them manually, then re-run `/merge`.

---

### Step 7 — Report

Output a final merge summary:

- **Branch merged**: `<FEATURE_BRANCH>` → `<MAIN_BRANCH>`
- **Constitution gaps fixed**: list any items that were fixed (or "None")
- **Warnings**: list any WARN items for follow-up
- **Tests**: pass count
- **Next steps**: e.g., delete the feature branch, open a release PR, tag a version
