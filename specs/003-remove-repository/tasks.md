# Tasks: Bulk Repository Import (Scan Folder)

**Input**: Design documents from `/specs/003-remove-repository/`
**Prerequisites**: plan.md ✅, spec.md ✅
**Last task in project**: T081 — new tasks start at T082

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to

---

## Phase 1: Setup

No new infrastructure needed — existing Fastify routes, React Query, and SQLite are reused as-is.

---

## Phase 2: Foundational

No blocking prerequisites — scan logic builds directly on existing `fs.ts` route and `api.ts` service patterns.

---

## Phase 3: User Story 1 — Scan Folder and Add All Git Repos (Priority: P1) 🎯 MVP

**Goal**: User picks a parent folder → backend recursively finds all `.git` directories → frontend bulk-adds all new repos, skipping already-registered ones → dashboard updates.

**Independent Test**: Pick a parent folder containing 3 git repos (1 already registered). Verify 2 new repos appear on dashboard, no duplicate for the existing one, and a friendly "No new repos found" banner appears when scanning an empty folder.

### Implementation

- [ ] T082 [US1] Add `POST /api/v1/fs/scan-folder` to `backend/src/api/routes/fs.ts`: accept `{ path: string }` body; use `fs.readdirSync` recursively (skip `node_modules`, `.git` subdirs) to find all directories containing a `.git` entry; return `{ repos: Array<{ path: string, name: string }> }` where `name` is the last path segment; log scan start/complete with full path and count at info level; on any fs error log full error with path and return `{ repos: [], error: 'SCAN_FAILED' }`

- [ ] T083 [P] [US1] Add `scanFolder(path: string)` to `frontend/src/services/api.ts`: call `POST /api/v1/fs/scan-folder` with `{ path }` body; return `Array<{ path: string, name: string }>` on success; throws human-friendly error on failure

- [ ] T084 [US1] Add "Add Multiple" button and `handleScanAndAdd` handler to `frontend/src/pages/DashboardPage.tsx`: button sits next to "Add Repository" in the header; `handleScanAndAdd` calls `pickFolder()` (cancel → no-op), then `scanFolder(path)`, filters out already-registered paths by comparing against `repos`, calls `addRepository` for each new path sequentially, invalidates queries after all adds; if zero new repos found after filtering show inline banner "No new git repositories found in the selected folder"; if some adds fail show "Added X of Y repositories — Z failed"; clear banner after 5 seconds

- [ ] T085 [P] [US1] Update `README.md` to document the "Add Multiple Repositories" feature in the usage section

**Checkpoint**: After T082–T084, user can pick a parent folder and all nested git repos are added in one click. Already-registered repos are silently skipped. Dashboard updates immediately.

---

## Phase 4: Polish & Cross-Cutting Concerns

- [ ] T086 [P] Mark T082–T085 as [X] in `specs/003-remove-repository/tasks.md` after implementation is verified

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 3 (US1)**: T082 (backend) and T083 (api.ts) can run in parallel. T084 (DashboardPage) depends on T083. T085 (README) is independent.

### Parallel Opportunities

```
T082 ──┐
T083 ──┼──► T084
T085 ──┘ (independent)
```

---

## Implementation Strategy

### MVP (Single Story — All of Phase 3)

1. T082: Backend scan endpoint
2. T083: Frontend `scanFolder()` (parallel with T082)
3. T084: Dashboard "Add Multiple" button + handler (depends on T083)
4. T085: README update
5. **Validate**: Pick a workspace folder, verify all nested repos are added, verify duplicates are skipped

### Incremental Delivery

This feature is a single story — complete it end-to-end before committing.

---

## Notes

- Scan is backend-only (browser has no filesystem access)
- Use `path.basename(repoPath)` for `name` field
- Skip `node_modules` during recursive scan to avoid scanning dependency trees
- The existing `pickFolder()` frontend function is reused — no changes needed to `pick-folder` endpoint
- `addRepository` already returns 409 for duplicates — frontend can use that OR pre-filter; pre-filtering avoids unnecessary API calls and is preferred
