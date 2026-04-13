# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Git Workflow

- After every commit, always run `git push`.
- After creating a local branch, always publish it to the remote (`git push --set-upstream origin <branch>`).
- During implementation, commit after completing each task (use the task ID in the commit message).
- After making any frontend changes, run `npm run build --workspace=frontend` before committing so the served build at port 7411 reflects the changes.

## Writing Style

- **Never use em dashes** (`—`) in any documentation, comments, or content. They are tiresome to read. Use a comma, colon, parentheses, or rewrite the sentence instead.

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

## Shared UI Components

Always reuse the shared components in `frontend/src/components/` instead of writing inline HTML elements. Never create a raw `<button>` or `<input type="checkbox">` when a shared component exists:

- **`Button`**: Use for all buttons. Supports `variant` (primary, danger, ghost, outline) and `size` (sm, md).
- **`Checkbox`**: Use for all checkboxes. Supports an optional `label` prop. Styled to match the TodoPanel checkbox appearance.

If a new UI pattern repeats across two or more locations, extract it into a shared component before duplicating.

## Scripts

All automation is PowerShell (`.ps1`) under `.specify/scripts/powershell/`. VS Code (and Claude's tool execution) auto-approves these scripts.

- `create-new-feature.ps1` — creates a feature branch with spec skeleton (supports `--json`, `--short-name`, `--timestamp`, `--number` flags)
- `common.ps1` — shared helpers: `Find-SpecifyRoot`, `Get-RepoRoot`
- `check-prerequisites.ps1`, `setup-plan.ps1`, `update-agent-context.ps1`

Optional lifecycle hooks (`before_specify`, `after_specify`, etc.) can be defined in `.specify/extensions.yml`.

- `.specify/init-options.json`: `speckit_version: "0.4.3"`, `ai: "claude"`, `script: "ps"`, `branch_numbering: "sequential"`

