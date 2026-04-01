# Quickstart & Acceptance Test Scenarios

**Feature**: Session Dashboard | **Spec**: [spec.md](./spec.md)

These scenarios map directly to the feature's success criteria (SC-001 through SC-005).

---

## Prerequisites

- Node.js 22 LTS installed
- GitHub Copilot CLI (`copilot`) installed and has been used at least once (session state exists in `~/.copilot/session-state/`)
- Claude Code (`claude`) installed and configured
- At least 2 local git repositories exist on the machine
- Argus server running: `npm run dev` from repo root

---

## Scenario 1 — Repository Overview Dashboard (SC-001)

> _"Within 5 seconds of opening the dashboard, the user sees all registered repositories with correct session counts."_

**Steps**:
1. Register two repositories via the UI or `POST /api/repositories`
2. Start a Copilot CLI session in repository A: `cd /path/to/repo-a && copilot`
3. Start a Claude Code session in repository B: `cd /path/to/repo-b && claude`
4. Open `http://localhost:7411` in a browser

**Expected**:
- Both repositories appear within 5 seconds of page load
- Repository A shows `1 active session (copilot-cli)`
- Repository B shows `1 active session (claude-code)`
- No manual refresh required

---

## Scenario 2 — Real-Time Session Output (SC-002)

> _"Within 2 seconds of an AI agent producing output, it appears on the dashboard."_

**Steps**:
1. Open the dashboard and navigate to an active Copilot CLI session
2. In the terminal where Copilot CLI is running, type a prompt and submit
3. Observe the dashboard output panel

**Expected**:
- New output entries appear in the dashboard within 2 seconds of the terminal showing them
- Output type is correctly labeled (e.g., `tool_use`, `message`)
- Output is ordered chronologically with sequence numbers

---

## Scenario 3 — Session State After Copilot CLI Closes (SC-003)

> _"After a Copilot CLI session ends, it remains visible on the dashboard marked 'ended' for the configured retention period."_

**Steps**:
1. Start a Copilot CLI session in a registered repository
2. Verify it shows as `active` on the dashboard
3. Exit the Copilot CLI session (type `/exit` or Ctrl+D)
4. Observe the dashboard

**Expected**:
- Session status changes to `ended` within 10 seconds
- Session remains visible on the dashboard (not removed immediately)
- Session shows an `endedAt` timestamp
- Session disappears after the configured retention period (default 24h, or set to 1 minute for testing via `sessionRetentionHours: 0.0167` in config)

---

## Scenario 4 — Stop Session from Dashboard (SC-004)

> _"Clicking 'Stop' on an active session terminates the OS process within 5 seconds."_

**Steps**:
1. Start a Copilot CLI session in a registered repository
2. Verify it shows as `active` on the dashboard
3. Click the **Stop** button on that session's card
4. Observe both the dashboard and the terminal

**Expected**:
- A confirmation dialog appears before stopping
- After confirmation, the session status changes to `ended` within 5 seconds
- The terminal shows the process has terminated
- A `ControlAction` record with `status: completed` is created

---

## Scenario 5 — Add Repository via UI (SC-005)

> _"A repository can be added via the UI and its sessions appear within 10 seconds."_

**Steps**:
1. Open the dashboard with no repositories registered
2. Click **Add Repository**
3. Enter the absolute path to a local git repository that has an active Copilot CLI session
4. Click **Add**

**Expected**:
- Repository appears in the list within 10 seconds
- The active Copilot CLI session for that repository is detected and shown
- Attempting to add the same path again shows an error message: `"Repository already registered"`
- Attempting to add a non-git path shows an error: `"Path is not a git repository"`

---

## Manual Smoke Test (Run Before Each Release)

| Check | Expected |
|---|---|
| `GET http://localhost:7411/api/health` | `{"status":"ok"}` |
| Open dashboard with no repos | Empty state message shown, "Add Repository" button visible |
| Add a repo with an active session | Session appears within 10s |
| Refresh the page | Sessions reload correctly from server state |
| Stop a session | Session marked `ended` within 5s |
| Kill the Argus server and restart | All previously registered repos and ended sessions reload from SQLite |
