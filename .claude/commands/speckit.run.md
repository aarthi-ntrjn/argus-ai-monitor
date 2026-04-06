---
description: Run the full Speckit workflow end-to-end — specify, clarify, plan, tasks, analyze, and implement — from a single feature description. Pauses only for interactive clarification Q&A and critical blockers.
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty). This is the feature description — the same input you would pass to `/speckit.specify`.

---

## Overview

This command runs the full Speckit pipeline automatically in order:

```
SPECIFY → CLARIFY → PLAN → TASKS → ANALYZE → IMPLEMENT
```

You MUST complete each phase before starting the next. Do NOT wait for the user to trigger individual phases — proceed automatically. The ONLY times you pause and wait for the user are:

1. **During CLARIFY** — to ask targeted Q&A questions (up to 5).
2. **During ANALYZE** — only if CRITICAL issues are found; ask user whether to fix or proceed.
3. **During IMPLEMENT** — only if checklists have incomplete items; ask user whether to proceed anyway.

After each phase completes, print a clear transition banner:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Phase [N] complete: [PHASE NAME]
→ Starting Phase [N+1]: [NEXT PHASE NAME]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Pre-Execution

Check if `.specify/extensions.yml` exists. If it does, look for `hooks.before_specify`. Execute any mandatory hooks first. Skip optional hooks silently if not opted in. If no hooks file, continue.

---

## Phase 0: RESUME DETECTION (when no description provided)

If `$ARGUMENTS` is empty, do NOT error. Instead, detect the current feature and resume from the correct phase:

1. Run `.specify/scripts/powershell/check-prerequisites.ps1 -Json -IncludeTasks` from repo root. Parse `FEATURE_DIR` and `AVAILABLE_DOCS`.
2. If `FEATURE_DIR` is empty or the script fails, ERROR: "No feature description provided and no in-progress feature detected on this branch. Usage: `/speckit.run <feature description>`"
3. Determine resume phase by checking which artifacts exist (read the files, not just their presence):
   - `tasks.md` exists AND has any incomplete tasks (`- [ ]`): resume at **Phase 6 (IMPLEMENT)**
   - `tasks.md` exists but all tasks are complete: print "All tasks are already complete." and run completion validation (Phase 6 step 7), then exit.
   - `plan.md` exists but `tasks.md` does not: resume at **Phase 4 (TASKS)**
   - `spec.md` exists with status `Clarified` but `plan.md` does not: resume at **Phase 3 (PLAN)**
   - `spec.md` exists but not yet clarified: resume at **Phase 2 (CLARIFY)**
   - Nothing found: ERROR as above
4. Print a resume banner:
   ```
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ↻ Resuming feature: <FEATURE_DIR basename>
   → Starting at Phase [N]: [PHASE NAME]
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ```
5. Skip all earlier phases and jump directly to the detected resume phase.

---

## Phase 1: SPECIFY

**Goal**: Create the feature branch and write `spec.md`.

1. Parse the feature description from `$ARGUMENTS`. If empty, run Phase 0 (RESUME DETECTION) instead of continuing here.

2. Generate a concise short name (2–4 words, action-noun format, e.g. `add-user-auth`) for the feature.

3. Read `.specify/init-options.json`. If `branch_numbering` is `"timestamp"`, add `-Timestamp` flag. Otherwise omit it.

4. Run the branch creation script once:
   ```powershell
   .specify/scripts/powershell/create-new-feature.ps1 -Json -ShortName "<short-name>" "<feature description>"
   ```
   Parse JSON output for `BRANCH_NAME`, `SPEC_FILE`, `FEATURE_DIR`.

5. Load `.specify/templates/spec-template.md`. Load `.specify/memory/constitution.md`.

6. Write `spec.md` to `SPEC_FILE` using the template. Translate the feature description into:
   - Prioritized user stories (P1/P2/P3) with acceptance scenarios and independent test criteria
   - Functional requirements (FR-###), measurable success criteria (SC-###), key entities, assumptions, edge cases
   - Use reasonable defaults; mark critical unknowns with `[NEEDS CLARIFICATION: question]` (max 3)

7. Create spec quality checklist at `FEATURE_DIR/checklists/requirements.md`. Run validation. Fix any failures (max 3 iterations). If `[NEEDS CLARIFICATION]` markers remain, present them to the user in the same Q&A format as the CLARIFY phase below and update the spec with their answers before continuing.

8. Commit: `feat(###): add spec for <feature-name>`.

9. Check `hooks.after_specify`. Execute mandatory hooks if present.

---

## Phase 2: CLARIFY

**Goal**: Detect and resolve remaining ambiguities in `spec.md` before planning.

1. Run `.specify/scripts/powershell/check-prerequisites.ps1 -Json -PathsOnly`. Parse `FEATURE_DIR` and `FEATURE_SPEC`.

2. Load `FEATURE_SPEC`. Perform a structured ambiguity & coverage scan across these taxonomy categories. Build an internal prioritized queue of up to 5 questions (do NOT output the full queue):

   - Functional Scope & Behavior (core goals, out-of-scope, personas)
   - Domain & Data Model (entities, state transitions, identity rules)
   - Interaction & UX Flow (error/empty/loading states, journeys)
   - Non-Functional Quality Attributes (perf, scale, security, observability, compliance)
   - Integration & External Dependencies (external APIs, failure modes, protocols)
   - Edge Cases & Failure Handling (negative scenarios, conflicts, rate limiting)
   - Constraints & Tradeoffs (tech constraints, rejected alternatives)

   Only include questions whose answers materially impact architecture, data modeling, task decomposition, security, or UX. Use (Impact × Uncertainty) heuristic. Ask as many questions as needed — do not cap the count.

3. **Sequential interactive Q&A** (wait for user responses):
   - Present ONE question at a time.
   - For multiple-choice: state your recommendation prominently with reasoning, then render a Markdown options table. Allow the user to reply with a letter, "yes"/"recommended", or a short custom answer (≤5 words).
   - For short-answer: provide a suggested answer with reasoning. User can accept or provide their own.
   - After each answer: record it, update `spec.md` (add `## Clarifications / ### Session YYYY-MM-DD` bullet, apply to relevant section), save immediately.
   - Continue until all meaningful ambiguities are resolved, or the user says "done"/"proceed"/"skip".
   - If no meaningful ambiguities exist, print "No critical ambiguities detected." and continue automatically.

4. Update `spec.md` status to `Clarified`. Commit: `feat(###): clarify spec — <summary of decisions>`.

5. **Auto-continue to Phase 3.**

---

## Phase 3: PLAN

**Goal**: Generate `plan.md`, `research.md`, `data-model.md`, and `contracts/`.

1. Run `.specify/scripts/powershell/setup-plan.ps1 -Json`. Parse `FEATURE_SPEC`, `IMPL_PLAN`, `SPECS_DIR`, `BRANCH`.

2. Load `FEATURE_SPEC` and `.specify/memory/constitution.md`.

3. **Constitution Check** — for each MUST principle, verify the planned approach does not violate it. Document §VI/§VIII exceptions explicitly when applicable. If any violation is unjustifiable, ERROR and halt.

4. Fill `plan.md` (using the copied template) with:
   - Summary, Technical Context (language, deps, storage, testing, platform, project type, perf goals, constraints, scale)
   - Constitution Check table with PASS/FAIL/EXCEPTION per principle
   - Source code project structure (concrete paths, no "Option" labels)
   - Complexity Tracking only if violations need justification

5. **Phase 0 — Research** (`research.md`): For each unknown or decision point, document: Decision, Rationale, Alternatives considered.

6. **Phase 1 — Design**:
   - `data-model.md`: entities, fields, types, relationships, validation rules, state transitions, SQL/type definitions
   - `contracts/`: API endpoint specs (request/response shapes, status codes, error contract `{ error, message, requestId }`, test case table)
   - Run `.specify/scripts/powershell/update-agent-context.ps1 -AgentType copilot`

7. Commit: `feat(###): add plan, research, data-model, contracts`.

8. Check `hooks.after_plan`. Execute mandatory hooks if present.

9. **Auto-continue to Phase 4.**

---

## Phase 4: TASKS

**Goal**: Generate dependency-ordered `tasks.md`.

1. Run `.specify/scripts/powershell/check-prerequisites.ps1 -Json`. Parse `FEATURE_DIR` and available docs.

2. Load `plan.md`, `spec.md`, and any of `data-model.md`, `contracts/`, `research.md` that exist.

3. Generate `tasks.md` organized by user story (in priority order from spec.md):
   - **Phase 1**: Setup (shared infrastructure)
   - **Phase 2**: Foundational (blocking prerequisites — CRITICAL gate)
   - **Phase 3+**: One phase per user story (P1 → P2 → P3…), each with: goal, independent test criteria, test tasks (test-first per §IV), implementation tasks
   - **Final Phase**: Polish & cross-cutting (README update per §XI, full test run, build check)
   - Every task: `- [ ] T### [P?] [US?] Description with exact file path`
   - Mark `[P]` tasks that can run in parallel (different files, no deps)

4. Commit: `feat(###): add tasks`.

5. Check `hooks.after_tasks`. Execute mandatory hooks if present.

6. **Auto-continue to Phase 5.**

---

## Phase 5: ANALYZE

**Goal**: Cross-artifact consistency check across `spec.md`, `plan.md`, `tasks.md`.

1. Run `.specify/scripts/powershell/check-prerequisites.ps1 -Json -RequireTasks -IncludeTasks`. Load spec, plan, tasks, and constitution.

2. Run the following detection passes (read-only — do NOT modify any files):
   - **Duplication**: near-duplicate requirements
   - **Ambiguity**: vague adjectives without measurable criteria, unresolved placeholders
   - **Underspecification**: requirements missing objects/outcomes, tasks referencing undefined components
   - **Constitution Alignment**: any MUST violation
   - **Coverage Gaps**: requirements with zero tasks, tasks with no mapped requirement, buildable SC with no task
   - **Inconsistency**: terminology drift, conflicting entities, task ordering contradictions

3. Assign severity: CRITICAL / HIGH / MEDIUM / LOW.

4. Output the analysis report (findings table, coverage summary, constitution alignment, unmapped tasks, metrics).

5. **Decision gate**:
   - If **no CRITICAL issues**: print "✓ Analysis passed — proceeding to implementation." and auto-continue to Phase 6.
   - If **CRITICAL issues found**: display them clearly and ask the user: "CRITICAL issues found. Do you want to fix them before implementing, or proceed anyway?"
     - If "fix": apply remediation edits to the affected artifacts, then re-run the analysis check before continuing.
     - If "proceed": warn that implementation carries risk of rework, then continue to Phase 6.

6. **Auto-continue to Phase 6.**

---

## Phase 6: IMPLEMENT

**Goal**: Execute all tasks from `tasks.md` and deliver working code.

1. Check `hooks.before_implement`. Execute mandatory hooks if present.

2. Run `.specify/scripts/powershell/check-prerequisites.ps1 -Json -RequireTasks -IncludeTasks`. Parse `FEATURE_DIR` and `AVAILABLE_DOCS`.

3. **Checklist gate**: If `FEATURE_DIR/checklists/` exists and any checklist has incomplete items (`- [ ]`), display the status table and ask: "Some checklists are incomplete. Proceed anyway?" Wait for response. Halt if "no". Continue if "yes".

4. Load `tasks.md` (full task list), `plan.md` (tech stack, file structure), and all available design docs.

5. Verify/update ignore files as needed (.gitignore, .dockerignore, etc.) based on detected project setup.

6. **Execute phase by phase** (complete each before starting the next):
   - For each phase: execute tasks in dependency order; run parallel `[P]` tasks together.
   - **TDD gate**: Test tasks MUST be written first and confirmed failing before implementation tasks in that phase run.
   - Mark each completed task as `[x]` in `tasks.md`.
   - Halt on failure of any non-parallel task; report error with context.
   - Commit after each completed phase: `feat(###): [phase name] - task IDs`.

7. **Completion validation**:
   - All tasks marked `[x]`
   - Tests pass, build succeeds
   - Implementation matches spec

8. Check `hooks.after_implement`. Execute mandatory hooks if present.

9. Print final summary: phases completed, files created/modified, test results, next steps.

---

## Behavior Rules

- **Never skip a phase** — each phase produces artifacts required by the next.
- **Never wait between phases** unless a user-input gate is triggered.
- **Always commit** after each phase with the feature number and a descriptive message.
- **Always push** after each commit (`git push`).
- If `$ARGUMENTS` is empty, run Phase 0 (RESUME DETECTION) — do NOT error immediately. Only error if no in-progress feature is found on the current branch.
- If any script or tool fails, halt with a clear error and the exact command that failed.
- Constitution violations in Phase 5 that cannot be justified MUST block implementation.
