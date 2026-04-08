# Argus: Manual Test Plan

Manual tests to run against a live Argus instance with at least one real local repository and at least one real Claude Code or Copilot CLI session running.

**Setup required before running P0 tests:**
1. `npm run dev` (or `npm run build && npm start`)
2. At least two local git repositories registered in Argus
3. At least one active Claude Code session on one of the repos

---

## P0: Must pass before every release

### Dashboard loads

| # | Steps | Expected |
|---|-------|----------|
| P0-01 | Open `http://localhost:7411` in a browser | Dashboard loads within 5 seconds; no blank screen or console error |
| P0-02 | With repos registered, check the dashboard | Each registered repository appears as a card with its name |
| P0-03 | With an active Claude Code session running | The session card appears under the correct repo within 5 seconds |
| P0-04 | Check the session card type badge | Badge reads "claude-code" (orange) or "copilot-cli" (purple) matching the actual session type |
| P0-05 | Check the session card status badge | Active session shows "running" (green); completed shows "completed" (gray) |

### Session output visible

| # | Steps | Expected |
|---|-------|----------|
| P0-06 | Click a session card on the dashboard | Output pane opens on the right showing the session output stream |
| P0-07 | Wait 10 seconds with session actively running | Output pane updates with new lines without page refresh |
| P0-08 | Click "View details" link on a session card | Navigates to `/sessions/{id}` and shows the full session detail page |
| P0-09 | On the session detail page, scroll through output | All output items render; no layout breaks or JS errors |

### Stop session

| # | Steps | Expected |
|---|-------|----------|
| P0-10 | On a session detail page, click "Stop Session" | A confirmation dialog appears |
| P0-11 | Click Cancel in the Stop confirmation | Dialog closes; session remains running |
| P0-12 | Click Stop Session → confirm | Session status changes to "ended" or "completed" within 3 seconds |

---

## P1: Must pass before merging to main

### Repository management

| # | Steps | Expected |
|---|-------|----------|
| P1-01 | Click the "+" or "Add repository" button on the dashboard | Folder picker opens (native OS dialog) |
| P1-02 | Select a folder containing a `.git` directory | Repository is added and appears on the dashboard |
| P1-03 | Select a folder with no `.git` directory | Error message is shown; repository is not added |
| P1-04 | Select a folder already registered | Info message: "No new git repositories found"; no duplicate created |
| P1-05 | Click the remove/delete button on a repository card | Confirmation prompt appears |
| P1-06 | Confirm repository removal | Repo card disappears from the dashboard; its sessions are no longer shown |

### Session card details

| # | Steps | Expected |
|---|-------|----------|
| P1-07 | Session card for claude-code with no PID | Meta row shows "ID: xxxxxxxx" (first 8 chars of UUID) |
| P1-08 | Session card for copilot-cli with a PID | Meta row shows "PID: NNNN" |
| P1-09 | Session card for a claude-code session with model info | Model name appears in the meta row (e.g. "claude-opus-4-5") |
| P1-10 | Leave a session idle for 21+ minutes | Badge changes to "resting" (amber moon icon); card opacity reduces |
| P1-11 | Session with recent output | Last output line appears as a dark monospace preview at the bottom of the card |

### PTY launch and prompt delivery

**Prerequisite for P1-12a through P1-13b:** Start a session via `npm run launch --workspace=backend -- claude` (or `gh copilot suggest`) in any terminal, so a PTY-launched (live) session is visible on the dashboard.

| # | Steps | Expected |
|---|-------|----------|
| P1-12a | View a session started via `argus launch` | Session card shows a green **live** badge |
| P1-12b | View a session detected automatically (not via `argus launch`) | Session card shows a grey **read-only** badge |
| P1-12c | Click into the "Send a prompt…" input on a **live** (PTY) session card | Input is enabled, focused, and accepts text |
| P1-12d | Click into the "Send a prompt…" input on a **read-only** (detected) session card | Input is disabled; container shows tooltip "Start this session with argus launch to enable prompt injection" |
| P1-13a | On a live session: type a prompt and press Enter | Prompt is sent to the process via PTY; input clears; no error shown |
| P1-13b | On a live session: type a prompt and click ↵ | Same result as pressing Enter |
| P1-14 | Click ↵ with empty input on a live session | ↵ button is disabled (greyed out); nothing is sent |

### Prompt bar quick commands

| # | Steps | Expected |
|---|-------|----------|
| P1-15 | Click ⋮ actions menu on a session card | Dropdown shows: Esc, Exit, Merge, Pull latest |
| P1-16 | Click Esc in the actions menu | Interrupt is sent immediately; no confirmation dialog |
| P1-17 | Click Exit in the actions menu | Confirmation modal shows "Send /exit to close the session?" |
| P1-18 | In the Exit confirmation, click Cancel | Modal closes; session remains active; nothing is sent |
| P1-19 | In the Exit confirmation, click Confirm | `/exit` is sent to the session |
| P1-20 | Click Merge → Confirm | "merge current branch with main" prompt is sent to the session |
| P1-21 | Click Pull latest → Confirm | "pull latest changes from main branch" prompt is sent to the session |
| P1-22 | Open the actions menu, then press Escape | Dropdown closes |
| P1-23 | Open the actions menu, then click anywhere outside it | Dropdown closes |

### Settings panel

| # | Steps | Expected |
|---|-------|----------|
| P1-24 | Click the gear/settings icon in the dashboard header | Settings panel opens with all three toggles visible |
| P1-25 | Toggle "Hide ended sessions" ON | All ended/completed sessions disappear from the dashboard immediately |
| P1-26 | Toggle "Hide ended sessions" OFF | Ended sessions reappear immediately |
| P1-27 | Toggle "Hide ended sessions" ON, then reload the page | Setting is remembered; ended sessions are still hidden after reload |
| P1-28 | Toggle "Hide repos with no active sessions" ON | Repos with only ended sessions or no sessions disappear |
| P1-29 | All repos have only ended sessions + "Hide repos" is ON | Dashboard shows a "No repositories" (or equivalent) empty-state message, not a blank page |
| P1-30 | Toggle "Hide inactive sessions (>20 min)" ON | Sessions with lastActivityAt > 20 min ago are hidden |
| P1-31 | With both "Hide ended" and "Hide repos" ON | Both filters apply simultaneously and independently |

### Session detail page

| # | Steps | Expected |
|---|-------|----------|
| P1-32 | Navigate to `/sessions/{id}` for an active session | Page loads: session type, status badge, meta info, output stream visible |
| P1-33 | Check the back/breadcrumb navigation | Clicking back returns to the dashboard |
| P1-34 | View session detail for a completed session | Status shows "completed"; Stop button is not shown (or is disabled) |
| P1-35 | Prompt bar on session detail page: type and send | Prompt is sent to the session; input clears |

---

## P2: Should pass before release, can be deferred for hotfixes

### Edge cases

| # | Steps | Expected |
|---|-------|----------|
| P2-01 | No repos registered: open the dashboard | Empty-state message is shown with guidance to add a repo |
| P2-02 | Repo registered but no sessions: view repo card | Repo card shows "No sessions" message |
| P2-03 | Manually corrupt `argus:settings` in localStorage (DevTools), reload | Falls back to default settings (all sessions shown, all repos shown) |
| P2-04 | Open DevTools Console during normal use | No uncaught JS errors or React warnings during happy-path navigation |
| P2-05 | Multiple sessions of the same type on one repo | Each session appears as a separate card; ordered by start time (newest first) |
| P2-06 | Session with a very long summary line | Summary text is truncated to one line with ellipsis; no layout overflow |
| P2-07 | Long output content in the preview | Preview shows at most 2 lines; no overflow outside the card |
| P2-08 | Click "View details" while the output pane is open | Navigates to the detail page; previous pane state is discarded |

### Real-time updates

| # | Steps | Expected |
|---|-------|----------|
| P2-09 | Start a new session on a registered repo while dashboard is open | New session card appears within 5 seconds without manual refresh |
| P2-10 | Stop a session externally (kill the process) | Session status updates to "ended" within ~5 seconds |
| P2-11 | On the session detail page, generate new output in the session | Output stream updates in real time without refresh |
| P2-12 | Leave a claude-code or copilot-cli session with no activity for 21+ minutes while dashboard is open | Badge changes to "resting" (amber moon icon) without page refresh |

### Settings persistence

| # | Steps | Expected |
|---|-------|----------|
| P2-13 | Set "Hide ended sessions" ON, close and reopen the browser tab | Setting persists (ended sessions are still hidden) |
| P2-14 | Set "Hide repos" ON, navigate to a session detail page, then back | Dashboard filter is still active when you return |
| P2-15 | Set all three toggles ON, reload | All three settings restored correctly |

### Prompt error handling

| # | Steps | Expected |
|---|-------|----------|
| P2-16 | Send a prompt when the backend is offline (stop the server) | Inline error message appears below the prompt input |
| P2-17 | Send a prompt to a detected (read-only) session via a direct API call | API returns 202 with `status: failed` and a message "Prompt delivery requires starting this session via argus launch"; UI shows read-only state so the prompt bar is disabled |
| P2-18 | Attempt Stop on an already-ended session | Error or no-op with appropriate feedback; no crash |
| P2-19 | Start a PTY session via `argus launch claude`, send a prompt from the dashboard, then kill the `argus launch` process mid-delivery | Prompt bar shows an error message; session card transitions to read-only (live badge disappears) on next poll |
| P2-20 | Start a Copilot CLI session via `npm run launch --workspace=backend -- gh copilot suggest`, send a prompt from the dashboard | Prompt is delivered to the Copilot CLI process via PTY; input clears; no error |
