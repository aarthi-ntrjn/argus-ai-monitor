# Tasks: Frontend-Driven Repository Folder Picker (017)

## Phase 1: Remove Backend APIs

- [X] T001 [P1] [Story 3] Remove `GET /api/v1/fs/browse` route from `backend/src/api/routes/fs.ts`
- [X] T002 [P1] [Story 3] Remove `GET /api/v1/fs/scan` route from `backend/src/api/routes/fs.ts`
- [X] T003 [P1] [Story 3] Remove `POST /api/v1/fs/pick-folder` route from `backend/src/api/routes/fs.ts`
- [X] T004 [P1] [Story 3] Remove unused imports (`spawnSync`, `homedir`, `dirname`, `isPathWithinBoundary`) from `fs.ts`
- [X] T005 [P1] [Story 3] Remove path sandbox check from `POST /api/v1/fs/scan-folder` so any user-typed path is accepted

## Phase 2: Frontend Text Input Flow

- [X] T006 [P1] [Story 1] Replace native folder picker call in `DashboardPage` with a modal containing a text input
- [X] T007 [P1] [Story 1] Move folder input state and `handleFolderSubmit` logic into `useRepositoryManagement` hook
- [X] T008 [P1] [Story 1] Remove `pickFolder` from `frontend/src/services/api.ts`
- [X] T009 [P1] [Story 2] Wire "Scan & Add" button to call `scanFolder` then `addRepository` for each new repo

## Phase 3: Test Updates

- [X] T010 [P1] Remove `GET /fs/browse` and `GET /fs/scan` tests from `backend/tests/contract/fs.test.ts`
- [X] T011 [P1] Remove `GET /api/v1/fs/browse` entry from `backend/tests/contract/security-headers.test.ts`
- [X] T012 [P1] Remove boundary enforcement tests for removed routes
- [X] T013 [P1] Add unit tests for `handleFolderSubmit` in `useRepositoryManagement`

## Phase 4: Documentation

- [X] T014 [P1] Update `README.md` Repository Management section to describe text input flow
