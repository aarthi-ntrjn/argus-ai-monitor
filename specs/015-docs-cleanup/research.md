# Research: Engineering Documentation Cleanup

## Decision 1: No Automated Testing for Doc Changes

**Decision**: Human review only — no automated link checkers or linting tools added.  
**Rationale**: This is a one-time cleanup branch, not a recurring pipeline. Adding tooling would over-engineer the scope.  
**Alternatives considered**: `markdownlint`, `markdown-link-check` — rejected as out of scope for this feature.

## Decision 2: Engineer-Defined Tasks

**Decision**: The engineer writes their own tasks in `tasks.md` rather than having the AI generate them.  
**Rationale**: The engineer has the context to know which docs need attention. AI-generated tasks would require re-review anyway.  
**Alternatives considered**: AI-scanned doc audit — rejected; engineer prefers direct control.

## Decision 3: No data-model.md or contracts/

**Decision**: Skip data-model.md and contracts/ artifacts for this feature.  
**Rationale**: Documentation cleanup has no entities, APIs, or interface contracts.
