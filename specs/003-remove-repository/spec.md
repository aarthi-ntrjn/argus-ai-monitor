# Feature Specification: Bulk Repository Import (Scan Folder)

**Feature Branch**: `003-remove-repository`
**Created**: 2026-04-01
**Status**: Clarified
**Input**: User description: "when i specify a folder find all the repositories that are present in subfolders and add them all"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Scan Folder and Add All Git Repositories (Priority: P1)

As a developer, I want to pick a parent folder and have Argus automatically find every git repository inside it (at any depth) and add them all to the dashboard, so I can register an entire workspace of repos in one action rather than adding them one by one.

**Why this priority**: This is the entire feature — there is only one user story. Adding repos one at a time is tedious when working in a monorepo workspace or a shared code directory with many projects.

**Independent Test**: Can be fully tested by pointing Argus at a parent directory containing 3+ nested git repos, clicking the scan action, and verifying all repos appear on the dashboard without adding them individually.

**Acceptance Scenarios**:

1. **Given** a parent folder contains 4 git repositories at various subdirectory depths, **When** I click "Add Repository" and select that parent folder, **Then** all 4 repos are added to the dashboard and appear within 5 seconds.
2. **Given** a parent folder contains 2 repos already registered and 2 new ones, **When** I scan that folder, **Then** only the 2 new repos are added; the already-registered ones are silently skipped (no duplicates, no error).
3. **Given** I select a folder that contains no git repositories at any depth, **When** the scan completes, **Then** a friendly message informs me "No new git repositories found in the selected folder."
4. **Given** the scan finds repos, **When** they are added, **Then** each newly added repo immediately appears on the dashboard (same real-time update as single-add).
5. **Given** I cancel the folder picker dialog, **When** the dialog closes, **Then** nothing happens and no error is shown.

---

### Edge Cases

- What if the selected folder itself is a git repo? It should be added too (treat it the same as a subfolder result).
- What if a subfolder has a `.git` that is not a valid repo? Skip it gracefully (don't crash, don't add).
- What if 50+ repos are found? Add them all; no artificial limit.
- What if the scan returns paths and some `addRepository` calls fail? Add what succeeds; surface a summary error for failures.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST recursively scan the selected folder for any directory containing a `.git` subdirectory.
- **FR-002**: System MUST skip repos that are already registered (matched by path) — no duplicates.
- **FR-003**: System MUST add all newly found git repos in a single operation.
- **FR-004**: System MUST show a human-friendly message if no new repos are found.
- **FR-005**: System MUST update the dashboard in real-time after all repos are added (invalidate queries).
- **FR-006**: System MUST NOT show an error if the user cancels the folder picker.
- **FR-007**: Backend scan endpoint MUST return the list of found repo paths without adding them — separation of scan from add.

### Key Entities

- **ScannedRepo**: `{ path: string, name: string }` — represents a found git repo during a scan. Already-registered filtering is done client-side by comparing paths against registered repos.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: User can register 10 repos in under 5 seconds (vs. 10 manual "Add Repository" clicks).
- **SC-002**: Already-registered repos are never duplicated — zero duplicates after any number of scans.
- **SC-003**: "No repos found" message appears within 2 seconds of folder selection when folder has no git repos.
- **SC-004**: Dashboard reflects all newly added repos within 5 seconds of confirmation.

## Assumptions

- The folder picker reuses the existing `POST /api/v1/fs/pick-folder` backend endpoint (already implemented).
- The scan depth is unbounded — scan all subdirectories recursively (no configurable depth limit for v1).
- The `.git` directory check is sufficient to identify a git repo (no `git rev-parse` validation needed for v1).
- The single **"Add Repository"** button is smart: if the selected folder contains a `.git` directory, it adds that repo; if not, it recursively scans for all git repos in subdirectories and adds them all.
- No confirmation step before adding — user asked to "add them all" directly.
