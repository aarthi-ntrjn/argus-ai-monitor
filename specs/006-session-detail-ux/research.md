# Research: Session Detail UX Redesign

## Two-Pane Layout in React

**Decision**: Use a CSS flex/grid split-column layout controlled by a `selectedSessionId` state in `DashboardPage`. When `null`, only the card list is shown. When set, a right `OutputPane` renders alongside.

**Rationale**: React state is the simplest mechanism — no external library needed. TanStack Query already handles data fetching; the right pane reuses the same `getSessionOutput` hook. The layout uses Tailwind flex classes (`flex`, `flex-1`, `w-[420px]`) for easy responsive override.

**Alternatives considered**:
- URL-based selection (`/dashboard?session=X`): rejected — adds browser history noise for a transient view state
- Portal/overlay: rejected — the user asked for a side pane, not a modal
- Resizable split pane library: rejected — over-engineered for 2–10 sessions at a time

---

## Esc / Interrupt Mechanism for Claude Code Sessions

**Decision**: Add a new backend endpoint `POST /api/v1/sessions/:id/interrupt` and a new `ControlActionType` value `'interrupt'`. The backend sends SIGINT to the process PID if available; for Claude Code sessions with no PID, a best-effort attempt is made using the OS PID captured during detection.

**Rationale**: SIGINT (Ctrl+C equivalent) is the standard way to interrupt a foreground process without fully terminating it. It differs from SIGTERM (stop) in that Claude Code may handle SIGINT by cancelling the current tool use and returning control to the prompt, rather than exiting entirely. Using a separate endpoint (rather than overloading `/stop`) keeps the action semantics distinct and the action log interpretable.

**Alternatives considered**:
- Reuse `/stop` with a query param: rejected — conflates interrupt (pause current command) with stop (end session)
- Send `/interrupt` as a prompt text: rejected — Claude would interpret it as a message, not an OS signal
- Stdin injection: no accessible stdin channel for hook-detected sessions

**Constraint**: On Windows, `process.kill(pid, 'SIGINT')` is not supported. Use `taskkill /PID {pid}` without `/F` flag as the closest equivalent (sends Ctrl+Break). This is a known platform limitation and is documented in the error response.

---

## Claude OS PID Capture

**Decision**: In `ClaudeCodeDetector.scanExistingSessions()`, after confirming a Claude process is running, also capture its PID by selecting the first matching process from `psList`. Store the PID on the session record via `upsertSession`. In `handleHookPayload`, leave `pid: null` since hook payloads do not carry PID information — rely on the scan to back-fill it.

**Rationale**: `psList` returns PID for each process. We already call it during scan; adding one line to capture the PID costs nothing. The PID is best-effort: on systems where multiple Claude processes run, we take the first match. This is acceptable for a single-user local tool.

**Alternatives considered**:
- Parse hook payloads for PID: Claude hooks do not expose the process PID in their payload
- Persistent PID file written by Claude: not available without modifying Claude's startup config
- Skip PID and only show session ID: rejected — user explicitly requested the OS PID

---

## Last Output Preview on Card

**Decision**: The `SessionCard` component fetches the latest output page with `limit=1` via TanStack Query, keyed as `['session-output-last', session.id]`. The result is shown as a single truncated line below the session summary. Fetches are triggered lazily (only for visible cards) using `enabled: true` always since the dashboard only mounts cards that are in the filtered list.

**Rationale**: A per-card `limit=1` fetch is cheap (SQLite `ORDER BY sequence_number DESC LIMIT 1`). TanStack Query caches it and deduplicates inflight requests. The backend already supports `limit` and `before` pagination on the output endpoint.

**Alternatives considered**:
- Add `lastOutput` to the sessions list response: rejected — adds coupling between session and output data paths; prefer separation
- Store last output in `session.summary`: rejected — summary is a separate semantic field (Claude-generated description); conflating would lose the summary

---

## Quick Command Prompt Payloads

**Decision**: Quick commands map to fixed prompt strings sent via the existing `POST /api/v1/sessions/:id/send` endpoint:

| Button | Payload |
|--------|---------|
| Exit | `/exit` |
| Merge | `merge current branch with main` |
| Pull latest | `pull latest changes from main branch` |

**Rationale**: These are natural-language instructions that Claude Code understands. Using the existing send endpoint keeps the backend unchanged for these commands. Only Esc requires a new endpoint.

**Alternatives considered**:
- Structured command enum in backend: rejected — unnecessary backend complexity for what is just prompt text
- Separate endpoint per command: rejected — over-engineered; the send endpoint is already the right abstraction

---

## Inline Stop Confirmation

**Decision**: Replace `window.confirm()` with an inline card state. The `SessionCard` component tracks `exitConfirming: boolean`. When true, the Exit button is replaced with "Confirm Exit" + "Cancel" buttons.

**Rationale**: Browser `window.confirm()` blocks the JS thread, cannot be styled, and is jarring UX. An inline state toggle is idiomatic React and satisfies §XII (human-friendly UX).

**Alternatives considered**:
- Toast with undo: rejected — exit is not trivially reversible once `/exit` is sent
- Modal dialog: rejected — too heavy for a single card-level confirmation
