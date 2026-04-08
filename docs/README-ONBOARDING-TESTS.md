# Argus: Onboarding Manual Tests

Manual tests for the onboarding tour and first-visit experience. Run these against a live Argus instance.

**Prerequisites:**
1. `npm run dev` running (backend on `http://localhost:7411`)

---

## O0: Onboarding tour (empty state, no repositories)

**Prerequisites:** Fresh database (or run `reset-db.ps1`) and clear localStorage.

| # | Steps | Expected |
|---|-------|----------|
| O-01 | Open the dashboard for the first time | The onboarding tour starts automatically; step 1 highlights the header with a "Welcome!" message |
| O-02 | Click **Next** | Step 2 highlights the "Add Repository" button with an explanation of folder scanning |
| O-03 | Click **Next** | Step 3 highlights the "To Do or Not To Do" panel with "Track your wild ideas here" |
| O-04 | On the final step (step 4), click **Done** | The tour closes with a "You're all set!" message; the dashboard is fully interactive |
| O-05 | Refresh the page | The tour does not restart (completion is persisted in localStorage) |

---

## O1: Onboarding tour (populated state, with repositories and sessions)

**Prerequisites:** Clear localStorage. At least one repository registered with both a live (command mode) and a detected (view mode) session.

| # | Steps | Expected |
|---|-------|----------|
| O-06 | Open the dashboard (or click "Reset Onboarding" in settings, then refresh) | The onboarding tour starts; step 1 highlights the header with a "Welcome!" message |
| O-07 | Click **Next** | Step 2 highlights the "Add Repository" button |
| O-08 | Click **Next** | Step 3 highlights a repository card, explaining that each card shows a repo and its live sessions |
| O-09 | Click **Next** | Step 4 highlights the session cards area, explaining that sessions launched outside Argus are read-only. A live session shows a green "live" badge with a prompt bar; a detected session shows a grey "read-only" badge with no prompt bar |
| O-10 | Click **Next** | Step 5 highlights the "Launch with Argus" button, explaining you can control AI sessions when launched from Argus |
| O-11 | Click **Next** | Step 6 highlights the "To Do or Not To Do" panel with "Track your wild ideas here" |
| O-12 | On the final step (step 7), click **Done** | The tour closes with a "You're all set!" message |

---

## O2: Tour controls

| # | Steps | Expected |
|---|-------|----------|
| O-13 | Press **Escape** during any tour step | The tour closes immediately |
| O-14 | Click **Skip** on any step | The tour closes; it does not restart on refresh |
| O-15 | Restart the tour: open Settings, click "Restart Tour" | The tour begins again from step 1 |
| O-16 | Click "Reset Onboarding" in Settings, then refresh | The tour auto-launches as if it were a first visit |
