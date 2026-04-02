# Quickstart: Session Stream Legibility, Model Display & Claude Code Fixes

**Feature**: `007-session-stream-model-fixes`  
**Branch**: `007-session-stream-model-fixes`

---

## Prerequisites

```bash
node -v  # 22+
cd C:\source\github\artynuts\argus
npm install
cd backend && npm install
cd ../frontend && npm install
```

---

## Running the Development Stack

```bash
# Terminal 1 — backend
cd backend
npm run dev

# Terminal 2 — frontend
cd frontend
npm run dev
# → http://localhost:5173
```

---

## Backend Tests

```bash
cd backend
npm test              # all tests
npm test -- --reporter=verbose  # verbose output
npm test -- events-parser       # single file
npm test -- claude-code-jsonl   # new parser tests
```

## Frontend Build

```bash
cd frontend
npm run build   # TypeScript check + Vite build
```

## E2E Tests

```bash
# from repo root
npx playwright test
npx playwright test sc-007  # this feature's tests only
```

---

## Manual Testing: Claude Code Output Stream

1. **Register a repository** in the Argus dashboard that you actively use with Claude Code.
2. **Start Claude Code** in that repository: open a terminal in the repo and run `claude`.
3. **Send any message** to Claude Code (e.g. "list the files in this directory").
4. **Open the Argus dashboard** and verify:
   - The Claude Code session card shows **"active"** status
   - The session model badge shows the model name (e.g. `claude-sonnet-4-5`)
   - Clicking the session card opens the output pane showing conversation items
5. **Send another message** to Claude Code and verify the output pane updates within 5 seconds.
6. **Exit Claude Code** (`/exit`) and verify the session transitions to **"ended"** within 15 seconds.

---

## Manual Testing: Active State Detection

1. **Start Argus** while Claude Code is already running in a monitored repo.
2. **Refresh the dashboard** — the session should appear as **"active"** immediately (not "ended").
3. **Verify no ghost sessions**: Open another repo that does NOT have Claude Code running — its session should show **"ended"**, not "active".

---

## Manual Testing: Output Stream Legibility

1. Open any active Copilot CLI session in the dashboard.
2. Verify:
   - User messages show a **"YOU"** badge (gray)
   - Assistant messages show an **"AI"** badge (blue)
   - Tool calls show **"TOOL"** badge (purple) with the tool name (e.g. `[Bash]`)
   - Tool results show **"RESULT"** badge (green)
   - Long messages wrap across lines (no horizontal overflow)

---

## Locating Claude Code JSONL Files (for debugging)

```
~/.claude/projects/{encoded-repo-path}/{session-id}.jsonl
```

Where `{encoded-repo-path}` replaces `:`, `\`, `/` with `-`.

**Example** (Windows):
```
C:\Users\you\.claude\projects\C--source-github-me-myproject\abc12345-xxxx.jsonl
```

To read the last 10 lines:
```powershell
Get-Content "$HOME\.claude\projects\C--source-github-me-myproject\*.jsonl" | Select-Object -Last 10
```

---

## Key Files

| File | Purpose |
|------|---------|
| `backend/src/services/claude-code-jsonl-parser.ts` | Parses Claude Code JSONL → `SessionOutput[]`; extracts model |
| `backend/src/services/claude-code-detector.ts` | Updated: JSONL file watching + fixed active-state scan |
| `backend/src/services/events-parser.ts` | Updated: adds `role` field |
| `backend/src/db/database.ts` | DB migration: model + role columns |
| `frontend/src/components/SessionDetail/SessionDetail.tsx` | Updated: role-aware labels, word wrapping |
| `frontend/src/components/SessionCard/SessionCard.tsx` | Updated: model badge |
