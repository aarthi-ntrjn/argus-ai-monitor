# Argus: Onboarding Manual Tests

Manual tests for the onboarding tour and first-visit experience. Run these against a live Argus instance.

**Prerequisites:**
1. `npm run dev` running (backend on `http://localhost:7411`)
2. At least one repository registered with both a live (command mode) and a detected (view mode) session

---

## O0: Onboarding tour (first visit)

**Prerequisites:** Clear localStorage or click "Reset Onboarding" in settings to simulate a first visit.

| # | Steps | Expected |
|---|-------|----------|
| O-01 | Open the dashboard for the first time (or after resetting onboarding) | The onboarding tour starts automatically; step 1 highlights the header with a "Welcome!" message |
| O-02 | Click **Next** | Step 2 highlights the "Add Repository" button with an explanation of folder scanning |
| O-03 | Click **Next** | Step 3 highlights a repository card, explaining that each card shows a repo and its live sessions |
| O-04 | Click **Next** | Step 4 highlights the session cards area, explaining that sessions launched outside Argus are read-only |
| O-05 | Click **Next** | Step 5 highlights the "Launch with Argus" button, explaining you can control AI sessions when launched from Argus |
| O-06 | Click **Next** | Step 6 highlights the settings gear, explaining filtering options |
| O-07 | On the final step (step 7), click **Done** | The tour closes with a "You're all set!" message; the dashboard is fully interactive |
| O-08 | Refresh the page | The tour does not restart (completion is persisted in localStorage) |
| O-09 | Restart the tour: open Settings, click "Restart Tour" | The tour begins again from step 1 |
| O-10 | Press **Escape** during any tour step | The tour closes immediately |
| O-11 | Click **Skip** on any step | The tour closes; it does not restart on refresh |

---

## O1: Tour content accuracy

**Prerequisites:** At least one repository with a live (PTY) session and a detected (read-only) session visible on the dashboard.

| # | Steps | Expected |
|---|-------|----------|
| O1-01 | Advance to the "AI Sessions" step (step 4) | The tooltip points to the session cards area |
| O1-02 | Read the tooltip content | It explains that sessions launched outside Argus are read-only |
| O1-03 | Look at the session cards behind the overlay | A live session shows a green "live" badge with a prompt bar; a detected session shows a grey "read-only" badge with no prompt bar |
| O1-04 | Advance to the "Launch with Argus" step (step 5) | The tooltip points to the "Launch with Argus" button on a repo card |
| O1-05 | Read the tooltip content | It mentions that you can control AI sessions when launched from Argus |

---

## O2: Session detail contextual hints

**Prerequisites:** Tour already completed. At least one live (command mode) session exists.

| # | Steps | Expected |
|---|-------|----------|
| O2-01 | Navigate to the session detail page of a live session | Three hint badges are visible next to: the status badge, the prompt bar, and the output stream |
| O2-02 | Hover over the prompt bar hint badge | A tooltip appears explaining that Enter sends a prompt, Escape interrupts, and that read-only (view mode) sessions cannot receive prompts |
| O2-03 | Hover over the output stream hint badge | A tooltip appears explaining that output streams for both command mode and view mode sessions |
| O2-04 | Click the dismiss button on a hint badge | The hint disappears |
| O2-05 | Refresh the page | The dismissed hint stays gone; remaining hints are still visible |
