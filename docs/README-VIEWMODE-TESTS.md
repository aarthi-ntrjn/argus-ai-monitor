# Argus: View Mode Manual Tests

Manual tests for the dashboard view mode: session cards, session detail page, settings, output pane, mobile layout, and real-time updates. Run these against a live Argus instance.

**Prerequisites:**
1. `npm run dev` running (backend on `http://localhost:7411`)
2. At least one repository registered with one or more sessions (active or ended)

---

## V0: Dashboard with repositories (populated state)

| # | Steps | Expected |
|---|-------|----------|
| V0-01 | Open the dashboard | Repository cards are listed, each showing the repo name, path, branch, session count, and a "Launch with Argus" button |
| V0-02 | Check a session card within a repository | The card shows: type badge (orange "claude-code" or purple "copilot-cli"), status badge, model name, PID, elapsed time, and launch mode ("live" or "read-only") |
| V0-03 | Check an active session card | Status badge is green ("running"); elapsed time is ticking; last output preview is visible in a dark monospace block |
| V0-04 | Check an ended session card | Status badge is grey ("ended"); no kill button or prompt bar is visible |
| V0-05 | Check a live (PTY) session card | A green "live" badge is visible; a prompt input bar is shown below the output preview |
| V0-06 | Check a detected (non-PTY) session card | A grey "read-only" badge is visible; the prompt bar shows "read-only" text instead of an input |
| V0-07 | Check an inactive session (idle > threshold) | An amber "resting" badge with a moon icon is shown instead of the normal status badge |

---

## V1: Session detail page

**Prerequisites:** At least one session exists.

| # | Steps | Expected |
|---|-------|----------|
| V1-01 | Click the external link icon on a session card | The session detail page opens at `/sessions/:id` |
| V1-02 | Check the session detail header | A back button, type badge with icon, model name, status badge, PID, short session ID, and elapsed time are visible |
| V1-03 | Check the output stream area | Previous session output is displayed in chronological order with timestamps, role badges, and content |
| V1-04 | Check a live session detail page | A prompt input bar is visible below the output stream |
| V1-05 | Check a read-only session detail page | The prompt bar shows "read-only" text instead of an input |
| V1-06 | Click the **Back** button | Returns to the dashboard |

---

## V2: Settings panel

| # | Steps | Expected |
|---|-------|----------|
| V2-01 | Click the gear icon in the header | A settings dropdown panel opens |
| V2-02 | Check the available toggles | "Hide ended sessions", "Hide repos with no active sessions", and "Hide inactive sessions > 20 min" checkboxes are visible |
| V2-03 | Check the idle threshold input | A number input for idle threshold in minutes is visible (default: 20, minimum: 1) |
| V2-04 | Toggle **Hide ended sessions** ON | Ended session cards disappear from the dashboard |
| V2-05 | Toggle **Hide ended sessions** OFF | Ended session cards reappear |
| V2-06 | Toggle **Hide repos with no active sessions** ON | Repos that have only ended/completed sessions disappear |
| V2-07 | Press **Escape** or click outside the panel | The settings panel closes |
| V2-08 | Check the bottom of the settings panel | "Restart Tour" and "Reset Onboarding" links are visible |

---

## V3: Todo panel

See [README-TODO-TESTS.md](README-TODO-TESTS.md).

---

## V4: Inline output pane (desktop)

**Prerequisites:** At least one session with output exists. Desktop viewport (>768px).

| # | Steps | Expected |
|---|-------|----------|
| V4-01 | Click on a session card | An output pane slides in on the right side showing the session's output stream |
| V4-02 | Click the same session card again | The output pane closes |
| V4-03 | Click a different session card while the pane is open | The pane updates to show the newly selected session's output |
| V4-04 | Press **Escape** while the output pane is open | The pane closes |

---

## V5: Mobile layout

**Prerequisites:** Resize browser to a narrow viewport (<768px) or use mobile device emulation.

| # | Steps | Expected |
|---|-------|----------|
| V5-01 | Open the dashboard on a mobile viewport | A bottom tab bar with "Sessions" and "Tasks" tabs is visible; the sidebar is hidden |
| V5-02 | The "Sessions" tab is active by default | Repository and session cards are stacked in a single column |
| V5-03 | Tap the **Tasks** tab | The todo panel is shown full-width instead of the session list |
| V5-04 | Tap the **Sessions** tab | The session list returns |
| V5-05 | Tap a session card | Navigates to the session detail page (no inline output pane on mobile) |

---

## V6: Real-time updates (WebSocket)

**Prerequisites:** The dashboard is open and at least one session is active.

| # | Steps | Expected |
|---|-------|----------|
| V6-01 | Open the dashboard with an active session | The session card's elapsed time updates in real time without refreshing |
| V6-02 | From another terminal, trigger activity on an active session | The session card's last output preview and status update automatically |
| V6-03 | End a session externally (e.g. type `/exit` in a Claude terminal) | The session card transitions to "ended" status within a few seconds without refreshing |
| V6-04 | Open browser DevTools > Network > WS tab | A WebSocket connection to `/ws` is active; events like `session.updated` appear in the message log |
