# Argus: Startup Manual Tests

Manual tests for server startup and the empty dashboard. Run these against a live Argus instance.

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
| S1-05 | Check the right sidebar (desktop only) | The "To Do or Not To Do" todo panel is visible with an empty task list and an input to add tasks |

---

## S2: Onboarding tour

See [README-TESTS-Onboarding.md](README-TESTS-Onboarding.md).
