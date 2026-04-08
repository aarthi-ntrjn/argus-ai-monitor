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

See [README-SESSIONDETAIL-TESTS.md](README-SESSIONDETAIL-TESTS.md).

---

## V2: Settings panel

See [README-SETTINGS-TESTS.md](README-SETTINGS-TESTS.md).

---

## V3: Todo panel

See [README-TODO-TESTS.md](README-TODO-TESTS.md).

---

## V4: Output stream and real-time updates

See [README-OUTPUTSTREAM-TESTS.md](README-OUTPUTSTREAM-TESTS.md).

---

## V5: Mobile layout

See [README-MOBILE-TESTS.md](README-MOBILE-TESTS.md).

---

## V6: Session lifecycle (start, end, idle, server up/down)

See [README-LIFECYCLE-TESTS.md](README-LIFECYCLE-TESTS.md).
