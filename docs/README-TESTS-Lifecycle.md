# Argus: Session Lifecycle Manual Tests

Manual tests for session state transitions across different scenarios: terminal starting, ending, going idle, and how the dashboard behaves when the Argus server is running vs not running.

**Prerequisites:**
1. `npm run dev` running (backend on `http://localhost:7411`)
2. At least one registered repository
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

## L1: Server starts after sessions already exist

**Prerequisites:** Stop the Argus server. Start one or more Claude Code and Copilot CLI sessions while the server is down, then start the server.

| # | Steps | Expected |
|---|-------|----------|
| L1-01 | Stop the Argus server. Start a Claude Code session in a registered repo. Then start the server and open the dashboard | The pre-existing Claude Code session is discovered on startup (via JSONL scan); it appears as "running" on the dashboard |
| L1-02 | Stop the Argus server. Start a Copilot CLI session in a registered repo. Then start the server and open the dashboard | The pre-existing Copilot CLI session is discovered on startup (via session-state scan); it appears as "running" |
| L1-03 | Stop the Argus server. Start a Claude Code session, then end it (type `/exit`). Then start the server | The ended session is detected as "ended" on startup (JSONL exists but PID is gone); dashboard shows it with a grey "ended" badge |
| L1-04 | Stop the Argus server. Start a Copilot CLI session, then end it. Then start the server | The ended session is detected as "ended" on startup (lock file gone or PID not running); dashboard shows it with a grey "ended" badge |

---

## L2: Session goes idle / resting (server running)

**Note:** Both Claude Code and Copilot CLI sessions show a "resting" state at the UX layer after exceeding the idle threshold.

| # | Steps | Expected |
|---|-------|----------|
| L2-01 | Leave a Claude Code session with no activity and wait past the resting threshold (default 20 min on frontend) | Session card shows an amber "resting" badge with a moon icon; card opacity reduces |
| L2-02 | After a Claude Code session shows "resting", send it a new prompt or trigger activity | Badge changes back from "resting" (amber) to "running" (green) within 5 seconds |
| L2-03 | Leave a Copilot CLI session idle for 20+ minutes | Session card shows an amber "resting" badge with a moon icon; card opacity reduces |
| L2-04 | After a Copilot CLI session shows "resting", send it a new prompt or trigger activity | Badge changes back from "resting" (amber) to "running" (green) within 5 seconds |

---

## L3: Session ends (server already running)

| # | Steps | Expected |
|---|-------|----------|
| L3-01 | In a running Claude Code session, type `/exit` | Session card transitions from "running" (green) to "ended" (grey) within a few seconds |
| L3-02 | In a running Copilot CLI session, end the session normally | Session card transitions from "running" (green) to "ended" (grey) within a few seconds |
| L3-03 | Kill a Claude Code session process externally (`kill <PID>` or Task Manager) | Session card transitions to "ended" within the next poll cycle (~5 seconds) |
| L3-04 | Kill a Copilot CLI session process externally | Session card transitions to "ended" within the next poll cycle (~5 seconds) |

---

## L4: Kill session via dashboard button

| # | Steps | Expected |
|---|-------|----------|
| L4-01 | On the dashboard, locate a running session card with a visible power button icon (right side of the meta row) | Power icon button is visible next to the "Details" link; it is only shown for sessions with a PID and status that is not "ended" or "completed" |
| L4-02 | Click the power button on a running session card | A confirmation dialog appears (via portal, above all content) asking "Are you sure you want to terminate this [type] session ([short-id])?" with Cancel and Kill Session buttons |
| L4-03 | In the confirmation dialog, click Cancel | Dialog closes; session is unaffected and still running |
| L4-04 | Click the power button again, then click Kill Session | Dialog switches to a spinner view showing "Killing session..." and "Waiting for the process to exit"; Cancel button and backdrop click are disabled |
| L4-05 | Wait for the process to exit after confirming kill | Spinner disappears, dialog closes automatically, session card updates to "ended" (grey badge) |
| L4-06 | Try to kill a session that has already ended (e.g. the power button should not be visible) | The power button is not rendered for ended/completed sessions |
| L4-07 | Kill a session on a card that has reduced opacity (inactive/resting session) | The confirmation dialog appears above all content (not trapped behind the card's opacity layer) |
| L4-08 | Kill a connected Claude Code session (launched via `argus launch`) | Dialog shows type "claude-code"; process terminates, card transitions to "ended" |
| L4-09 | Kill a read-only Claude Code session (detected, not launched via argus) | Dialog shows type "claude-code"; process terminates, card transitions to "ended" |
| L4-10 | Kill a connected Copilot CLI session (launched via `argus launch`) | Dialog shows type "copilot-cli"; process terminates, card transitions to "ended" |
| L4-11 | Kill a read-only Copilot CLI session (detected, not launched via argus) | Dialog shows type "copilot-cli"; process terminates, card transitions to "ended" |

---

## L5: Kill session from detail page

| # | Steps | Expected |
|---|-------|----------|
| L5-01 | Navigate to a running session's detail page; locate the power button in the meta row | Power icon button is visible in the session header meta row |
| L5-02 | Click the power button, then click Kill Session in the confirmation dialog | Spinner shows "Killing session..."; after the process exits, the page navigates back to the dashboard |
| L5-03 | On the dashboard, verify the killed session now shows "ended" status | Session card shows grey "ended" badge |
