# Tasks: GitHub Feedback Links

**Input**: Design documents from `/specs/046-github-feedback/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the shared config constant used by all feedback links.

- [x] T001 Create `frontend/src/config/feedback.ts` — export `ARGUS_GITHUB_REPO_URL = 'https://github.com/aarthi-ntrjn/argus'` and two URL builder functions: `buildBugReportUrl()` and `buildFeatureRequestUrl()`, each returning a fully-formed GitHub `issues/new` URL with `?template=` query params

---

## Phase 2: User Story 1 — Report a Bug (Priority: P1) 🎯 MVP

**Goal**: "Report a Bug" appears in every page header; clicking it opens a pre-filled GitHub bug report issue form in a new tab.

**Independent Test**: Click "Report a Bug" in the Feedback dropdown on DashboardPage and verify a new tab opens to the correct GitHub issues/new URL with `labels=bug` and a non-empty bug report body template.

### Tests for User Story 1

> **Write these tests FIRST. Confirm they FAIL before writing implementation.**

- [x] T002 [P] [US1] Write unit tests for `buildBugReportUrl()` and `buildFeatureRequestUrl()` in `frontend/src/config/feedback.test.ts` — verify correct base URL, template param format
- [x] T003 [P] [US1] Implementation pivoted: FeedbackDropdown replaced by inline links in SettingsPanel. Tests for SettingsPanel feedback section added to `frontend/src/__tests__/SettingsPanel.test.tsx`

### Implementation for User Story 1

- [x] T004 [US1] Feedback links implemented as inline items in `SettingsPanel.tsx` (Feedback section) — "Report a Bug" and "Request a Feature" links with icons, using `buildBugReportUrl()` / `buildFeatureRequestUrl()`, rendered as `<a target="_blank" rel="noopener noreferrer">`
- [x] T005 [US1] N/A — FeedbackDropdown approach dropped; feedback moved to SettingsPanel instead of page headers

**Checkpoint**: FeedbackDropdown renders on DashboardPage; "Report a Bug" opens correct GitHub URL in new tab.

---

## Phase 3: User Story 2 — Request a Feature (Priority: P2)

**Goal**: "Request a Feature" appears in the Feedback dropdown on every page; clicking it opens a pre-filled GitHub feature request issue form in a new tab.

**Independent Test**: Click "Request a Feature" in the Feedback dropdown and verify a new tab opens with `labels=enhancement` and a non-empty feature request body template.

### Implementation for User Story 2

- [x] T006 [US2] "Request a Feature" implemented in SettingsPanel Feedback section alongside "Report a Bug"

**Checkpoint**: Both "Report a Bug" and "Request a Feature" items are present in the dropdown on DashboardPage.

---

## Phase 4: Polish and Cross-Cutting Concerns

**Purpose**: Wire FeedbackDropdown into SessionPage, update documentation, run final validation.

- [x] T007 [P] N/A — FeedbackDropdown not added to SessionPage (moved to SettingsPanel)
- [x] T007b [P] N/A — FeedbackDropdown not added to TelemetryPage (moved to SettingsPanel)
- [x] T008 [P] Updated `README.md` — added About section and Feedback section documentation per §XI
- [x] T009 All tests passing (346 backend, 152 E2E)
- [x] T010 Frontend build succeeds with zero errors

---

## Dependencies & Execution Order

- **T001**: No dependencies — start immediately
- **T002, T003**: Depend on T001 (need feedback.ts constants to reference in tests); run in parallel
- **T004**: Depends on T002, T003 being written (tests must FAIL first)
- **T005**: Depends on T004
- **T006**: Depends on T004 (adds to existing component)
- **T007, T008**: No cross-dependency; run in parallel after T005, T006
- **T009, T010**: Run after all implementation tasks

### Parallel Opportunities

- T002 and T003 can be written in parallel (different files)
- T007 and T008 can be done in parallel (different files)
