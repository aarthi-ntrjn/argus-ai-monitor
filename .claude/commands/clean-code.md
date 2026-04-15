---
description: Scan the codebase for dead code, oversized functions, too many parameters, and oversized files. Fix every finding and commit.
---

## User Input

```text
$ARGUMENTS
```

If `$ARGUMENTS` is non-empty, treat it as a scope override — e.g. `backend/src/services` or a specific file path. Otherwise scan the full codebase.

## Outline

You are a senior engineer performing a clean-code audit. Work through each check below, collect all findings, fix every one of them, then commit. Do not ask permission before fixing — these are objective quality violations.

---

### Step 1 — Establish scope

Determine the directories to scan:
- If `$ARGUMENTS` specifies a path, restrict the scan to that path.
- Otherwise scan `backend/src/` and `frontend/src/`.

Exclude:
- `**/*.test.ts`, `**/*.test.tsx`, `**/*.spec.ts`, `**/*.spec.tsx` — test files
- `**/dist/`, `**/node_modules/` — build and vendor output

Record the scope before proceeding.

---

### Step 2 — Dead code

Find code that exists but is never executed.

#### 2a — Unused imports

For each TypeScript/TSX file in scope, check for imports whose identifiers are never referenced in the file body. Use your Read and Grep tools — do not rely solely on TypeScript compiler output.

Flag: any `import` statement (or individual named import) where the imported identifier does not appear outside the import line itself.

#### 2b — Unused exports

For each exported function, class, type, interface, or constant, verify it is imported by at least one other file in the repo (test files count). Use `Grep` to search for the export name across all `.ts` and `.tsx` files excluding the file that defines it.

Flag: any export with zero consumers.

#### 2c — Unreachable code and silent error swallowing

Look for:
- Code after a `return`, `throw`, or `break` statement inside the same block
- Branches whose condition is always `true` or always `false` by inspection (e.g. `if (false)`, `if (x === x)`)
- Empty `catch` blocks (`catch { }` or `catch (e) { }` with no body)
- `catch` blocks that discard the error without surfacing it to the user or logging it
- `try/finally` with no `catch` inside a React event handler (async errors in event handlers are not caught by any global boundary)

Flag each occurrence with file and line number.

#### 2d — Dead files

Identify any `.ts` or `.tsx` file in scope that is never imported by any other file in the project (excluding entry points: `main.tsx`, `server.ts`, `index.ts`). Confirm with `Grep` before flagging.

---

### Step 3 — Function length

The limit is **50 lines** (constitution §III). Count only non-blank, non-comment lines inside the function body.

For each file in scope, read it and identify every function, method, or arrow function whose body exceeds 50 lines.

For each violation:
- Record the function name, file, start line, end line, and current line count.
- Propose a specific refactor: extract a named helper for a cohesive sub-operation (e.g. parsing logic, validation, a loop body). Do not extract arbitrarily — the helper must have a clear single responsibility and a descriptive name.

---

### Step 4 — Parameter count

The limit is **4 parameters**. Functions with 5 or more parameters are a design smell — they typically signal a missing object type or a function doing too many things.

For each function signature in scope with ≥ 5 parameters:
- Record the function name, file, and line number.
- Propose a fix: group related parameters into a named options object or interface. If the parameters are already typed, create a `XxxOptions` or `XxxParams` interface.

---

### Step 5 — File length

The limit is **300 lines**. Files beyond this are hard to navigate and usually contain mixed responsibilities.

For each file in scope that exceeds 300 lines:
- Record the file path and line count.
- Identify the natural split: what distinct responsibilities does the file contain? Propose a concrete split into two or more files with specific names.

---

### Step 6 — Compile findings

Before making any changes, output a findings table:

```
## Clean-Code Findings

### Dead Code
| # | File | Line | Type | Description |
|---|------|------|------|-------------|
| 1 | ... | ... | unused-import | ... |
| 2 | ... | ... | unused-export | ... |
...

### Function Length (> 50 lines)
| # | File | Function | Lines |
|---|------|----------|-------|
...

### Parameter Count (≥ 5 params)
| # | File | Function | Params |
|---|------|----------|--------|
...

### File Length (> 300 lines)
| # | File | Lines | Proposed split |
|---|------|-------|----------------|
...

**Total findings: N**
```

If there are zero findings in a category, say "None found."

---

### Step 7 — Fix all findings

Work through every finding. For each fix:

1. Read the file if not already read.
2. Apply the minimal correct change:
   - **Unused import**: remove the import line (or the specific named import).
   - **Unused export**: remove the export (and the symbol if nothing in the file uses it either).
   - **Unreachable code**: delete the unreachable block.
   - **Silent error swallowing**: add a `catch` block that either calls `setError` / shows a toast (for user-facing async operations) or logs with `console.warn` / `console.error` (for background/non-user-facing operations). Never leave the `catch` body empty.
   - **Dead file**: delete the file with `git rm`.
   - **Function too long**: extract the identified sub-operation into a named helper in the same file (or a new file if it is reusable). Update the original function to call the helper.
   - **Too many parameters**: introduce a named options interface and update the call sites.
   - **File too long**: split into the proposed files. Update all import paths across the repo.
3. After each fix, verify the change compiles (for TypeScript files, check that no new type errors are introduced in the affected file).

Do not refactor beyond what the finding requires. Do not rename symbols, restructure logic, or improve style while fixing a finding.

---

### Step 8 — Verify

Run the full test suite to confirm nothing is broken:

1. `cd backend && npm test` — must pass with zero failures
2. `cd frontend && npm run build` — build must succeed
3. `cd frontend && npx vitest run` — must pass with zero failures

If any step fails, diagnose and fix before proceeding to Step 9. Do not commit broken code.

---

### Step 9 — Commit

Stage all changes and commit:

```
git add -A
git commit -m "chore: clean-code pass — <summary of what was removed/fixed>

<bullet list of the most significant findings fixed>

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
git push
```

The commit message summary should be specific: e.g. `remove 3 unused imports, extract 2 oversized functions` — not just `clean-code pass`.

---

### Step 10 — Report

Output a final summary:

```
## Clean-Code Pass Complete

| Category | Findings | Fixed |
|----------|----------|-------|
| Dead code (imports/exports/files) | N | N |
| Function length violations | N | N |
| Parameter count violations | N | N |
| File length violations | N | N |
| **Total** | **N** | **N** |

### Changes made
- <file>: <what changed>
- ...

Tests: <N> backend + <N> frontend passing.
```
