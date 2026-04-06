# Tasks: Engineering Documentation Cleanup

**Branch**: `015-docs-cleanup`  
**Input**: Design documents from `/specs/015-docs-cleanup/`  
**Scope**:
1. Rename `BUG-LEARNINGS.md` → `README-LEARNINGS.md` and update all references.
2. Rename `MANUAL-TESTS.md` → `README-MANUAL-TESTS.md` and update all references.
3. Create `docs/` folder and move all `README-*.md` files into it; fix all references.
4. Restructure `README.md` to be user-focused with clear Monitor and Control sections; move contributor content to `docs/README-CONTRIBUTORS.md`.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (independent files, no deps on incomplete tasks)
- **[US1]**: User Story 1 — Review and update existing docs (P1)

---

## Phase 1: Setup

- [x] T001 Confirm branch `015-docs-cleanup` is checked out (`git status`)

---

## Phase 2: Foundational

- [x] T002 Verify `BUG-LEARNINGS.md` exists at repo root `C:\source\github\artynuts\argus2\BUG-LEARNINGS.md`

---

## Phase 3: User Story 1 — Rename file and update all references

**Goal**: `BUG-LEARNINGS.md` is gone; `README-LEARNINGS.md` exists with identical content; no file in the repo refers to the old name.

**Independent Test**: `git ls-files | grep -i BUG-LEARNINGS` returns nothing; `README-LEARNINGS.md` exists; all references in `.claude/commands/bug.md` and `specs/015-docs-cleanup/plan.md` use the new name.

- [x] T003 [US1] Rename `BUG-LEARNINGS.md` → `README-LEARNINGS.md` at repo root using `git mv BUG-LEARNINGS.md README-LEARNINGS.md`
- [x] T004 [P] [US1] Update `.claude/commands/bug.md` — replace all 4 occurrences of `BUG-LEARNINGS.md` with `README-LEARNINGS.md` (lines 100, 102, 117, 147)
- [x] T005 [P] [US1] Update `specs/015-docs-cleanup/plan.md` — replace `BUG-LEARNINGS.md` with `README-LEARNINGS.md` in the project structure listing

---

## Phase 5: User Story 1 — Rename MANUAL-TESTS.md and update all references

**Goal**: `MANUAL-TESTS.md` is gone; `README-MANUAL-TESTS.md` exists with identical content; no file in the repo refers to the old name.

**Independent Test**: `git ls-files | grep -i MANUAL-TESTS` returns only `README-MANUAL-TESTS.md`; reference in `specs/015-docs-cleanup/plan.md` uses the new name.

- [x] T009 [US1] Rename `MANUAL-TESTS.md` → `README-MANUAL-TESTS.md` at repo root using `git mv MANUAL-TESTS.md README-MANUAL-TESTS.md`
- [x] T010 [US1] Update `specs/015-docs-cleanup/plan.md` — replace `MANUAL-TESTS.md` with `README-MANUAL-TESTS.md` in the project structure listing

---

## Phase 6: Polish

- [x] T011 Verify no remaining references to old names: run `grep -ri "BUG-LEARNINGS\|MANUAL-TESTS" .` from repo root — expect zero results
- [x] T012 Commit rename changes: `git add -A && git commit -m "docs(015): rename MANUAL-TESTS.md to README-MANUAL-TESTS.md and update all references"`
- [x] T013 Push branch: `git push`

---

## Phase 7: User Story 2 — Create docs/ folder and move all README-*.md files

> **Depends on**: T003 (README-LEARNINGS.md exists) and T009 (README-MANUAL-TESTS.md exists) completing first.

**Goal**: `docs/` folder exists at repo root containing all four `README-*.md` files; no `README-*.md` files remain at the repo root; all references across the repo point to `docs/README-*.md`.

**Independent Test**: `git ls-files | grep "^README-"` returns nothing (except `README.md`); `git ls-files docs/` lists all four files; `grep -ri "README-" . --include="*.md"` shows only `docs/` paths and `README.md` itself.

- [x] T014 [US2] Create `docs/` directory at repo root: `mkdir docs`
- [x] T015 [P] [US2] Move `README-ARCH.md` → `docs/README-ARCH.md` using `git mv README-ARCH.md docs/README-ARCH.md`
- [x] T016 [P] [US2] Move `README-TESTS.md` → `docs/README-TESTS.md` using `git mv README-TESTS.md docs/README-TESTS.md`
- [x] T017 [P] [US2] Move `README-LEARNINGS.md` → `docs/README-LEARNINGS.md` using `git mv README-LEARNINGS.md docs/README-LEARNINGS.md`
- [x] T018 [P] [US2] Move `README-MANUAL-TESTS.md` → `docs/README-MANUAL-TESTS.md` using `git mv README-MANUAL-TESTS.md docs/README-MANUAL-TESTS.md`
- [x] T019 [US2] Update `specs/015-docs-cleanup/plan.md` — prefix all four `README-*.md` entries in the project structure listing with `docs/` (e.g. `docs/README-ARCH.md`)
- [x] T020 [US2] Update `.claude/commands/bug.md` — replace all occurrences of `README-LEARNINGS.md` with `docs/README-LEARNINGS.md` (4 occurrences on lines updated by T004)

---

## Phase 8: Polish

- [x] T021 Verify no root-level README-*.md files remain (except README.md): `git ls-files | grep "^README-" | grep -v "^README\.md"` — expect zero results
- [x] T022 Verify no stale references: `grep -ri "README-ARCH\|README-TESTS\|README-LEARNINGS\|README-MANUAL-TESTS" . --include="*.md"` — all matches should show `docs/` prefix
- [x] T023 Commit: `git add -A && git commit -m "docs(015): create docs/ folder and move all README-*.md files into it"`
- [x] T024 Push: `git push`

---

## Phase 9: User Story 2 — README.md user-focused restructure

> **Depends on**: Phase 8 complete (docs/ folder exists with all README-*.md files).

**Goal**: `README.md` is written for users of Argus with clear **Monitor** and **Control** sections. All developer/contributor-facing content (API reference, Security Model, CI & Supply Chain, tech stack, developer-only settings/onboarding notes) is moved to `docs/README-CONTRIBUTORS.md`. `README.md` ends with a brief link to that file.

**Independent Test**: `README.md` contains `## Monitor` and `## Control` headings and no `## API`, `## Security Model`, `## CI & Supply Chain`, or `## Tech stack` sections; `docs/README-CONTRIBUTORS.md` exists and contains all removed content.

- [x] T025 [US2] Create `docs/README-CONTRIBUTORS.md` — extract contributor-facing content from `README.md`: API reference table, Security Model section, CI & Supply Chain section (both workflows + pipeline details + failure responses), Tech stack line, "Adding a new setting (developers)" subsection from Dashboard Settings, "Developer reset" code snippet and `data-tour-id` selector note from Onboarding. Preserve all original content exactly in the new file, with an introductory heading `# Argus: Contributor Guide`.
- [x] T026 [US2] Rewrite `README.md` to be user-focused in `README.md`: (1) Replace the flat `## What it does` bullet list with two new sections: `## Monitor` (covering session cards, two-pane output view, role-labelled output, model badge, last output preview, auto-detection) and `## Control` (covering quick commands, inline prompt, repository management); each section gets a one-line intro sentence before its subsections. (2) Remove the contributor-facing sections extracted to T025 (API, Security Model, CI & Supply Chain, Tech stack). (3) Trim "Adding a new setting" from Dashboard Settings; trim developer reset snippet and `data-tour-id` note from Onboarding. (4) Add a `## For Contributors` footer section: `See [docs/README-CONTRIBUTORS.md](docs/README-CONTRIBUTORS.md) for API reference, security model, CI pipeline, and development guides.`
- [x] T027 [P] [US2] Update `specs/015-docs-cleanup/plan.md` — add `docs/README-CONTRIBUTORS.md` to the project structure listing.

---

## Phase 10: Polish

- [x] T028 Verify `README.md` contains `## Monitor` and `## Control` headings and does NOT contain `## API`, `## Security Model`, `## CI & Supply Chain`, or `## Tech stack` headings
- [x] T029 Verify `docs/README-CONTRIBUTORS.md` exists and contains the API table, Security Model table, and CI & Supply Chain section
- [x] T030 Commit: `git add -A && git commit -m "docs(015): restructure README.md for users; move contributor content to README-CONTRIBUTORS.md"`
- [x] T031 Push: `git push`

---

---

## Phase 11: Doc Review

**Goal**: Every document in `docs/` and `README.md` has been read and confirmed accurate, complete, and consistent.

- [ ] T032 Review `README.md` — verify quickstart steps work, all feature sections reflect current UI, links to docs/ are correct
- [ ] T033 Review `docs/README-CONTRIBUTORS.md` — verify architecture description, dev setup steps, project structure, API reference table, security model, and CI section are all current
- [ ] T034 Review `docs/README-ARCH.md` — verify the Mermaid diagram and design decisions match the current implementation
- [ ] T035 Review `docs/README-TESTS.md` — verify all test commands are accurate and both E2E tiers are documented correctly
- [ ] T036 Review `docs/README-MANUAL-TESTS.md` — verify manual test scenarios reflect current features and UI
- [ ] T037 Review `docs/README-LEARNINGS.md` — verify all bug learning entries are accurate and no entries reference outdated code paths
- [ ] T038 Review `docs/README-CLI-COMPARISON.md` — verify stream schemas, example messages, state diagrams, and data availability tables match current implementation
- [ ] T039 Review `docs/README-GTM.md` — review and update go-to-market decisions and OpenClaw comparison table
- [ ] T040 Review `docs/README-DEVLOG.md` — verify day-by-day log is complete and retrospective sections are accurate
- [ ] T041 Commit any corrections found during review

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

T024 → T025 → T026 → T027 [P]
                    ─┴→ T028 → T029 → T030 → T031
```

- T015–T018 are all parallel to each other (each moves a different file).
- T019 and T020 are independent of each other (different files) and can be done in parallel after T018.
- The entire Phase 7 block depends on T003 and T009 completing first.
- T025 must complete before T026 (README-CONTRIBUTORS.md must exist before README.md removes that content).
- T027 is independent of T026 (different file) and can run in parallel.

## Implementation Strategy

1. Complete Phase 3 (rename BUG-LEARNINGS → README-LEARNINGS) — T003–T005, commit
2. Complete Phase 5 (rename MANUAL-TESTS → README-MANUAL-TESTS) — T009–T010, commit
3. Complete Phase 6 (polish/verify renames) — T011–T013
4. Complete Phase 7 (move all to docs/) — T014–T020, commit
5. Complete Phase 8 (verify + final commit) — T021–T024
6. Complete Phase 9 (README user restructure + README-CONTRIBUTORS.md) — T025–T027, commit
7. Complete Phase 10 (verify + final commit) — T028–T031

