# Argus: Startup & View-Mode Manual Tests

Manual tests for verifying the Argus web dashboard loads correctly and displays the expected UI in view (read-only) mode. Run these against a live Argus instance.

**Prerequisites:**
1. `npm run dev` running (backend on `http://localhost:7411`)

---

## S0: Server startup

| # | Steps | Expected |
|---|-------|----------|
| S0-01 | Run `npm run dev` from the Argus repo root | Backend starts on `http://localhost:7411`; console prints the listening address and port |
| S0-02 | Run `npm run dev` with `ARGUS_PORT=9000` set | Backend starts on port 9000 instead of the default |
| S0-03 | Open `http://localhost:7411/api/docs` in a browser | Swagger/OpenAPI documentation page loads with all API routes listed |
| S0-04 | Open `http://localhost:7411/api/v1/health` in a browser | Returns a JSON response with a healthy status |

---

## S1: Dashboard initial load (empty state)

**Prerequisites:** No repositories registered in Argus (fresh database or after running `reset-db.ps1`).

| # | Steps | Expected |
|---|-------|----------|
| S1-01 | Open `http://localhost:7411` in a browser | The dashboard loads; the Argus logo (PNG) and title "Argus" are visible in the header |
| S1-02 | Check the browser tab | The tab title reads "Argus"; the favicon matches the Argus logo |
| S1-03 | Look at the main content area | An empty state message reads "No repositories registered" with a prompt to click "Add Repository" |
| S1-04 | Check the header bar | A gear icon (settings) button and a blue "Add Repository" button are visible |
| S1-05 | Check the right sidebar (desktop only) | The "To Tackle" todo panel is visible with an empty task list and an input to add tasks |

---

## S2: Onboarding tour (first visit)

**Prerequisites:** Clear localStorage or click "Reset Onboarding" in settings to simulate a first visit.

| # | Steps | Expected |
|---|-------|----------|
| S2-01 | Open the dashboard for the first time (or after resetting onboarding) | The onboarding tour starts automatically; the first step highlights the header with a "Welcome Commander!" message |
| S2-02 | Click **Next** | The tour advances to step 2, highlighting the "Add Repository" button with an explanation of folder scanning |
| S2-03 | Click **Next** through all remaining steps | Each step highlights its target element (repo cards, session cards, settings, final message); progress counter updates (e.g. "3 of 6") |
| S2-04 | On the final step, click **Done** | The tour closes; the dashboard is fully interactive |
| S2-05 | Refresh the page | The tour does not restart (completion is persisted in localStorage) |
| S2-06 | Restart the tour: open Settings, click "Restart Tour" | The tour begins again from step 1 |
| S2-07 | Press **Escape** during any tour step | The tour closes immediately |
| S2-08 | Click **Skip** on any step | The tour closes; it does not restart on refresh |

---

## S3: Adding a repository

**Prerequisites:** At least one git repository exists on disk.

| # | Steps | Expected |
|---|-------|----------|
| S3-01 | Click the **Add Repository** button | A text input field appears prompting for a folder path |
| S3-02 | Enter a valid git repository path and press Enter | The repository card appears on the dashboard showing the repo name, full path, and current git branch |
| S3-03 | Enter the same path again | No duplicate is created; the existing repo remains unchanged |
| S3-04 | Enter an invalid or non-existent path | An error message is shown; no repo card is added |

---

## S4: Dashboard with repositories (populated state)

**Prerequisites:** At least one repository registered, with one or more sessions (active or ended).

| # | Steps | Expected |
|---|-------|----------|
| S4-01 | Open the dashboard | Repository cards are listed, each showing the repo name, path, branch, session count, and a "Launch with Argus" button |
| S4-02 | Check a session card within a repository | The card shows: type badge (orange "claude-code" or purple "copilot-cli"), status badge, model name, PID, elapsed time, and launch mode ("live" or "read-only") |
| S4-03 | Check an active session card | Status badge is green ("running"); elapsed time is ticking; last output preview is visible in a dark monospace block |
| S4-04 | Check an ended session card | Status badge is grey ("ended"); no kill button or prompt bar is visible |
| S4-05 | Check a live (PTY) session card | A green "live" badge is visible; a prompt input bar is shown below the output preview |
| S4-06 | Check a detected (non-PTY) session card | A grey "read-only" badge is visible; the prompt bar shows "read-only" text instead of an input |
| S4-07 | Check an inactive session (idle > threshold) | An amber "resting" badge with a moon icon is shown instead of the normal status badge |

---

## S5: Session detail page

**Prerequisites:** At least one session exists.

| # | Steps | Expected |
|---|-------|----------|
| S5-01 | Click the external link icon on a session card | The session detail page opens at `/sessions/:id` |
| S5-02 | Check the session detail header | A back button, type badge with icon, model name, status badge, PID, short session ID, and elapsed time are visible |
| S5-03 | Check the output stream area | Previous session output is displayed in chronological order with timestamps, role badges, and content |
| S5-04 | Check a live session detail page | A prompt input bar is visible below the output stream |
| S5-05 | Check a read-only session detail page | The prompt bar shows "read-only" text instead of an input |
| S5-06 | Click the **Back** button | Returns to the dashboard |

---

## S6: Settings panel

| # | Steps | Expected |
|---|-------|----------|
| S6-01 | Click the gear icon in the header | A settings dropdown panel opens |
| S6-02 | Check the available toggles | "Hide ended sessions", "Hide repos with no active sessions", and "Hide inactive sessions > 20 min" checkboxes are visible |
| S6-03 | Check the idle threshold input | A number input for idle threshold in minutes is visible (default: 20, minimum: 1) |
| S6-04 | Toggle **Hide ended sessions** ON | Ended session cards disappear from the dashboard |
| S6-05 | Toggle **Hide ended sessions** OFF | Ended session cards reappear |
| S6-06 | Toggle **Hide repos with no active sessions** ON | Repos that have only ended/completed sessions disappear |
| S6-07 | Press **Escape** or click outside the panel | The settings panel closes |
| S6-08 | Check the bottom of the settings panel | "Restart Tour" and "Reset Onboarding" links are visible |

---

## S7: Todo panel

| # | Steps | Expected |
|---|-------|----------|
| S7-01 | In the "To Tackle" panel, type a task and press Enter | The task appears in the list with an unchecked checkbox |
| S7-02 | Click the checkbox on a task | The task is marked as done (checkbox is checked; text styling changes) |
| S7-03 | Toggle **Hide completed** ON | Completed tasks disappear from the list |
| S7-04 | Toggle **Hide completed** OFF | Completed tasks reappear |
| S7-05 | Click the delete (trash) icon on a task | The task is removed from the list |
| S7-06 | Refresh the page | All tasks persist (stored in the database) |

---

## S8: Inline output pane (desktop)

**Prerequisites:** At least one session with output exists. Desktop viewport (>768px).

| # | Steps | Expected |
|---|-------|----------|
| S8-01 | Click on a session card | An output pane slides in on the right side showing the session's output stream |
| S8-02 | Click the same session card again | The output pane closes |
| S8-03 | Click a different session card while the pane is open | The pane updates to show the newly selected session's output |
| S8-04 | Press **Escape** while the output pane is open | The pane closes |

---

## S9: Mobile layout

**Prerequisites:** Resize browser to a narrow viewport (<768px) or use mobile device emulation.

| # | Steps | Expected |
|---|-------|----------|
| S9-01 | Open the dashboard on a mobile viewport | A bottom tab bar with "Sessions" and "Tasks" tabs is visible; the sidebar is hidden |
| S9-02 | The "Sessions" tab is active by default | Repository and session cards are stacked in a single column |
| S9-03 | Tap the **Tasks** tab | The todo panel is shown full-width instead of the session list |
| S9-04 | Tap the **Sessions** tab | The session list returns |
| S9-05 | Tap a session card | Navigates to the session detail page (no inline output pane on mobile) |

---

## S10: Real-time updates (WebSocket)

**Prerequisites:** The dashboard is open and at least one session is active.

| # | Steps | Expected |
|---|-------|----------|
| S10-01 | Open the dashboard with an active session | The session card's elapsed time updates in real time without refreshing |
| S10-02 | From another terminal, trigger activity on an active session | The session card's last output preview and status update automatically |
| S10-03 | End a session externally (e.g. type `/exit` in a Claude terminal) | The session card transitions to "ended" status within a few seconds without refreshing |
| S10-04 | Open browser DevTools > Network > WS tab | A WebSocket connection to `/ws` is active; events like `session.updated` appear in the message log |
