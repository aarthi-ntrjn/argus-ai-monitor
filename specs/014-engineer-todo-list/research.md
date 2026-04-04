# Research: Engineer Todo List on Dashboard

**Branch**: `014-engineer-todo-list` | **Date**: 2026-04-04

## Decision Log

### D-001: Storage backend — SQLite via existing backend

**Decision**: Store todo items in the existing SQLite database (`~/.argus/argus.db`) via the existing `better-sqlite3` layer.

**Rationale**: The project already has a functioning SQLite + better-sqlite3 setup with an established schema, migration pattern, and CRUD helpers in `database.ts`. Reusing this is the minimal-complexity approach and keeps all persistent state in one place.

**Alternatives considered**:
- `localStorage` — rejected: data lost on browser storage clear; not accessible cross-machine in future.
- A separate database — rejected: unnecessary complexity, violates §I (prefer simple solutions).

---

### D-002: Migration pattern — runtime column-check pattern (existing convention)

**Decision**: Add the `todos` table via the existing runtime migration pattern in `database.ts` (pragma `table_info` check + conditional `CREATE TABLE IF NOT EXISTS` in schema.ts), with an accompanying reference SQL file `002-todos.sql`.

**Rationale**: The existing codebase uses runtime migrations (see lines 21–26 in database.ts). Adding a new table follows the same pattern: add to `SCHEMA_SQL` in `schema.ts`, and handle runtime backfills in `getDb()` if needed. This is reversible (table can be dropped) and consistent.

**Alternatives considered**:
- A dedicated migration runner — rejected: overkill for current scale; adds complexity not present in the rest of the codebase.

---

### D-003: API route pattern — `/api/todos` REST resource

**Decision**: Expose `GET /api/todos`, `POST /api/todos`, `PATCH /api/todos/:id`, `DELETE /api/todos/:id` as a Fastify route registered in a new `todos.ts` route file.

**Rationale**: Follows the existing pattern of `repositories.ts`, `sessions.ts` etc. in `backend/src/api/routes/`. Each resource gets its own route file registered on the Fastify instance.

**Alternatives considered**:
- Adding todo routes to an existing route file — rejected: violates separation of concerns; harder to test in isolation.

---

### D-004: Frontend data fetching — React Query (`@tanstack/react-query`)

**Decision**: Use `@tanstack/react-query` (`useQuery` + `useMutation`) via a custom `useTodos` hook, consistent with how all other data fetching is done in the frontend (`getRepositories`, `getSessions` etc.).

**Rationale**: React Query is already a dependency and used on the dashboard. Cache invalidation after mutations (`queryClient.invalidateQueries`) is the established pattern.

**Alternatives considered**:
- `useState` + direct fetch — rejected: no caching, no background refetch, inconsistent with codebase.

---

### D-005: Dashboard placement — fixed right sidebar, always visible

**Decision**: The todo panel is added as a fixed-width right sidebar (`w-72`) that is always visible on the dashboard, displayed alongside the existing main content area. The main content area shrinks to accommodate it.

**Rationale**: Spec clarification confirmed "fixed sidebar panel". The existing dashboard already implements a sidebar-like layout for the output pane (see `w-[640px] shrink-0 sticky top-8`). We follow the same structural pattern but keep the todo panel always visible (not toggle-activated).

**Alternatives considered**:
- Collapsible widget — rejected: user chose fixed sidebar.
- Floating overlay — rejected: user chose fixed sidebar.

---

### D-006: User scoping — `user_id` field defaulted to `'default'`

**Decision**: The `todos` table includes a `user_id TEXT NOT NULL DEFAULT 'default'` column. All queries in v1 filter by `user_id = 'default'`. No auth is involved.

**Rationale**: Spec clarification confirmed: single-user for now, but `user_id` must be in the schema from day one. Using a string default `'default'` means existing rows are automatically scoped correctly when multi-user support is added.

**Alternatives considered**:
- No `user_id` field — rejected: would require a breaking migration to add later.
- UUID for user — rejected: no auth system exists; `'default'` is the simplest safe default.

---

### D-007: Audit logging — pino structured log on every mutation

**Decision**: Every CRUD mutation (create, toggle, delete) emits a pino structured log entry with `{ action, todoId, userId, timestamp }`. No separate audit table.

**Rationale**: §VI requires audit logging. Under the §VI localhost exception, full auth/authz is waived, but the audit trail obligation remains. Pino structured logs satisfy §VII observability and provide the audit trail without a dedicated table.

**Alternatives considered**:
- Separate `audit_events` table — considered but rejected for v1: unnecessary overhead for a single-user tool; structured logs serve the same purpose at this scale.
