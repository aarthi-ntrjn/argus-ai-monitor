# Argus: Mobile Layout Manual Tests

Manual tests for the mobile dashboard layout. Run these against a live Argus instance.

**Prerequisites:**
1. `npm run dev` running (backend on `http://localhost:7411`)
2. At least one repository registered with one or more sessions
3. Resize browser to a narrow viewport (<768px) or use mobile device emulation

---

## M0: Mobile layout

| # | Steps | Expected |
|---|-------|----------|
| M-01 | Open the dashboard on a mobile viewport | A bottom tab bar with "Sessions" and "Tasks" tabs is visible; the todo panel is not shown (only accessible via the Tasks tab) |
| M-02 | The "Sessions" tab is active by default | Repository and session cards are stacked in a single column |
| M-03 | Check a repository card | The repo name, path, branch, session count, and "Launch with Argus" button are visible |
| M-04 | Check a session card within a repository | Type badge, status badge, model name, PID, elapsed time, and launch mode badge are visible |
| M-05 | Tap the **Tasks** tab | The todo panel is shown full-width instead of the session list |
| M-06 | Tap the **Sessions** tab | The session list returns |
| M-07 | Tap a session card | Navigates to the session detail page (no inline output pane on mobile) |
