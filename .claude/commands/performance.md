# /performance

You are a senior engineer performing a full-stack performance audit on a React + Node.js backend application. Work through every check below, collect all findings, fix every one of them, then commit. Do not ask permission before fixing — these are objective performance defects.

---

## Background: performance issues in web apps

A web application connecting a React frontend to a Node.js backend can degrade from 10 distinct directions. This skill covers all of them.

### Why each category matters

**Polling redundancy** — polling while WebSocket push is already wired drains battery, wastes bandwidth, and hammers the backend unnecessarily. Every `refetchInterval` must be justified.

**React render thrash** — React re-renders the whole subtree unless you opt out with `useMemo`/`React.memo`. An O(n×m) computation in a component body that runs on every parent update silently kills responsiveness.

**N+1 data fetching** — one query per list item multiplies network round-trips by the list length. Ten session cards each polling independently is ten times the traffic of one coordinated query.

**Overfetching** — requesting 100 rows to display 10 is wasteful at every layer: more SQL, more serialisation, more JSON parsing, more React diffing.

**Blocking synchronous I/O** — Node.js runs on a single event loop. Any `readFileSync`, `execSync`, `readdirSync`, or `statSync` in a hot path stalls the entire server for every connected user until it returns.

**Process enumeration in tight loops** — `psList()`, `ps`, `top` enumerate the entire OS process table. Running this every 5 seconds at the same frequency as routine scans inflates CPU cost with no benefit.

**Missing database indexes** — a `WHERE status = 'active'` without an index degrades from O(log n) to O(n). A missing index on a 100k-row table can turn a 1ms query into a 500ms full table scan.

**Unbounded queries** — returning every row from a table is a time bomb. The query looks fast during development but will eventually transfer gigabytes and exhaust memory.

**WebSocket broadcast storms** — broadcasting one WebSocket message per output item means a JSONL file with 100 lines emits 100 messages to every connected client. Batching collapses this to one message.

**Resource leaks** — Maps, watchers, and event listeners that grow with session count but never shrink eventually exhaust memory on long-lived servers.

---

## Step 1 — Establish scope

Scan:
- `frontend/src/` (all `.ts` and `.tsx` files, excluding `*.test.*`)
- `backend/src/` (all `.ts` files, excluding `*.test.*`)
- `backend/src/db/` (schema and database files)

---

## Step 2 — Polling and real-time redundancy

### 2a — Identify every polling interval

Grep for `refetchInterval`, `setInterval`, `setTimeout` (in loops or recurring patterns) in the frontend and backend.

For each occurrence record: file, line, interval value in ms, what it polls/refreshes.

### 2b — Check whether WebSocket push already covers it

Read the WebSocket event dispatcher and any socket client initialisation (e.g. `socket.ts`, `api/ws/`). List every event type that is broadcast.

**Rule**: If a WebSocket event covers the same data as a `refetchInterval`, the polling is redundant. Remove the `refetchInterval` and rely on the WebSocket to invalidate the TanStack Query cache (via `queryClient.invalidateQueries`).

**Rule**: If no WebSocket covers the data, polling is acceptable — but the interval must not be shorter than the time it takes to process one response.

### 2c — N+1 polling

Check whether multiple instances of the same component each open their own polling interval for the same kind of data (e.g. one `refetchInterval` per list item).

**Rule**: Per-item polling multiplies requests by list length. Consolidate into a single parent query or rely on WebSocket push.

---

## Step 3 — React render performance

### 3a — Expensive computations without useMemo

Read every component that transforms or joins data from multiple hooks (e.g. `repos.map(...)` combined with `sessions.filter(...)`).

**Rule**: Any computation with O(n×m) or greater complexity in a component body must be wrapped in `useMemo` with the correct dependency array. This includes: nested `filter`/`map`/`sort`, `[...arr].reverse()`, or any computation that iterates an array of size > 20 inside another iteration.

Flag: the raw computation without `useMemo`, the file and line, and the complexity.

### 3b — Components not memoised

For every component rendered in a list (i.e. inside `.map()`), check whether it is wrapped in `React.memo`.

**Rule**: List-item components that do not depend on parent-level state changes must be wrapped in `React.memo()` to prevent cascading re-renders when siblings change.

### 3c — Inline object and function creation in JSX

Search for object literals `{{ ... }}` and arrow functions `() =>` passed directly as props to components (other than DOM elements). These create a new reference on every render and defeat `React.memo`.

**Rule**: Move constant objects to module scope. Stable callbacks should be wrapped in `useCallback`.

Exception: DOM event handlers (`onClick`, `onChange`) on native elements do not need `useCallback`.

### 3d — Heavy renderers without virtualization

Search for `.map()` over arrays in components that render complex child nodes (markdown parsers, syntax highlighters, rich-text editors). Check the associated `limit` value returned by the API.

**Rule**: If an array can exceed 50 items and each item renders a markdown parser or syntax highlighter, the list needs either: (a) pagination (reduce `limit` to ≤ 25 and add a "load more" button), or (b) virtual scrolling (react-window / react-virtual).

---

## Step 4 — Data fetching patterns

### 4a — Request waterfalls

Search for `useQuery` hooks where `enabled` depends on data from another `useQuery`. Also check if a component issues Query B only after Query A resolves.

**Rule**: Independent queries must run in parallel (`Promise.all`, or multiple `useQuery` with no `enabled` dependency). Sequential queries where the second does not need data from the first are a waterfall.

### 4b — Overfetching

For every API call that takes a `limit` parameter, compare the limit to the number of items actually displayed.

**Rule**: `limit` should be 1.5–2× the visible count, not 10×. Fetching 100 items to display 10 is a 10× over-fetch.

### 4c — Client-side filtering of server data

Search for patterns where all records are fetched from the API (no filter parameter) and then `.filter()` is applied in the component.

**Rule**: Filtering must happen at the database level. If a component always filters `sessions` by `repositoryId`, the API call must include `repositoryId` as a query parameter. Fetching all records to discard most of them is O(n) wasted work at every layer.

---

## Step 5 — Backend synchronous I/O

### 5a — Sync file operations in hot paths

Grep for `readFileSync`, `writeFileSync`, `openSync`, `readSync`, `closeSync`, `readdirSync`, `statSync`, `lstatSync`, `existsSync` in all backend source files.

For each occurrence, determine whether it is in:
- **Startup/init path** (acceptable — runs once)
- **Per-request handler** (unacceptable — blocks every user)
- **Scheduled interval / file watcher callback** (unacceptable — blocks event loop periodically)
- **Library-internal call** (acceptable if unavoidable)

**Rule**: Any `*Sync` call inside a `setInterval` callback, a route handler, or a file watcher event handler must be replaced with the async equivalent (`fs.promises.*`).

### 5b — Subprocess spawning in hot paths

Grep for `execSync`, `spawnSync`, `exec(`, `spawn(`, `child_process` in backend source files.

For each occurrence, determine whether it is in a hot path (called on a timer or per-request).

**Rule**: `execSync` blocks the event loop for the entire duration of the subprocess. Any `execSync` in a timed loop must be:
1. Replaced with `exec` (async) wrapped in a `promisify`, AND
2. Results cached with a TTL appropriate to how often the value changes (e.g. current git branch — cache for 30 seconds).

### 5c — Expensive OS calls in tight loops

Grep for `psList` (or equivalent: `ps`, process enumeration libraries). Count how many times it is called per scan cycle.

**Rule**: Process list enumeration is an O(all-processes) operation. It must be called at most once per scan cycle. If two functions both call `psList()` in the same interval handler, merge them: call once, pass the result to both.

---

## Step 6 — Database performance

### 6a — Missing indexes

Read the schema file (typically `schema.ts` or `schema.sql`). List every `CREATE INDEX` statement. Then read every `getDb().prepare(...)` call across all database files and identify every column used in a `WHERE`, `ORDER BY`, or `JOIN ON` clause.

For each column used in a filter/sort that has no index, flag it.

**Rule**: Every column used in a `WHERE` clause in a query that can return many rows must have an index, or a composite index covering that column.

### 6b — Unbounded queries

Search for `SELECT` statements with no `LIMIT` clause (or where the limit is set to a very large number like 10000).

**Rule**: Every query that reads from a table that can grow unboundedly must have a `LIMIT`. The maximum safe limit for a single HTTP response is 500 rows; beyond that, use cursor-based pagination.

### 6c — N+1 database patterns

Look for patterns where a query is executed once per item in a list returned by a previous query.

**Rule**: Replace N+1 patterns with a single query using `IN (...)` or a `JOIN`.

### 6d — Aggregations done in application code

Search for patterns where all rows are fetched into memory and then `.reduce()` or `.sum()` is called in JavaScript.

**Rule**: Aggregations (SUM, COUNT, MAX, AVG) must be done in SQL. Loading 10,000 rows into a JS array to sum one column is O(n) memory and O(n) computation that the database can do in O(1) with an index.

### 6e — SQLite-specific configuration

Read the database initialisation file. Check for these pragmas:

| Pragma | Recommended value | Reason |
|--------|-------------------|--------|
| `journal_mode` | `WAL` | Concurrent reads while writing |
| `synchronous` | `NORMAL` | Safe for WAL mode; faster than FULL |
| `foreign_keys` | `ON` | Referential integrity |
| `cache_size` | `-64000` (64 MB) | More cache, fewer disk reads |
| `temp_store` | `MEMORY` | Temp tables in RAM |
| `mmap_size` | `268435456` (256 MB) | Memory-mapped I/O |
| `busy_timeout` | `5000` | Prevent SQLITE_BUSY errors |

Flag any missing pragmas.

---

## Step 7 — WebSocket broadcast efficiency

### 7a — Per-item broadcasts

Read the WebSocket broadcast call sites. Check if `broadcast()` is called inside a loop over an array of items.

**Rule**: Do not broadcast one message per item. Batch the array into a single broadcast: `broadcast({ type: 'session.output.batch', data: { sessionId, outputs } })`.

The frontend handler must be updated to process the array.

### 7b — Unnecessary broadcasts

Search for `broadcast(` calls and check whether the data being broadcast has actually changed from the previous call.

**Rule**: Before broadcasting a state update, compare the new value to the cached previous value. Only broadcast when the value is different.

---

## Step 8 — Resource cleanup and memory

### 8a — Growing maps without cleanup

Search for `new Map<string, ...>()` as class or module-level variables. For each, check whether entries are ever deleted when the associated resource (session, watcher) is closed or expires.

**Rule**: Every map entry added when a session starts must be deleted when the session ends. If the session-end handler does not delete the entry, it is a memory leak.

### 8b — File watchers not closed on session end

Search for `chokidar.watch(` and `watcher.on('change', ...)` calls. Check whether the watcher is closed when the session ends (not just on server shutdown).

**Rule**: A file watcher consumes a file descriptor. If a session ends but its watcher is not closed, the descriptor is leaked. Close watchers when the associated session is marked ended, not only when the server shuts down.

### 8c — Frontend event listener cleanup

Search for `addEventListener` in `useEffect` hooks. Verify each has a cleanup function (`return () => removeEventListener(...)`).

**Rule**: Every `addEventListener` in a `useEffect` must have a matching `removeEventListener` in the effect's cleanup function.

---

## Step 9 — Bundle and loading

### 9a — Heavy dependencies used minimally

Read `frontend/package.json`. For each dependency, note its approximate minified+gzipped size. Flag any library where fewer than 20% of its exports are used and a lighter alternative exists.

**Rule**: Libraries used in only one place on one route should be loaded lazily with `React.lazy(() => import(...))` and `<Suspense>`.

### 9b — Vite build configuration

Read `vite.config.ts`. Check for:
- `build.rollupOptions.output.manualChunks` (explicit code splitting)
- `build.minify` (should be `esbuild` or `terser`)
- Source maps in production (`build.sourcemap` — should be `false` or `'hidden'`)

**Rule**: Large dependencies that are not needed on initial page load (tour libraries, chart libraries, editor components) must be in separate chunks, loaded lazily.

---

## Step 10 — Compile findings

Before making any changes, output a findings table:

```
## Performance Findings

### Polling Redundancy
| # | File | Line | Interval | WebSocket covers it? | Description |
|---|------|------|----------|---------------------|-------------|
...

### React Render Performance
| # | File | Line | Type | Description |
|---|------|------|------|-------------|
...

### Data Fetching
| # | File | Line | Type | Description |
|---|------|------|------|-------------|
...

### Backend Synchronous I/O
| # | File | Line | Call | Context | Description |
|---|------|------|------|---------|-------------|
...

### Database
| # | File | Line | Type | Description |
|---|------|------|------|-------------|
...

### WebSocket Efficiency
| # | File | Line | Description |
|---|------|------|-------------|
...

### Resource Cleanup / Memory
| # | File | Line | Description |
|---|------|------|-------------|
...

### Bundle / Loading
| # | File | Description |
|---|------|-------------|
...

**Total findings: N**
```

If a category has zero findings, say "None found."

---

## Step 11 — Fix all findings

Work through every finding. For each fix:

1. Read the file if not already read.
2. Apply the minimal correct change:

   **Redundant polling**: Remove `refetchInterval` from the query. Add a WebSocket event handler in the appropriate `useEffect` (or wherever the socket client is initialised) that calls `queryClient.invalidateQueries({ queryKey: [...] })` when the relevant event arrives.

   **Missing useMemo**: Wrap the expression in `useMemo(() => ..., [deps])`. The deps array must include every variable referenced in the expression that can change.

   **Missing React.memo**: Add `React.memo` to the component export: `export default React.memo(ComponentName)`.

   **Inline object in JSX**: Move the constant object to module scope. Move the stable callback to `useCallback`.

   **Heavy renderer without pagination**: Reduce `limit` to a sensible value (20–30 for rich content). If "load more" is needed, add a button that increments the offset.

   **Client-side filter that should be server-side**: Add a filter parameter to the API function and the backend route. Pass it from the component. Update the query key to include the filter value.

   **Sync I/O in hot path**: Replace with the async `fs.promises` equivalent. Change the containing function to `async`. Update callers.

   **execSync in timed loop**: Replace with `exec` wrapped in `promisify` or `util.promisify`. Add a module-level cache object: `{ value, timestamp }`. Skip the subprocess call if `Date.now() - timestamp < TTL`.

   **psList called N times per cycle**: Extract the call to the top of the function that drives the cycle. Pass the result as a parameter to helper functions that currently call it independently.

   **Missing database index**: Add `CREATE INDEX IF NOT EXISTS idx_<table>_<column> ON <table>(<column>)` to the schema initialisation function.

   **Unbounded query**: Add a `LIMIT ?` clause. Update the function signature to accept a `limit` parameter with a sensible default (100–500).

   **Aggregation in JS**: Replace the `.reduce()` with a `SELECT SUM(...)` or `SELECT COUNT(*)` query.

   **Missing SQLite pragma**: Add the pragma to the database initialisation block.

   **Per-item broadcast**: Move the `broadcast()` call outside the loop. Collect items into an array, then broadcast once with the full array. Update the frontend handler to iterate the array.

   **Growing map without cleanup**: In the session-end handler (wherever `updateSessionStatus(id, 'ended', ...)` is called), add `this.watchers.get(id)?.close(); this.watchers.delete(id); this.filePositions.delete(id);` etc.

   **Watcher not closed on session end**: Close and delete the watcher in the same place session status is set to ended.

   **Missing event listener cleanup**: Add `return () => document.removeEventListener(...)` to the `useEffect`.

   **Lazy-loadable dependency**: Wrap the import in `React.lazy` and the usage in `<Suspense fallback={null}>`.

3. After each fix, verify no TypeScript errors are introduced in the affected file.
4. Log the fix.

---

## Step 12 — Verify

1. `cd backend && npm test` — must pass with zero failures.
2. `cd frontend && npm run build` — TypeScript must compile; build must succeed.
3. `cd frontend && npx vitest run` — must pass with zero failures.

If any step fails, diagnose and fix before committing.

---

## Step 13 — Commit

```
git add -A
git commit -m "perf: <summary of key improvements>

<bullet list of specific changes>

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
git push
```

The commit message must be specific: e.g. `remove 3 redundant polling intervals, batch WebSocket broadcasts, add useMemo to dashboard join` — not just `performance improvements`.

---

## Step 14 — Report

```
## Performance Pass Complete

| Category | Findings | Fixed |
|----------|----------|-------|
| Polling redundancy | N | N |
| React render performance | N | N |
| Data fetching (waterfalls / overfetch / N+1) | N | N |
| Backend sync I/O | N | N |
| Database (indexes / bounds / aggregations) | N | N |
| SQLite configuration | N | N |
| WebSocket broadcast efficiency | N | N |
| Resource cleanup / memory | N | N |
| Bundle / loading | N | N |
| **Total** | **N** | **N** |

### Key changes and expected impact
- <file>: <what changed> → <expected impact, e.g. "removes 200 req/min under normal load">
- ...

Build: ✅ | Backend tests: N passing | Frontend tests: N passing
```
