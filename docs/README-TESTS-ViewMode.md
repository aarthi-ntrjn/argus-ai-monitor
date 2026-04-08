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
| V0-06 | Check a detected (non-PTY) session card | A grey "read-only" badge is visible with tooltip "Start this session with argus launch to enable prompt injection"; there is no prompt input bar |
| V0-07 | Check an inactive session (idle > threshold) | An amber "resting" badge with a moon icon is shown instead of the normal status badge |

---

## V1: Session detail page

See [README-TESTS-SessionDetail.md](README-TESTS-SessionDetail.md).

---

## V2: Settings panel

See [README-TESTS-Settings.md](README-TESTS-Settings.md).

---

## V3: Todo panel

See [README-TESTS-Todo.md](README-TESTS-Todo.md).

---

## V4: Output stream and real-time updates

See [README-TESTS-OutputStream.md](README-TESTS-OutputStream.md).

---

## V5: Mobile layout

See [README-TESTS-Mobile.md](README-TESTS-Mobile.md).

---

## V6: Session lifecycle (start, end, idle, server up/down)

See [README-TESTS-Lifecycle.md](README-TESTS-Lifecycle.md).

---

## V7: Layout and scrollbar bugs

**Prerequisites:** Desktop viewport (>768px). Add enough todo items to fill the panel (10+).

| # | Steps | Expected |
|---|-------|----------|
| V7-01 | With no output pane open, add todos until the list is longer than the viewport | The todo panel scrolls internally; no page-level scrollbar appears |
| V7-02 | With no output pane open, check the bottom of the todo panel | There is visible breathing room between the bottom of the todo panel and the bottom of the viewport |
| V7-03 | Click a session card to open the output pane, with many todos in the list | The todo panel shrinks to fit below the output pane; it scrolls internally; no page-level scrollbar appears |
| V7-04 | With the output pane open, verify there is only one scrollbar on the todo panel | A single scrollbar appears inside the todo list area; there is no duplicate outer scrollbar |
| V7-05 | With the output pane open, scroll the todo list | Scrolling works within the todo panel only; the page itself does not scroll |
| V7-06 | Close the output pane (click X or press Escape) | The todo panel expands back to its standalone max height; no page-level scrollbar appears |
| V7-07 | Collapse the todo panel (click the header chevron) while the output pane is open | The output pane expands to fill the available space; no layout overflow |
| V7-08 | Resize the browser window vertically with the output pane and todo panel open | Both panels adjust to the new viewport height; no page-level scrollbar appears |
