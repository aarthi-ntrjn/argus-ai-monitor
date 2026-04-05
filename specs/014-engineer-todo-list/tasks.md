# Tasks: Engineer Todo List on Dashboard

**Input**: Design documents from `/specs/014-engineer-todo-list/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/todos-api.md ✓

---

## Phase 1: Foundational (Shared Infrastructure)

**Purpose**: Backend schema, model type, and route registration — required before any user story work.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T001 Add `TodoItem` TypeScript interface to `backend/src/models/index.ts`
- [x] T002 Add `todos` table + index to `backend/src/db/schema.ts` (`SCHEMA_SQL`)
- [x] T003 Create migration reference file `backend/src/db/migrations/002-todos.sql`
- [x] T004 Add todo CRUD functions to `backend/src/db/database.ts`: `getTodos`, `insertTodo`, `updateTodo`, `deleteTodo`
- [x] T005 Create `backend/src/api/routes/todos.ts` with Fastify plugin (empty route stubs)
- [x] T006 Register todos route plugin in `backend/src/server.ts`

**Checkpoint**: Backend compiles and server starts with `/api/todos` registered (returns 501).

---

## Phase 2: User Story 1 & 2 — Add, View, and Check Off Items (Priority: P1) 🎯 MVP

**Goal**: Engineer can add todo items, see them on the dashboard sidebar, and mark them done/undone.

**Independent Test**: Open dashboard → todo sidebar visible → add item → appears in list → check it off → visual state changes.

### Tests for US1 & US2 ⚠️ Write FIRST — ensure FAIL before implementation

- [x] T010 Write contract tests for `GET /api/todos` (TC-001, TC-002) in `backend/tests/contract/todos.test.ts`
- [x] T011 Write contract tests for `POST /api/todos` (TC-003, TC-004, TC-005, TC-006) in `backend/tests/contract/todos.test.ts`
- [x] T012 Write contract tests for `PATCH /api/todos/:id` (TC-007, TC-008, TC-009, TC-010) in `backend/tests/contract/todos.test.ts`
- [x] T013 [P] Write component tests for `TodoPanel` add + list in `frontend/src/components/TodoPanel/TodoPanel.test.tsx`

### Implementation for US1 & US2

- [x] T014 Implement `GET /api/todos` handler in `backend/src/api/routes/todos.ts` (returns all todos, ordered by `created_at` ASC, filtered by `user_id='default'`)
- [x] T015 Implement `POST /api/todos` handler in `backend/src/api/routes/todos.ts` (validate text, reject empty/whitespace/>500chars, structured error on fail, pino log on success)
- [x] T016 Implement `PATCH /api/todos/:id` handler in `backend/src/api/routes/todos.ts` (toggle done, 404 on missing, pino log on success)
- [x] T017 Add todo API functions to `frontend/src/services/api.ts`: `getTodos`, `createTodo`, `toggleTodo`
- [x] T018 Create `frontend/src/hooks/useTodos.ts` with React Query hooks: `useTodos`, `useCreateTodo`, `useToggleTodo`
- [x] T019 Create `frontend/src/components/TodoPanel/TodoPanel.tsx` — fixed sidebar panel with: item list (done items visually distinct), add form (input + submit), empty state, loading state, error state
- [x] T020 Integrate `TodoPanel` into `frontend/src/pages/DashboardPage.tsx` as a fixed right sidebar (always visible)

**Checkpoint**: Dashboard shows todo sidebar. Add an item → it appears. Check it off → strikethrough applied. Refreshing page preserves items.

---

## Phase 3: User Story 3 — Delete Items (Priority: P2)

**Goal**: Engineer can remove a todo item they no longer need.

**Independent Test**: Add item → delete it → item disappears. Only one item → delete → empty state shown.

### Tests for US3 ⚠️ Write FIRST — ensure FAIL before implementation

- [x] T021 Write contract tests for `DELETE /api/todos/:id` (TC-011, TC-012) in `backend/tests/contract/todos.test.ts`
- [x] T022 [P] Write component tests for `TodoPanel` delete in `frontend/src/components/TodoPanel/TodoPanel.test.tsx`

### Implementation for US3

- [x] T023 Implement `DELETE /api/todos/:id` handler in `backend/src/api/routes/todos.ts` (204 on success, 404 on missing, pino log)
- [x] T024 Add `deleteTodo` API function to `frontend/src/services/api.ts`
- [x] T025 Add `useDeleteTodo` React Query mutation to `frontend/src/hooks/useTodos.ts`
- [x] T026 Add delete button to each todo item in `frontend/src/components/TodoPanel/TodoPanel.tsx`

**Checkpoint**: Delete button visible on each item. Click → item removed immediately. Last item deleted → empty state shown.

---

## Phase 4: E2E Tests & Polish

**Purpose**: End-to-end validation of critical user flows + documentation.

- [x] T030 Write Playwright E2E tests in `frontend/tests/e2e/todo-panel.spec.ts`:
  - Add a todo item and verify it appears
  - Check off an item and verify visual state
  - Delete an item and verify it disappears
  - Empty state shown when list is empty
  - Items persist after page reload
- [x] T031 [P] Update `README.md` to document the todo list feature (§XI)
- [x] T032 [P] Run full test suite: `npm run test --workspace=backend` — all pass
- [x] T033 [P] Run build: `npm run build --workspace=backend` — no errors

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

---

## Phase 5: UX Redesign — Inline Editable To-Do List

**Spec change context**: User requested a rethink of the panel UX. The original spec assumed a top add-form and an X delete button. This phase replaces that with a keyboard-driven inline-edit model (similar to Notion/Linear). The assumption "Editing a todo item's text after creation is out of scope" is **revoked** by this phase.

**New interaction model**:
- Header renamed: "My Reminders" → "My To-Do"
- No top add-form; no X delete button
- Each row: `checkbox  [editable text input]`
- **Enter** on any row → save current row (if non-empty) + insert a new empty row directly below it + focus it
- **Backspace** on an empty text input → delete that item from DB + focus the row above it
- **Blur** on a text input with modified text → PATCH text to DB (auto-save)
- **Blur** on an empty draft row (never saved) → discard (no API call)
- **Empty list state** → display one local draft row (not yet in DB) so the user can start typing immediately

**Backend scope**: The existing `PATCH /api/v1/todos/:id` only accepts `done`. It must be extended to also accept an optional `text` field so text edits can be persisted.

**Dependency**: T034 and T036 before T037; T037 before T038.

### Backend

- [x] T034 [P] Extend `backend/src/db/database.ts` `updateTodo(id, patch, updatedAt)`: change second param from `done: boolean` to `patch: { done?: boolean; text?: string }` and build the UPDATE query dynamically (only set columns that are present in `patch`); update all callers. Reject (return `undefined`) if `patch` is empty.

- [x] T035 [P] Add contract tests TC-013 and TC-014 to `backend/tests/contract/todos.test.ts`: **TC-013** — `PATCH /api/v1/todos/:id` with `{ text: "updated text" }` returns 200 with updated `text` and `done` unchanged; **TC-014** — `PATCH /api/v1/todos/:id` with `{ text: "" }` returns 400 `VALIDATION_ERROR`. These tests MUST fail before T036 is implemented.

- [x] T036 Extend `PATCH /api/v1/todos/:id` handler in `backend/src/api/routes/todos.ts` to accept an optional `text: string` field alongside the existing `done: boolean`. Accept a body containing `done` OR `text` OR both; reject with 400 if `text` is an empty/whitespace string; reject with 400 if neither field is provided; call the updated `updateTodo` with a `patch` object; return updated `TodoItem` on success with pino structured log including both changed fields.

### Frontend

- [x] T037 [P] Add `updateTodoText(id: string, text: string): Promise<TodoItem>` to `frontend/src/services/api.ts` (PATCH with `{ text }`) and add `useUpdateTodoText` mutation hook to `frontend/src/hooks/useTodos.ts` (invalidates `['todos']` on success via `useQueryClient()`).

- [x] T038 Redesign `frontend/src/components/TodoPanel/TodoPanel.tsx` for inline-edit UX:
  1. **Rename** header from "My Reminders" to "My To-Do".
  2. **Remove** the top add-form (`<form>`) and all its state (`inputText`, `inputError`).
  3. **Remove** the X delete `<button>` from each row and the `group`/`group-hover` classes.
  4. **Add** `useUpdateTodoText` to the hook imports.
  5. **Local state**: maintain `draftIds: string[]` — IDs of rows that are local-only (not yet in DB). On empty list, seed with one draft ID (`crypto.randomUUID()`) so a blank editable row appears.
  6. **Row rendering**: replace the text `<span>` with `<input type="text" value={localText} onChange={...} onBlur={handleBlur} onKeyDown={handleKey} ref={...} />`. Keep the checkbox (`onChange` → `toggleTodo.mutate`). Apply strikethrough class to the input when `done`.
  7. **Local text state**: maintain `localTexts: Record<id, string>` (init from todo data). On `onChange` update local only (no API call yet).
  8. **handleBlur(id)**: if the item is a draft and `localText` is empty → discard (remove from `draftIds`); if the item is a draft and `localText` is non-empty → call `createTodo.mutate(localText)`; if the item is a real todo and `localText !== todo.text` → call `updateTodoText.mutate({ id, text: localText })`; if the item is a real todo and `localText` is empty → call `deleteTodo.mutate(id)`.
  9. **handleKey(e, id, index)**: on **Enter** — prevent default, save current row (same logic as blur), then insert a new draft ID after the current index in `draftIds` array, then `refs[index+1].current?.focus()` on the next tick; on **Backspace** when `localText === ''` — prevent default, if real todo call `deleteTodo.mutate(id)`, remove from local state, focus `refs[index-1]?.current`.
  10. **Focus management**: maintain `inputRefs: React.RefObject<HTMLInputElement>[]` keyed by rendered row index (re-created on list change).
  11. **Empty state**: when `todos.length === 0` and `draftIds.length === 0`, add one empty draft ID to `draftIds` (on first render / after all items deleted).

- [x] T039 [P] Update `frontend/tests/e2e/todo-panel.spec.ts`: replace tests that click the top "Add" button or the X delete button with new tests for the inline-edit UX — (a) type into the draft row + blur → item saved and appears; (b) type + press Enter → new row created below and focused; (c) edit existing item text + blur → text updated; (d) Backspace on empty row → item deleted; (e) empty-state draft row is present when list is empty. Update route mocks to also intercept `PATCH /api/v1/todos/*` for text updates.

- [x] T040 [P] Update `frontend/src/components/TodoPanel/TodoPanel.test.tsx` and `frontend/tests/unit/useTodos.test.ts`: remove tests for the old add-form and X button; add tests for (a) `useUpdateTodoText` invalidates `['todos']` query on the provider QueryClient; (b) pressing Enter on a row calls `createTodo.mutate`; (c) pressing Backspace on empty input calls `deleteTodo.mutate`; (d) blur with changed text calls `updateTodoText.mutate`; (e) draft row appears when todo list is empty.


### Phase 5 Checkpoint

All original user stories (add, view, toggle, delete) are preserved. Editing text is now supported. UX is keyboard-driven. Header reads "My To-Do". No add-form. No delete button. All tests pass.

