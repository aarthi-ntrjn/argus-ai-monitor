---
description: Scan the codebase for coding style violations (em dashes, etc.), fix every finding, and commit.
---

## User Input

```text
$ARGUMENTS
```

If `$ARGUMENTS` is non-empty, treat it as a scope override (e.g. `backend/src/services` or a specific file path). Otherwise scan the full codebase.

## Outline

You are a senior engineer performing a coding-style audit. Work through each check below, collect all findings, fix every one of them, then commit. Do not ask permission before fixing: these are objective style violations established by project convention.

---

### Step 1: Establish scope

Determine the directories to scan:
- If `$ARGUMENTS` specifies a path, restrict the scan to that path.
- Otherwise scan all source, documentation, and configuration files:
  - `backend/src/`
  - `frontend/src/`
  - `docs/`
  - `*.md` in the repo root (README.md, CLAUDE.md, etc.)
  - `specs/`

Exclude:
- `**/node_modules/`, `**/dist/`, `**/build/` (vendor and build output)
- `**/.git/` (version control internals)
- Binary files, images, lock files (`package-lock.json`)

Record the scope before proceeding.

---

### Step 2: Check for violations

Work through each rule. Use Grep and Read tools to find violations. Record every finding.

#### Rule 1: No em dashes

Em dashes (`—`, Unicode U+2014) and en dashes (`–`, Unicode U+2013) must never appear anywhere in the project:
- Source code (comments, string literals, template literals, JSX text content)
- UI control labels, placeholder text, tooltip text, and aria-labels
- Documentation files (Markdown, plain text)
- Commit messages and changelogs

**How to detect**: Search all in-scope files for the literal characters `—` (U+2014) and `–` (U+2013).

**How to fix**: Replace with a comma, colon, semicolon, parentheses, or rewrite the sentence. Choose whichever reads most naturally. Examples:

| Before | After |
|--------|-------|
| `Sessions — both active and idle — are shown` | `Sessions (both active and idle) are shown` |
| `Click to retry — the request timed out` | `Click to retry: the request timed out` |
| `Built with React — a modern UI library` | `Built with React, a modern UI library` |
| `Pages 1–10` | `Pages 1-10` |

---

### Step 3: Compile findings

Before making any changes, output a findings table:

```
## Coding-Style Findings

### Rule 1: No em dashes
| # | File | Line | Content |
|---|------|------|---------|
| 1 | ... | ... | ...snippet showing the em/en dash in context... |
...

**Total findings: N**
```

If there are zero findings in a category, say "None found."

---

### Step 4: Fix all findings

Work through every finding. For each fix:

1. Read the file if not already read.
2. Apply the minimal correct change: replace the em dash or en dash with appropriate punctuation.
3. Do not restructure surrounding code or documentation beyond what the fix requires.
4. After each fix, note the change.

---

### Step 5: Verify

Run the full test suite to confirm nothing is broken:

1. `cd backend && npm test` (must pass with zero failures)
2. `cd frontend && npm run build` (build must succeed)
3. `cd frontend && npx vitest run` (must pass with zero failures)

If any step fails, diagnose and fix before proceeding.

---

### Step 6: Commit

Stage all changes and commit:

```
git add -A
git commit -m "style: coding-style pass — <summary of what was fixed>

<bullet list of findings fixed>

Co-Authored-By: Claude <noreply@anthropic.com>"
git push
```

The commit message summary should be specific, e.g. `replace 5 em dashes across docs and source`, not just `style fixes`.

---

### Step 7: Report

Output a final summary:

```
## Coding-Style Pass Complete

| Rule | Findings | Fixed |
|------|----------|-------|
| No em dashes | N | N |
| **Total** | **N** | **N** |

### Changes made
- <file>: <what changed>
- ...

Tests: <N> backend + <N> frontend passing.
```
