# Argus: Repository Manual Tests

Manual tests for adding and removing repositories. Run these against a live Argus instance.

**Prerequisites:**
1. `npm run dev` running (backend on `http://localhost:7411`)

---

## R0: Adding a repository

**Prerequisites:** At least one git repository exists on disk.

| # | Steps | Expected |
|---|-------|----------|
| R-01 | Click the **Add Repository** button | A text input field appears prompting for a folder path |
| R-02 | Enter a valid git repository path and press Enter | The repository card appears on the dashboard showing the repo name, full path, and current git branch |
| R-03 | Enter the same path again | No duplicate is created; the existing repo remains unchanged |
| R-04 | Enter a folder path that contains multiple git repositories | Argus scans the folder and adds all discovered repos; an info message reads "Added N repositories" |
| R-05 | Enter the same folder path again | Info message reads "No new git repositories found in the specified folder." |
| R-06 | Enter a folder path that contains no git repositories | Info message reads "No new git repositories found in the specified folder." |
| R-07 | Enter an invalid or non-existent path | An error message is shown; no repo card is added |
| R-08 | Open the add repository dialog, then click **Cancel** | The dialog closes without adding any repository |
| R-09 | Open the add repository dialog, then press **Escape** | The dialog closes without adding any repository |

---

## R1: Removing a repository

**Prerequisites:** At least one repository registered.

| # | Steps | Expected |
|---|-------|----------|
| R-08 | Click the trash icon on a repository card | A confirmation dialog appears: "Remove **repo-name**? This will also delete all associated sessions and output history." |
| R-09 | Click **Cancel** | The dialog closes; the repository remains |
| R-10 | Press **Escape** while the dialog is open | The dialog closes; the repository remains |
| R-11 | Click **Remove** | The repository card disappears from the dashboard |
| R-12 | Check the "Don't ask again" checkbox, then click **Remove** on another repo | The repo is removed immediately; no confirmation dialog appears for subsequent removals |
| R-13 | Refresh the page and remove another repo | The "Don't ask again" preference persists; repo is removed without confirmation |
| R-14 | Re-add a previously removed repository path | The repository card reappears on the dashboard; previous sessions and output are gone |
| R-15 | With at least 2 Claude Code and 2 GitHub Copilot CLI sessions already running on the re-added repository, refresh the page | All 4 sessions are detected and appear on the dashboard under the correct repository card; each session card shows the correct summary subject line and output preview |
| R-15a | Refresh the page a second time | All session cards still show the correct summary subject line and output preview; nothing is lost or reset |
| R-16 | Launch a new Claude session on the re-added repository via **Launch with Argus** | The new session card appears under the correct repository card within 5 seconds |

---

## R2: Branch name updates

**Prerequisites:** At least one repository registered. The dashboard is open in the browser.

| # | Steps | Expected |
|---|-------|----------|
| R-20 | Note the branch badge shown on a repository card | The badge shows the current git branch (e.g. `master`) |
| R-21 | In a terminal, switch the repository to a different branch (`git checkout -b test-branch`) | Within 5 seconds the branch badge on the dashboard updates to `test-branch` without any page refresh |
| R-22 | Switch back to the original branch (`git checkout master`) | Within 5 seconds the badge reverts to `master` |
| R-23 | Switch branches while the Argus tab is in the background (another tab focused) | On returning to the Argus tab the badge shows the correct branch immediately (no stale value) |
| R-24 | Switch branches on a repository that has no active sessions | The badge still updates within 5 seconds |
| R-25 | Switch branches on a repository that has an active session running | The session card is unaffected; only the branch badge updates |
