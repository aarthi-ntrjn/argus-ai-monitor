# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Git Workflow

- After every commit, always run `git push`.
- **Always create branches in the current working directory.** Never `cd` into a different repo folder to create a branch. Branch off the `master` of whichever repo folder you are already working in.
- After creating a local branch, always publish it to the remote (`git push --set-upstream origin <branch>`).
- During implementation, commit after completing each task (use the task ID in the commit message).
- After making any frontend changes, run `npm run build --workspace=frontend` before committing so the served build at port 7411 reflects the changes.

## File Placement

- **Scripts**: All scripts (`.ps1`, `.sh`, `.mjs`, etc.) must go in `scripts/`. The `.specify/scripts/powershell/` folder is strictly reserved for scripts invoked directly by Speckit workflow steps. Do not put application or dev tooling scripts there.
- **Documentation**: All `README-*.md` files must go in `docs/`. The only README at the repo root is `README.md`.

## Writing Style

- **Never use em dashes** (`—`) in any documentation, comments, or content. They are tiresome to read. Use a comma, colon, parentheses, or rewrite the sentence instead.

## Decision Making

- **Always ask before making tradeoff decisions.** If a fix or change has meaningful tradeoffs (security, performance, correctness, maintainability), stop and present the options to the user with a brief explanation of each. Do not pick one unilaterally. Examples: weakening a security check, changing a default behavior, removing a feature, choosing between approaches with different risk profiles.
- **Only modify what the task requires.** Do not make unrelated changes in a file while fixing something else. If you spot something worth improving, raise it explicitly and get confirmation before touching it.

## Debugging

- **Add logs when the root cause is unclear.** If static analysis and code reading have not pinpointed a bug after a reasonable effort, add targeted log statements to the relevant code path, ask the user to reproduce the issue, and use the output to confirm the root cause before making any fix. Remove diagnostic logs after the bug is resolved.

## Error Handling

- **Never swallow errors silently.** Every `catch` block must either surface the error to the user (via `setError`, a toast, etc.) or log it (`console.warn` / `console.error` for non-user-facing errors such as WebSocket parse failures). An empty `catch` block or a `catch` that discards the error object is always a bug.
- **`try/finally` without `catch` is acceptable only when the caller will handle the thrown error.** If the caller is a React event handler (which has no global async error boundary), the error must be caught locally.
- **Frontend: propagate fetch/API errors to the UI.** When an API call fails, set visible error state. Do not let the mutation silently succeed (no-op) from the user's perspective.

## Project Context

Argus is a tool for centrally monitoring and remotely controlling Claude Code and GitHub Copilot sessions. For full project documentation, see [README.md](README.md). For architecture, API reference, and dev setup, see [docs/README-CONTRIBUTORS.md](docs/README-CONTRIBUTORS.md).

## Speckit Workflow

All feature work follows a strict ordered pipeline. **Do not skip steps or reorder them**:

| Command | Purpose |
|---|---|
| `/speckit.specify` | Create/update `spec.md` from a feature description |
| `/speckit.clarify` | Identify ambiguities and encode answers into the spec |
| `/speckit.plan` | Generate `plan.md` with technical design and phases |
| `/speckit.tasks` | Generate dependency-ordered `tasks.md` |
| `/speckit.analyze` | Cross-artifact consistency and quality check |
| `/speckit.implement` | Execute tasks from `tasks.md` |
| `/speckit.checklist` | Generate a domain-specific checklist |
| `/speckit.constitution` | Create/update immutable project principles |
| `/speckit.taskstoissues` | Convert tasks to GitHub Issues |

Earlier phase artifacts are treated as immutable during later phases. Constitution violations found by `/speckit.analyze` are `CRITICAL` findings.

## Feature Artifact Layout

Each feature lives in its own spec directory on a dedicated branch:

```
specs/[###-feature-name]/
  spec.md          # User stories (P1/P2/P3), FR-### requirements, SC-### success criteria
  plan.md          # Tech context, architecture decisions, implementation phases
  research.md      # Phase 0 clarifications
  data-model.md    # Entity definitions
  contracts/       # API/interface contracts
  tasks.md         # Dependency-ordered tasks with phase grouping
  checklists/      # Domain-specific checklists
```

## Key Conventions

**Branches**: Sequential numbering — `001-feature-name`, `002-feature-name`. Use `create-new-feature.ps1` to create new feature branches.

**IDs**: `FR-###` for functional requirements, `SC-###` for success criteria.

**Priorities**: `P1` = MVP critical, `P2` = important, `P3` = nice-to-have.

**Tasks**: `[ID] [P?] [Story] Description` — `[P]` marks tasks that can run in parallel.

**Ambiguities**: Mark with `[NEEDS CLARIFICATION: question]` (max 3 per document). Resolve via `/speckit.clarify` before planning.

**Constitution**: `.specify/memory/constitution.md` uses normative language (MUST/SHOULD) and is **never modified during feature work**.

## Code Quality Rules

**No magic strings**: Any string used as an identifier, event name, log prefix, file path segment, or status value must be a named constant. Do not inline the same string literal in two places. Examples: event names like `session.created`, log tag prefixes like `[CopilotDetector]`, status strings like `ended`.

**No code duplication**: Before writing new logic, grep the codebase for similar patterns. If equivalent logic exists, extract it into a shared utility and call it from both places. Never copy-paste a block and adjust it slightly.

**PID reuse is a real bug**: `process.kill(pid, 0)` only confirms that *a* process with that PID is alive, not that it is the *original* process. PIDs are recycled by the OS. Whenever using `isPidRunning` to decide whether a session is still active, also verify the process identity (e.g., command-line substring match, start time comparison, or a sentinel file the process owns). Failing to do this causes ended sessions to appear alive when a new unrelated process takes the same PID.

**Audit before committing**: When adding or modifying any utility function, event name, or status value, search for existing constants or helpers first. If you introduce a new string that will be used in more than one place, define it as a `const` immediately.

**No unrelated changes**: Only modify code directly required to fix the bug or implement the feature at hand. Do not include speculative improvements, defensive refactors, or "while I'm here" cleanups in the same commit. If a separate issue is worth fixing, raise it explicitly and get confirmation before including it.

## Performance Rules for the Scan Cycle

The scan cycle runs on a tight loop. Any code that touches it must follow these rules proactively. Do not wait for the user to report slowness.

**Process liveness checks**: Never call `psList()` or spawn a PowerShell `Get-CimInstance` just to check if a process is alive. Use `isPidRunning(pid)` from `process-utils.ts` (it uses `process.kill(pid, 0)` which is near-zero cost).

**Skip expensive work for dead sessions**: Before calling `detectYoloModeFromPids` or any PowerShell-backed operation, check `isRunning` first. If the session has ended, skip it entirely.

**Parallelize independent async operations**: Never use a sequential `for...of await` loop when the iterations are independent. Use `Promise.all` instead (e.g., `refreshRepositoryBranches`).

**Tail-read large files**: When scanning log or event files (e.g., `events.jsonl`), read only the tail (last 16KB or ~20 lines). Never read the entire file on every scan cycle.

**Avoid redundant reads**: If a code path already reads a file (e.g., `watchEventsFile` via `readNewLines`), do not add a second read of the same file for the same purpose (e.g., `extractModelFromEventsFile` was redundant and was removed).

**Audit new scanning code before committing**: When writing or modifying any method called from `runScan`, explicitly ask: Does this spawn a process? Does this read a file from position 0? Does it loop sequentially over sessions? Fix those before committing.

## Shared UI Components

Always reuse shared components and CSS classes from `frontend/src/components/` and `frontend/src/index.css`. Before writing any interactive element, check if a shared component covers it. Never reach for a raw HTML element when a shared abstraction exists.

**Components:**

- **`Button`**: Use for every visible-text button. Supports `variant` (primary, danger, ghost, outline) and `size` (sm, md). Never write a raw `<button>` with Tailwind color/border classes to replicate a variant.
- **`Badge`**: Use for every status/label chip (small colored spans with `text-xs px-2 py-0.5 rounded font-medium`). Never inline badge styling.
- **`Checkbox`**: Use for every checkbox. Accepts an optional `label` prop. Never write `<input type="checkbox">` or `<button role="checkbox">` outside the Checkbox component itself.
- **`ToggleIconButton`**: Use for icon-only buttons that have an active/inactive color state based on a boolean. Never write a `<button>` that conditionally applies `text-blue-600` vs `text-gray-500` on an icon.

**CSS component classes (defined in `index.css`):**

- **`icon-btn`**: Add to every icon-only button (SVG or single character, no text label). Remove redundant inline classes it already covers (`rounded-sm`, `transition-colors`, `focus-visible:ring-*`).
- **`interactive-card`**: Add to every `<div>` with `role="button"` or `tabIndex={0}` + `onClick` + border/rounded/cursor styling. Remove redundant inline classes it covers.

**Rule**: If a new UI pattern appears in two or more places, extract it into a shared component before the second use. Do not duplicate Tailwind class combinations that already have a named abstraction.

## Scripts

All automation is PowerShell (`.ps1`) under `.specify/scripts/powershell/`. VS Code (and Claude's tool execution) auto-approves these scripts.

- `create-new-feature.ps1` — creates a feature branch with spec skeleton (supports `--json`, `--short-name`, `--timestamp`, `--number` flags)
- `common.ps1` — shared helpers: `Find-SpecifyRoot`, `Get-RepoRoot`
- `check-prerequisites.ps1`, `setup-plan.ps1`, `update-agent-context.ps1`

Optional lifecycle hooks (`before_specify`, `after_specify`, etc.) can be defined in `.specify/extensions.yml`.

- `.specify/init-options.json`: `speckit_version: "0.4.3"`, `ai: "claude"`, `script: "ps"`, `branch_numbering: "sequential"`

