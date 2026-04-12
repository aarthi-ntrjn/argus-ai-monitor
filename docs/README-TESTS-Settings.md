# Argus: Settings Panel Manual Tests

Manual tests for the settings panel. Run these against a live Argus instance.

**Prerequisites:**
1. `npm run dev` running (backend on `http://localhost:7411`)
2. At least one repository registered with both active and ended sessions

---

## G0: Settings panel

| # | Steps | Expected |
|---|-------|----------|
| G-01 | Click the gear icon in the header | A settings dropdown panel opens |
| G-02 | Check the available toggles | "Hide ended sessions", "Hide repos with no active sessions", and "Hide inactive sessions (>20 min)" checkboxes are visible |
| G-03 | Toggle **Hide ended sessions** ON | Ended session cards disappear from the dashboard |
| G-04 | Toggle **Hide ended sessions** OFF | Ended session cards reappear |
| G-05 | Toggle **Hide repos with no active sessions** ON | Repos that have only ended/completed sessions disappear |
| G-06 | Toggle **Hide repos with no active sessions** OFF | Hidden repos reappear |
| G-07 | Press **Escape** or click outside the panel | The settings panel closes |
| G-08 | Check the bottom of the settings panel | A "Restart Tour" link is visible |

---

## G1: Yolo mode

**Prerequisites:** At least one repository with Claude Code or Copilot installed.

| # | Steps | Expected |
|---|-------|----------|
| G-09 | Open Settings and check the "Launch Behaviour" section | A "Yolo mode" checkbox is visible under a "Launch Behaviour" heading, below the session filter toggles |
| G-10 | Toggle **Yolo mode** ON | A warning dialog appears explaining that all permission checks will be bypassed |
| G-11 | Click **Cancel** in the warning dialog | The dialog closes, the Yolo mode checkbox remains unchecked |
| G-12 | Toggle **Yolo mode** ON and click **Enable Yolo Mode** | The dialog closes, the checkbox is checked, and a yellow "All permission checks disabled" label appears beneath it |
| G-13 | With Yolo mode ON, copy a Claude launch command | The copied command includes `--dangerously-skip-permissions` |
| G-14 | With Yolo mode ON, copy a Copilot launch command | The copied command includes `--allow-all` |
| G-15 | Toggle **Yolo mode** OFF | No dialog appears; the checkbox unchecks immediately and the warning label disappears |
| G-16 | With Yolo mode OFF, copy a Claude launch command | The copied command does NOT include `--dangerously-skip-permissions` |
