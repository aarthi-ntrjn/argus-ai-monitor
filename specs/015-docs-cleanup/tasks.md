# Tasks: Engineering Documentation Cleanup

**Branch**: `015-docs-cleanup`  
**Input**: Design documents from `/specs/015-docs-cleanup/`  
**Scope**: Rename `BUG-LEARNINGS.md` → `README-LEARNINGS.md` and update all references.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (independent files, no deps on incomplete tasks)
- **[US1]**: User Story 1 — Review and update existing docs (P1)

---

## Phase 1: Setup

- [ ] T001 Confirm branch `015-docs-cleanup` is checked out (`git status`)

---

## Phase 2: Foundational

- [ ] T002 Verify `BUG-LEARNINGS.md` exists at repo root `C:\source\github\artynuts\argus2\BUG-LEARNINGS.md`

---

## Phase 3: User Story 1 — Rename file and update all references

**Goal**: `BUG-LEARNINGS.md` is gone; `README-LEARNINGS.md` exists with identical content; no file in the repo refers to the old name.

**Independent Test**: `git ls-files | grep -i BUG-LEARNINGS` returns nothing; `README-LEARNINGS.md` exists; all references in `.claude/commands/bug.md` and `specs/015-docs-cleanup/plan.md` use the new name.

- [ ] T003 [US1] Rename `BUG-LEARNINGS.md` → `README-LEARNINGS.md` at repo root using `git mv BUG-LEARNINGS.md README-LEARNINGS.md`
- [ ] T004 [P] [US1] Update `.claude/commands/bug.md` — replace all 4 occurrences of `BUG-LEARNINGS.md` with `README-LEARNINGS.md` (lines 100, 102, 117, 147)
- [ ] T005 [P] [US1] Update `specs/015-docs-cleanup/plan.md` — replace `BUG-LEARNINGS.md` with `README-LEARNINGS.md` in the project structure listing

---

## Phase 4: Polish

- [ ] T006 Verify no remaining references: run `grep -ri "BUG-LEARNINGS" .` from repo root — expect zero results
- [ ] T007 Commit all changes: `git add -A && git commit -m "docs(015): rename BUG-LEARNINGS.md to README-LEARNINGS.md and update all references"`
- [ ] T008 Push branch: `git push`

---

## Dependencies

```
T001 → T002 → T003 → T004 [P] ─┐
                      T005 [P] ─┴→ T006 → T007 → T008
```

T004 and T005 are independent of each other (different files) and can run in parallel after T003.

## Implementation Strategy

MVP = complete all tasks T001–T008 in one pass. No incremental delivery needed — this is a single atomic rename operation.

