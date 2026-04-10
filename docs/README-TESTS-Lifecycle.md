# Argus: Session Lifecycle Manual Tests

Manual tests for session state transitions across different scenarios: terminal starting, ending, going idle, and how the dashboard behaves when the Argus server is running vs not running.

**Prerequisites:**
1. `npm run dev` running (backend on `http://localhost:7411`)
2. At least two registered repositories
3. Access to a terminal to start/stop Claude Code and Copilot CLI sessions manually

---

## L0: Session start: server already running (CC and GHCP)

| # | Steps | Expected |
|---|-------|----------|
| L0-01 | With the dashboard open, start a new Claude Code session (`claude`) directly in a registered repo (not via argus launch) | A new session card appears under the correct repo within 5 seconds; status badge is green "running"; badge is grey "read-only" (detected mode) |
| L0-02 | With the first session still running, start a second Claude Code session in the same repo | A second session card appears under the same repo; both cards are visible independently with their own badges |
| L0-03 | Repeat L0-01 using Copilot (`copilot`) instead of Claude Code | Same behaviour: session card appears under the correct repo within 5 seconds with a grey "read-only" badge |
| L0-04 | Repeat L0-02 with a second Copilot session in the same repo | A second Copilot session card appears; both Copilot cards are visible independently |
| L0-05 | With all sessions still running, restart the Argus server (`npm run dev`) and reload the dashboard | All previously running sessions reappear with their correct badges; no sessions are lost |
| L0-06 | With an active CC and GHCP session, stop the server, wait 2 minutes (sessions continue generating output), then restart | Both sessions are rediscovered; output generated during the server downtime is picked up and appears in the stream |

---

## L1: Session goes idle / resting (server running)

**Note:** Both Claude Code and Copilot CLI sessions show a "resting" state at the UX layer after exceeding the idle threshold.

| # | Steps | Expected |
|---|-------|----------|
| L-13 | Leave a Claude Code session with no activity and wait past the resting threshold (default 20 min on frontend) | Session card shows an amber "resting" badge with a moon icon; card opacity reduces |
| L-14 | After a Claude Code session shows "resting", send it a new prompt or trigger activity | Badge changes back from "resting" (amber) to "running" (green) within 5 seconds |
| L-15 | Leave a Copilot CLI session idle for 20+ minutes | Session card shows an amber "resting" badge with a moon icon; card opacity reduces |
| L-16 | After a Copilot CLI session shows "resting", send it a new prompt or trigger activity | Badge changes back from "resting" (amber) to "running" (green) within 5 seconds |

---

## L2: Server starts after sessions already exist

**Prerequisites:** Stop the Argus server. Start one or more Claude Code and Copilot CLI sessions while the server is down, then start the server.

| # | Steps | Expected |
|---|-------|----------|
| L-17 | Stop the Argus server. Start a Claude Code session in a registered repo. Then start the server and open the dashboard | The pre-existing Claude Code session is discovered on startup (via JSONL scan); it appears as "running" on the dashboard |
| L-18 | Stop the Argus server. Start a Copilot CLI session in a registered repo. Then start the server and open the dashboard | The pre-existing Copilot CLI session is discovered on startup (via session-state scan); it appears as "running" |
| L-19 | Stop the Argus server. Start a Claude Code session, then end it (type `/exit`). Then start the server | The ended session is detected as "ended" on startup (JSONL exists but PID is gone); dashboard shows it with a grey "ended" badge |
| L-20 | Stop the Argus server. Start a Copilot CLI session, then end it. Then start the server | The ended session is detected as "ended" on startup (lock file gone or PID not running); dashboard shows it with a grey "ended" badge |

---

## L3: Server is down during entire session lifecycle

| # | Steps | Expected |
|---|-------|----------|
| L-28 | Stop the Argus server. Start a Claude Code session, interact with it, then end it. Start the server | The session is detected on startup as "ended" (JSONL exists, PID gone); full output history is available in the output pane |
| L-29 | Stop the Argus server. Start a Copilot CLI session, interact with it, then end it. Start the server | The session is detected on startup as "ended" (no lock file or PID gone); output history from events.jsonl is available |
| L-30 | Stop the Argus server. Start and end multiple Claude Code sessions in the same repo. Start the server | The most recently modified JSONL is picked up; older sessions may not appear (only the latest per repo is scanned on startup) |
| L-31 | Stop the Argus server. Start and end multiple Copilot CLI sessions. Start the server | All session directories under `~/.copilot/session-state/` are scanned; each session appears with its correct status |

---

## L4: Mixed lifecycle transitions on the dashboard

| # | Steps | Expected |
|---|-------|----------|
| L-32 | Have a Claude Code session running and a Copilot CLI session running in the same repo | Both sessions appear as separate cards under the same repo; each has its correct type badge |
| L-33 | End the Claude Code session while the Copilot CLI session continues | Claude Code card transitions to "ended"; Copilot CLI card remains "running"; no cross-contamination |
| L-34 | Have a Claude Code session in "resting" state and start a new Claude Code session in the same repo | Both sessions appear: one with "resting" (amber), one with "running" (green) |
| L-35 | Have sessions across multiple repos, end all sessions in one repo | Only that repo's sessions transition to "ended"; other repos' sessions are unaffected |
| L-36 | With "Hide ended sessions" ON in settings, end a running session | The session card disappears from the dashboard as soon as it transitions to "ended" |
| L-37 | With "Hide ended sessions" ON, start a new session | The new session card appears normally (it is "running", not ended) |
| L-38 | With "Hide inactive sessions" ON, a Claude Code session goes idle past threshold | The session card disappears from the dashboard when it becomes "resting" |

---

## L5: Session ends (server already running)

| # | Steps | Expected |
|---|-------|----------|
| L-07 | In a running Claude Code session, type `/exit` | Session card transitions from "running" (green) to "ended" (grey) within a few seconds |
| L-08 | In a running Copilot CLI session, end the session normally | Session card transitions from "running" (green) to "ended" (grey) within a few seconds |
| L-09 | Kill a Claude Code session process externally (`kill <PID>` or Task Manager) | Session card transitions to "ended" within the next poll cycle (~5 seconds) |
| L-10 | Kill a Copilot CLI session process externally | Session card transitions to "ended" within the next poll cycle (~5 seconds) |
| L-11 | End a live (PTY) Claude Code session via the dashboard "Stop Session" button | Session status changes to "ended"; the "live" badge disappears; prompt bar becomes disabled |
| L-12 | End a live (PTY) Copilot CLI session via the dashboard "Stop Session" button | Session status changes to "ended"; the "live" badge disappears; prompt bar becomes disabled |
