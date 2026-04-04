# Testing Guide

This document describes every test command available in the Argus monorepo.

---

## Quick reference

| Command | What runs | Needs server? |
|---|---|---|
| `npm test` | All backend tests (unit + integration + contract) | No |
| `npm run test:e2e` | Mocked E2E suite (browser, no real server) | No |
| `npm run test:e2e:ui` | Mocked E2E suite — interactive Playwright UI | No |
| `npm run test:e2e:real` | Real-server E2E suite (live backend, isolated DB) | Auto-started |
| `npm run test:e2e:real:ui` | Real-server E2E suite — interactive Playwright UI | Auto-started |

---

## Backend tests (`npm test`)

Runs all backend Vitest suites across the monorepo.

```powershell
npm test
```

### Test categories

**Unit** — `backend/tests/unit/`  
Fast, no I/O. Each test module is isolated with mocks.

| File | What it covers |
|---|---|
| `session-monitor.test.ts` | Session scan loop, stale-session reconciliation, null-PID skip logic |
| `session-controller.test.ts` | Stop/send action dispatch |
| `events-parser.test.ts` | Claude Code `events.jsonl` parser |
| `claude-code-detector-scan.test.ts` | `scanExistingSessions()` Windows path-matching and re-activation logic |

**Integration** — `backend/tests/integration/`  
Spin up real SQLite (temp DB via `ARGUS_DB_PATH`) and real file fixtures.

| File | What it covers |
|---|---|
| `copilot-cli-detector.test.ts` | Full parse → insert pipeline from real YAML fixture files |
| `claude-code-detector.test.ts` | Hook POST payload → session record creation |
| `output-store.test.ts` | Paginated reads, size-limit pruning |

**Contract** — `backend/tests/contract/`  
Start a real Fastify server and make actual HTTP calls.

| File | What it covers |
|---|---|
| `repositories.test.ts` | `GET/POST/DELETE /api/v1/repositories` — status codes, shapes, error cases |
| `sessions.test.ts` | `GET /api/v1/sessions`, `GET /api/v1/sessions/:id`, `POST .../stop` |

#### Additional backend commands

```powershell
# Run with coverage report
npm run test:coverage --workspace=backend

# Run only contract tests
npm run test:contract --workspace=backend
```

---

## Mocked E2E tests (`npm run test:e2e`)

Playwright tests that intercept every API call with `page.route()`. No backend required — the suite starts `npm run dev` only if a server isn't already on `http://localhost:7411`, and all responses are faked in-browser.

These are fast smoke tests for the frontend UI logic.

```powershell
npm run test:e2e          # headless
npm run test:e2e:ui       # interactive Playwright UI (pick tests, see trace)
```

> **Note**: For `--ui` mode, start the dev server first in a separate terminal (`npm run dev`), then run the UI command. If no server is running Playwright may fail to open the window.

> **Why `--ui-host` / `--ui-port`?** The `test:e2e:ui` script passes `--ui-host=localhost --ui-port=9323` so the Playwright UI opens in your browser at `http://localhost:9323` instead of launching an Electron window. The Electron-based UI does not render on this machine.

**Config**: `playwright.config.ts`  
**Tests**: `frontend/tests/e2e/sc-001-*.spec.ts`, `sc-002-*.spec.ts`, `sc-004-*.spec.ts`

---

## Real-server E2E tests (`npm run test:e2e:real`)

Playwright tests that run against an actual live backend with an isolated SQLite database. No `page.route()` mocking anywhere — every HTTP call hits the real API.

```powershell
# Prerequisites: build the frontend first (one-time, or after UI changes)
npm run build --workspace=frontend

# Run the real-server suite
npm run test:e2e:real          # headless
npm run test:e2e:real:ui       # interactive Playwright UI
```

**Config**: `playwright.real.config.ts`  
**Tests**: `frontend/tests/e2e/real-server/`  
**Port**: `7412` (separate from the dev server on `7411`)  
**Database**: temp file in `os.tmpdir()` — created and deleted automatically

### How isolation works

1. **`globalSetup`** creates two temporary directories with `.git/` subdirs (fake repos) so the API's git-repo validation passes during seeding.
2. Playwright starts a fresh backend on port 7412 with `ARGUS_PORT=7412` and `ARGUS_DB_PATH=<tmpdir>/argus-e2e-real-server.db`.
3. Each spec's `beforeAll` seeds data via real `POST` calls; `afterAll` cleans up with `DELETE`.
4. **`globalTeardown`** deletes the temp dirs and DB file.

The dev server on port 7411 is never touched.

---

## Choosing the right suite

- **Iterating on frontend UI?** → `npm run test:e2e:ui` (fast, no build needed)
- **Changing backend API behaviour?** → `npm test` + `npm run test:e2e:real`
- **CI full validation?** → `npm test && npm run test:e2e && npm run test:e2e:real`
- **Debugging a flaky test?** → add `:ui` to the relevant E2E command for the Playwright trace viewer
