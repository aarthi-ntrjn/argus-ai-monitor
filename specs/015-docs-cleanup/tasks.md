# Tasks: Engineering Documentation Cleanup

**Branch**: `015-docs-cleanup`  
**Input**: Design documents from `/specs/015-docs-cleanup/`  
**Scope**:
1. Rename `BUG-LEARNINGS.md` → `README-LEARNINGS.md` and update all references.
2. Rename `MANUAL-TESTS.md` → `README-MANUAL-TESTS.md` and update all references.
3. Create `docs/` folder and move all `README-*.md` files into it; fix all references.

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

## Phase 5: User Story 1 — Rename MANUAL-TESTS.md and update all references

**Goal**: `MANUAL-TESTS.md` is gone; `README-MANUAL-TESTS.md` exists with identical content; no file in the repo refers to the old name.

**Independent Test**: `git ls-files | grep -i MANUAL-TESTS` returns only `README-MANUAL-TESTS.md`; reference in `specs/015-docs-cleanup/plan.md` uses the new name.

- [ ] T009 [US1] Rename `MANUAL-TESTS.md` → `README-MANUAL-TESTS.md` at repo root using `git mv MANUAL-TESTS.md README-MANUAL-TESTS.md`
- [ ] T010 [US1] Update `specs/015-docs-cleanup/plan.md` — replace `MANUAL-TESTS.md` with `README-MANUAL-TESTS.md` in the project structure listing

---

## Phase 6: Polish

- [ ] T011 Verify no remaining references to old names: run `grep -ri "BUG-LEARNINGS\|MANUAL-TESTS" .` from repo root — expect zero results
- [ ] T012 Commit rename changes: `git add -A && git commit -m "docs(015): rename MANUAL-TESTS.md to README-MANUAL-TESTS.md and update all references"`
- [ ] T013 Push branch: `git push`

---

## Phase 7: User Story 2 — Create docs/ folder and move all README-*.md files

> **Depends on**: T003 (README-LEARNINGS.md exists) and T009 (README-MANUAL-TESTS.md exists) completing first.

**Goal**: `docs/` folder exists at repo root containing all four `README-*.md` files; no `README-*.md` files remain at the repo root; all references across the repo point to `docs/README-*.md`.

**Independent Test**: `git ls-files | grep "^README-"` returns nothing (except `README.md`); `git ls-files docs/` lists all four files; `grep -ri "README-" . --include="*.md"` shows only `docs/` paths and `README.md` itself.

- [ ] T014 [US2] Create `docs/` directory at repo root: `mkdir docs`
- [ ] T015 [P] [US2] Move `README-ARCH.md` → `docs/README-ARCH.md` using `git mv README-ARCH.md docs/README-ARCH.md`
- [ ] T016 [P] [US2] Move `README-TESTS.md` → `docs/README-TESTS.md` using `git mv README-TESTS.md docs/README-TESTS.md`
- [ ] T017 [P] [US2] Move `README-LEARNINGS.md` → `docs/README-LEARNINGS.md` using `git mv README-LEARNINGS.md docs/README-LEARNINGS.md`
- [ ] T018 [P] [US2] Move `README-MANUAL-TESTS.md` → `docs/README-MANUAL-TESTS.md` using `git mv README-MANUAL-TESTS.md docs/README-MANUAL-TESTS.md`
- [ ] T019 [US2] Update `specs/015-docs-cleanup/plan.md` — prefix all four `README-*.md` entries in the project structure listing with `docs/` (e.g. `docs/README-ARCH.md`)
- [ ] T020 [US2] Update `.claude/commands/bug.md` — replace all occurrences of `README-LEARNINGS.md` with `docs/README-LEARNINGS.md` (4 occurrences on lines updated by T004)

---

## Phase 8: Polish

- [ ] T021 Verify no root-level README-*.md files remain (except README.md): `git ls-files | grep "^README-" | grep -v "^README\.md"` — expect zero results
- [ ] T022 Verify no stale references: `grep -ri "README-ARCH\|README-TESTS\|README-LEARNINGS\|README-MANUAL-TESTS" . --include="*.md"` — all matches should show `docs/` prefix
- [ ] T023 Commit: `git add -A && git commit -m "docs(015): create docs/ folder and move all README-*.md files into it"`
- [ ] T024 Push: `git push`

---

## Dependencies

```
T001 → T002 → T003 → T004 [P] ─┐
                      T005 [P] ─┴→ T006–T008 (Phase 4 polish, removed)

T009 → T010 → T011 → T012 → T013

T003 ─┐
T009 ─┴→ T014 → T015 [P] ─┐
              T016 [P] ─┤
              T017 [P] ─┤
              T018 [P] ─┴→ T019 → T020 → T021 → T022 → T023 → T024
```

- T015–T018 are all parallel to each other (each moves a different file).
- T019 and T020 are independent of each other (different files) and can be done in parallel after T018.
- The entire Phase 7 block depends on T003 and T009 completing first.

## Implementation Strategy

1. Complete Phase 3 (rename BUG-LEARNINGS → README-LEARNINGS) — T003–T005, commit
2. Complete Phase 5 (rename MANUAL-TESTS → README-MANUAL-TESTS) — T009–T010, commit
3. Complete Phase 6 (polish/verify renames) — T011–T013
4. Complete Phase 7 (move all to docs/) — T014–T020, commit
5. Complete Phase 8 (verify + final commit) — T021–T024

