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
| G-02 | Check the available toggles | "Hide ended sessions", "Hide repos with no active sessions", and "Hide inactive sessions > 20 min" checkboxes are visible |
| G-03 | Check the idle threshold input | A number input for idle threshold in minutes is visible (default: 20, minimum: 1) |
| G-04 | Toggle **Hide ended sessions** ON | Ended session cards disappear from the dashboard |
| G-05 | Toggle **Hide ended sessions** OFF | Ended session cards reappear |
| G-06 | Toggle **Hide repos with no active sessions** ON | Repos that have only ended/completed sessions disappear |
| G-07 | Toggle **Hide repos with no active sessions** OFF | Hidden repos reappear |
| G-08 | Press **Escape** or click outside the panel | The settings panel closes |
| G-09 | Check the bottom of the settings panel | "Restart Tour" and "Reset Onboarding" links are visible |
