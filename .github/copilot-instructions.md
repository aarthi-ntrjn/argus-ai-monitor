# Copilot Instructions for Argus

## Project Purpose

Argus is a **Speckit-based specification-driven development (SDD) framework**. The repository contains no application code yet — it is the infrastructure for building the Argus session-monitoring tool (which centrally monitors and remotely controls Claude Code and GitHub Copilot sessions).

All feature work follows a strict spec → plan → tasks → implement pipeline, orchestrated by AI agents.

---

## Speckit Workflow

The 9-step workflow commands (available as Claude slash commands in `.claude/commands/` and as GitHub Copilot agents in `.github/agents/`):

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

**Ordering matters**: `specify` → `clarify` → `plan` → `tasks` → `analyze` → `implement`. Earlier phase artifacts are immutable during later phases.

---

## Repository Structure

```
.specify/
  init-options.json        # Framework config (ai, version, script, branch_numbering)
  memory/constitution.md   # Immutable project principles
  templates/               # Markdown templates for all artifacts
  scripts/powershell/      # Automation scripts (common.ps1, create-new-feature.ps1, etc.)
.claude/commands/          # Claude custom slash commands (9 Speckit commands)
.github/
  agents/                  # GitHub Copilot agent definitions (*.agent.md)
  prompts/                 # System prompts for each agent (*.prompt.md)
.vscode/settings.json      # Auto-approves .specify/scripts/ execution
```

Feature specs are written to `specs/[###-feature-name]/` on a dedicated branch.

---

## Feature Artifact Layout

Each feature lives in `specs/[###-feature-name]/`:

```
spec.md          # User stories (P1/P2/P3), FR-### requirements, SC-### success criteria
plan.md          # Tech context, architecture decisions, implementation phases
research.md      # Phase 0 decisions and clarifications
data-model.md    # Entity definitions
contracts/       # API/interface contracts
tasks.md         # Dependency-ordered tasks with phase grouping
checklists/      # Domain-specific checklists (requirements.md, etc.)
```

---

## Key Conventions

**Branch naming**: `[###-feature-name]` with sequential numbering (e.g., `001-session-monitor`). Controlled by `create-new-feature.ps1`.

**Requirement IDs**: `FR-###` for functional requirements, `SC-###` for success criteria.

**User story priorities**: `P1` = MVP critical, `P2` = important, `P3` = nice-to-have.

**Task format**: `[ID] [P?] [Story] Description` where `[P]` marks parallel-executable tasks.

**Ambiguity markers**: `[NEEDS CLARIFICATION: question]` (max 3 per document) — resolve these with `/speckit.clarify` before proceeding to plan.

**Constitution**: Principles in `.specify/memory/constitution.md` use normative language (MUST/SHOULD) and are **never modified during feature work**. Constitution violations are `CRITICAL` findings in `/speckit.analyze`.

**Scripts**: All automation is PowerShell (`.ps1`). Scripts use `common.ps1` helpers — `Find-SpecifyRoot` and `Get-RepoRoot` — to locate the repo root. VS Code auto-approves execution of scripts under `.specify/scripts/`.

**Extensions**: Optional lifecycle hooks defined in `.specify/extensions.yml` — `before_specify`, `after_specify`, `before_plan`, `after_plan`, `before_tasks`, `after_tasks`, `before_implement`, `after_implement`.

---

## Configuration

- **`.specify/init-options.json`**: `ai: "claude"`, `speckit_version: "0.4.3"`, `branch_numbering: "sequential"`, `script: "ps"` (PowerShell).
- **`.vscode/settings.json`**: Auto-approves `.specify/scripts/powershell/` and `.specify/scripts/bash/` for Claude's tool execution.
- **`.gitignore`**: Excludes `.claude/` and `.github/copilot/` credential folders from source control.
