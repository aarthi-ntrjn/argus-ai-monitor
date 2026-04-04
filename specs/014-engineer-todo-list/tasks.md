# Tasks: Engineer Todo List on Dashboard

**Input**: Design documents from `/specs/014-engineer-todo-list/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/todos-api.md ✓

---

## Phase 1: Foundational (Shared Infrastructure)

**Purpose**: Backend schema, model type, and route registration — required before any user story work.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T001 Add `TodoItem` TypeScript interface to `backend/src/models/index.ts`
- [ ] T002 Add `todos` table + index to `backend/src/db/schema.ts` (`SCHEMA_SQL`)
- [ ] T003 Create migration reference file `backend/src/db/migrations/002-todos.sql`
- [ ] T004 Add todo CRUD functions to `backend/src/db/database.ts`: `getTodos`, `insertTodo`, `updateTodo`, `deleteTodo`
- [ ] T005 Create `backend/src/api/routes/todos.ts` with Fastify plugin (empty route stubs)
- [ ] T006 Register todos route plugin in `backend/src/server.ts`

**Checkpoint**: Backend compiles and server starts with `/api/todos` registered (returns 501).

---

## Phase 2: User Story 1 & 2 — Add, View, and Check Off Items (Priority: P1) 🎯 MVP

**Goal**: Engineer can add todo items, see them on the dashboard sidebar, and mark them done/undone.

**Independent Test**: Open dashboard → todo sidebar visible → add item → appears in list → check it off → visual state changes.

### Tests for US1 & US2 ⚠️ Write FIRST — ensure FAIL before implementation

- [ ] T010 Write contract tests for `GET /api/todos` (TC-001, TC-002) in `backend/tests/contract/todos.test.ts`
- [ ] T011 Write contract tests for `POST /api/todos` (TC-003, TC-004, TC-005, TC-006) in `backend/tests/contract/todos.test.ts`
- [ ] T012 Write contract tests for `PATCH /api/todos/:id` (TC-007, TC-008, TC-009, TC-010) in `backend/tests/contract/todos.test.ts`
- [ ] T013 [P] Write component tests for `TodoPanel` add + list in `frontend/src/components/TodoPanel/TodoPanel.test.tsx`

### Implementation for US1 & US2

- [ ] T014 Implement `GET /api/todos` handler in `backend/src/api/routes/todos.ts` (returns all todos, ordered by `created_at` ASC, filtered by `user_id='default'`)
- [ ] T015 Implement `POST /api/todos` handler in `backend/src/api/routes/todos.ts` (validate text, reject empty/whitespace/>500chars, structured error on fail, pino log on success)
- [ ] T016 Implement `PATCH /api/todos/:id` handler in `backend/src/api/routes/todos.ts` (toggle done, 404 on missing, pino log on success)
- [ ] T017 Add todo API functions to `frontend/src/services/api.ts`: `getTodos`, `createTodo`, `toggleTodo`
- [ ] T018 Create `frontend/src/hooks/useTodos.ts` with React Query hooks: `useTodos`, `useCreateTodo`, `useToggleTodo`
- [ ] T019 Create `frontend/src/components/TodoPanel/TodoPanel.tsx` — fixed sidebar panel with: item list (done items visually distinct), add form (input + submit), empty state, loading state, error state
- [ ] T020 Integrate `TodoPanel` into `frontend/src/pages/DashboardPage.tsx` as a fixed right sidebar (always visible)

**Checkpoint**: Dashboard shows todo sidebar. Add an item → it appears. Check it off → strikethrough applied. Refreshing page preserves items.

---

## Phase 3: User Story 3 — Delete Items (Priority: P2)

**Goal**: Engineer can remove a todo item they no longer need.

**Independent Test**: Add item → delete it → item disappears. Only one item → delete → empty state shown.

### Tests for US3 ⚠️ Write FIRST — ensure FAIL before implementation

- [ ] T021 Write contract tests for `DELETE /api/todos/:id` (TC-011, TC-012) in `backend/tests/contract/todos.test.ts`
- [ ] T022 [P] Write component tests for `TodoPanel` delete in `frontend/src/components/TodoPanel/TodoPanel.test.tsx`

### Implementation for US3

- [ ] T023 Implement `DELETE /api/todos/:id` handler in `backend/src/api/routes/todos.ts` (204 on success, 404 on missing, pino log)
- [ ] T024 Add `deleteTodo` API function to `frontend/src/services/api.ts`
- [ ] T025 Add `useDeleteTodo` React Query mutation to `frontend/src/hooks/useTodos.ts`
- [ ] T026 Add delete button to each todo item in `frontend/src/components/TodoPanel/TodoPanel.tsx`

**Checkpoint**: Delete button visible on each item. Click → item removed immediately. Last item deleted → empty state shown.

---

## Phase 4: E2E Tests & Polish

**Purpose**: End-to-end validation of critical user flows + documentation.

- [ ] T030 Write Playwright E2E tests in `frontend/tests/e2e/todo-panel.spec.ts`:
  - Add a todo item and verify it appears
  - Check off an item and verify visual state
  - Delete an item and verify it disappears
  - Empty state shown when list is empty
  - Items persist after page reload
- [ ] T031 [P] Update `README.md` to document the todo list feature (§XI)
- [ ] T032 [P] Run full test suite: `npm run test --workspace=backend` — all pass
- [ ] T033 [P] Run build: `npm run build --workspace=backend` — no errors

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Foundational)**: No dependencies — start immediately. Blocks all other phases.
- **Phase 2 (US1+US2)**: Depends on Phase 1. Tests written first (T010–T013 before T014–T020).
- **Phase 3 (US3)**: Depends on Phase 2 completion. Tests written first (T021–T022 before T023–T026).
- **Phase 4 (Polish)**: Depends on Phase 3 completion.

### Within Each Phase

- Tests [T010–T013, T021–T022] MUST be written and confirmed FAILING before implementation
- Backend route handlers (T014–T016, T023) before frontend API functions (T017, T024)
- Frontend hooks (T018, T025) before components (T019, T026)
- Component built (T019) before dashboard integration (T020)

### Parallel Opportunities

- T010–T013 can run in parallel (different test scenarios/files)
- T021–T022 can run in parallel
- T031–T033 can run in parallel (different concerns)

---

## Notes

- **Test-First**: All [T] test tasks must be written and confirmed FAILING before the corresponding implementation tasks run (§IV).
- **Commit cadence**: Commit after each completed phase with task ID in message.
- **Error contract**: All API errors must follow `{ error, message, requestId }` (§XII).
- **Logging**: Every mutation (create, toggle, delete) must emit a pino structured log.
- **§VI exception**: No auth required — localhost single-user tool.
