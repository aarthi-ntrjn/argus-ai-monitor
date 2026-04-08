# Argus: Mobile Layout Manual Tests

Manual tests for the mobile dashboard layout. Run these against a live Argus instance.

**Prerequisites:**
1. `npm run dev` running (backend on `http://localhost:7411`)
2. Resize browser to a narrow viewport (<768px) or use mobile device emulation

---

## M0: Mobile layout

| # | Steps | Expected |
|---|-------|----------|
| M-01 | Open the dashboard on a mobile viewport | A bottom tab bar with "Sessions" and "Tasks" tabs is visible; the sidebar is hidden |
| M-02 | The "Sessions" tab is active by default | Repository and session cards are stacked in a single column |
| M-03 | Tap the **Tasks** tab | The todo panel is shown full-width instead of the session list |
| M-04 | Tap the **Sessions** tab | The session list returns |
| M-05 | Tap a session card | Navigates to the session detail page (no inline output pane on mobile) |
