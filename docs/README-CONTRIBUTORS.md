# Argus: Contributor Guide

Argus is a local dashboard for monitoring and controlling Claude Code and GitHub Copilot CLI sessions. The backend watches AI tool files on disk, injects hooks, and stores everything in SQLite. The frontend connects over WebSockets and REST to display live session output and accept control commands.

For the user-facing README, see [../README.md](../README.md).

## Contents

- [Architecture](#architecture)
- [Dev Setup](#dev-setup)
- [Project Structure](#project-structure)
- [Key Patterns](#key-patterns)
- [Testing](#testing)
- [How-tos](#how-tos)
- [API Reference](#api-reference)
- [Security Model](#security-model)
- [CI & Supply Chain](#ci--supply-chain)

## Architecture

See [README-ARCH.md](README-ARCH.md) for the full architecture diagram and design decisions.

For a detailed comparison of how Claude Code and Copilot CLI sessions differ at the stream, parser, and state level, see [README-CLI-COMPARISON.md](README-CLI-COMPARISON.md).

**The short version:** The backend polls every 5 seconds for new sessions. Claude Code sessions are detected by watching `~/.claude/projects/**/*.jsonl` and via hooks injected into `~/.claude/settings.json`. Copilot CLI sessions are detected by reading `~/.copilot/session-state/` workspace files and lock files. All output is stored in SQLite and pushed to the browser over WebSockets. TanStack Query handles REST caching and cache invalidation on WS events.

Key design choices:

- **No AI APIs**: detection is purely file-system based
- **SQLite**: full session history with configurable retention (`pruning-job.ts`)
- **WebSocket push**: keeps the UI live without polling from the browser

## Dev Setup

```sh
# Install all dependencies
npm install

# Terminal 1: backend with hot reload
npm run dev

# Terminal 2: frontend with hot reload (optional, Vite dev server on :5173)
npm run dev --workspace=frontend
```

Open **http://localhost:7411** for the full app (backend serves the built frontend).
Open **http://localhost:5173** when running the Vite dev server for frontend hot-reload.

> Run `npm run build --workspace=frontend` once before using port 7411 if you haven't built yet.

## Project Structure

```
backend/
  src/
    api/          # Fastify routes (REST + WebSocket)
    config/       # Config loader (~/.argus/config.json)
    db/           # SQLite schema and database helpers
    models/       # Shared TypeScript types
    cli/          # PTY launcher entrypoint and supporting modules
      launch.ts                   # PTY launcher entrypoint; spawns tool, proxies I/O, connects to backend
      argus-launch-client.ts      # WebSocket client connecting to /launcher
      launch-command-resolver.ts  # resolves argv to session type and command
    services/     # Session detectors, session controller, output store, pruning
  tests/
    unit/         # Fast, no I/O
    integration/  # Real SQLite, real file fixtures
    contract/     # Real Fastify server, real HTTP calls

frontend/
  src/
    components/   # React components
    config/       # Tour steps, session hints
    hooks/        # useSettings, useOnboarding
    pages/        # DashboardPage, SessionPage
    services/     # API + WebSocket client
    utils/        # sessionUtils (isInactive, etc.)
  tests/
    e2e/          # Playwright (mocked and real-server suites)

docs/             # Architecture, contributor guide, testing guide, learnings
specs/            # Speckit feature specs (spec, plan, tasks per feature)
```

## Key Patterns

**Session detection pipeline (both session types):**
scan files on disk → upsert session in SQLite → start chokidar file watcher → parse new lines → write to OutputStore → broadcast over WebSocket

**Adding a new route:** add a Fastify plugin under `backend/src/api/routes/`, register it in `server.ts`, and add it to the API reference table in this file.

**WebSocket events:** `session.created`, `session.updated`, `session.ended`, `session.output`. Dispatched from `event-dispatcher.ts` via `broadcast()`. The frontend's `socket.ts` listens and calls `queryClient.invalidateQueries()` to refresh stale data.

**Frontend data flow:** TanStack Query fetches from REST on mount and re-fetches on WS events. Components read from the query cache; they never call the API directly.

**PTY prompt delivery:** `argus launch <tool>` spawns tool in PTY, connects to backend /launcher WebSocket, PtyRegistry maps sessionId to WebSocket, SessionController.sendPrompt() looks up registry and sends message, launcher writes to PTY stdin, then acks back.

## Testing

See [README-TESTS.md](README-TESTS.md) for the full testing guide and command reference.

Quick summary:

| Command | What runs |
|---------|-----------|
| `npm test` | All backend tests (unit + integration + contract) |
| `npm run test:e2e` | Mocked E2E suite (no server needed) |
| `npm run test:e2e:real` | Real-server E2E suite (live backend, isolated DB) |

## How-tos

### Adding a Dashboard Setting

1. Add a field with a default to `DashboardSettings` in `frontend/src/types.ts`
2. Add the default value to `DEFAULT_SETTINGS` in the same file
3. Add a toggle row in `frontend/src/components/SettingsPanel/SettingsPanel.tsx`
4. Consume it in any component via `const [settings, updateSetting] = useSettings()`

### Onboarding Developer Notes

Reset onboarding state in browser DevTools:
```js
localStorage.removeItem('argus:onboarding')
```

Tour targets use stable `data-tour-id` attribute selectors (e.g. `[data-tour-id="dashboard-header"]`), decoupled from CSS class names. See [`specs/012-user-onboarding/quickstart.md`](../specs/012-user-onboarding/quickstart.md) for the full developer guide.

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/repositories` | List registered repos |
| `POST` | `/api/v1/repositories` | Add a repository by path |
| `DELETE` | `/api/v1/repositories/:id` | Remove a repository |
| `GET` | `/api/v1/sessions` | List sessions (filterable by repo, status, type) |
| `GET` | `/api/v1/sessions/:id` | Get a single session by ID |
| `GET` | `/api/v1/sessions/:id/output` | Get paginated output for a session (`?limit=&before=`) |
| `POST` | `/api/v1/sessions/:id/stop` | Stop a running session (SIGTERM) |
| `POST` | `/api/v1/sessions/:id/interrupt` | Interrupt the current operation (SIGINT / Ctrl+Break). Returns 422 if PID not on record or process not running; 403 if PID does not belong to an AI tool. |
| `POST` | `/api/v1/sessions/:id/send` | Send a prompt string to a PTY-launched session (launchMode=pty). Returns 202 with a ControlAction (status: pending, completed, or failed). Requires the session to have been started via argus launch. |
| `WS` | `/launcher` | Bidirectional channel for the argus launch CLI. Handles: register (upsert session as pty), prompt_delivered/failed (ack), session_ended (mark ended). On disconnect: marks session ended and unregisters from PtyRegistry. |
| `GET` | `/api/v1/fs/browse` | List contents of a directory (path-sandboxed) |
| `GET` | `/api/v1/fs/scan` | Scan a directory for git repos (path-sandboxed) |
| `POST` | `/api/v1/fs/pick-folder` | Open native OS folder picker, returns selected path |
| `POST` | `/api/v1/fs/scan-folder` | Recursively scan a folder for git repos, returns list |
| `POST` | `/hooks/claude` | Receive push events from Claude Code hooks (internal) |
| `GET` | `/api/health` | Health check |
| `GET` | `/api/metrics` | Session, output, and action record counts |

## Security Model

Argus is a single-user localhost tool (`127.0.0.1` only). The following hardening measures are in place:

| Area | Protection |
|------|-----------|
| **Process control** | Stop/interrupt requests validate PID ownership in two stages: (1) the session must have a PID on record, and (2) the OS process at that PID must match the AI tool allowlist (Claude/Copilot). Requests that fail either check are rejected with 422 or 403. |
| **Shell injection** | All `taskkill` calls on Windows use `spawnSync` with an explicit args array: no shell string interpolation. |
| **Hook endpoint** | `POST /hooks/claude` enforces a 64 KB body limit, validates `session_id` as UUID v4, and ignores `cwd` values not registered as known repositories. Payloads attempting to overwrite an active session's PID are rejected with 409. |
| **Filesystem routes** | Browse, scan, and scan-folder endpoints resolve and validate all user-supplied paths against `homedir()` and registered repository paths. Paths outside this boundary return 403. Recursive directory scans skip symlinks to prevent traversal loops. |
| **Launcher WebSocket** | The /launcher route only accepts connections from processes on 127.0.0.1. The `register` message validates that the `repositoryPath` resolves to an existing directory. Session IDs are validated as non-empty strings. |
| **HTTP headers** | All responses include `X-Content-Type-Options: nosniff` and `X-Frame-Options: DENY`. No server version or runtime information is exposed. |

## AI Workflow Infrastructure

The repository includes several directories that support the AI-assisted development workflow used by maintainers. These are **not required** to build, run, or use Argus.

| Directory | Purpose |
|-----------|---------|
| `.specify/` | [Speckit](https://github.com/artynuts/speckit) specification-driven development framework. Contains templates, scripts, and the project constitution used to generate feature specs, plans, and tasks. |
| `.specify/memory/constitution.md` | Immutable project principles (coding standards, testing requirements, security rules). Enforced during the spec-to-implementation pipeline. |
| `.claude/commands/` | Custom slash commands for Claude Code (e.g., `/speckit.specify`, `/speckit.plan`). These orchestrate the Speckit workflow within Claude sessions. |
| `.github/agents/` | GitHub Copilot agent definitions that mirror the Claude commands for use in Copilot CLI. |
| `CLAUDE.md` | Instructions file that provides context to Claude Code when working in this repository. |
| `specs/` | Feature specifications generated by the Speckit pipeline. Each subdirectory (e.g., `specs/027-kill-session/`) contains the spec, plan, research, and task files for one feature. |

These directories are committed to the repository so that the development workflow is reproducible and auditable. They have no effect on the built application.

## CI & Supply Chain

Two GitHub Actions workflows protect the repository against supply chain attacks:

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `ci.yml` | Every push and PR | Build, test, audit |
| `supply-chain.yml` | PRs to `master` only | Dependency advisory check |

### What the CI pipeline enforces

| Protection | Mechanism |
|------------|-----------|
| **Lockfile integrity** | `npm ci` fails if `package-lock.json` is absent or any package hash doesn't match. The lockfile is never regenerated in CI. |
| **No lifecycle scripts** | `npm ci --ignore-scripts` suppresses all `postinstall`/`prepare` scripts. Only packages on the allowlist (`.github/supply-chain/lifecycle-allowlist.yml`) are rebuilt via `npm rebuild`. |
| **Action SHA pinning** | Every `uses:` directive in every workflow file must reference a 40-character commit SHA. A validation script runs on every CI build and fails if any reference is unpinned. |
| **Exact dependency versions** | All entries in `backend/package.json` and `frontend/package.json` use exact versions (no `^` or `~`). Combined with lockfile enforcement, this eliminates version drift from local `npm install` runs. |
| **Dependency advisory check** | PRs that add a dependency with a critical advisory or malicious flag are blocked before merge. |
| **Critical CVE audit** | `npm audit --audit-level=critical` runs on every build against the committed lockfile. |

### Responding to CI failures

**Lockfile mismatch**: Run `npm install` locally to regenerate the lockfile, commit the updated `package-lock.json`, and push.

**Unpinned action**: Use `git ls-remote https://github.com/<owner>/<repo> "refs/tags/<tag>.*" | tail -1` to find the SHA. Add it as `uses: owner/repo@<sha> # vX.Y.Z`. See `.github/supply-chain/action-shas.md` for the current pinned SHAs.

**Lifecycle script blocked**: Add the package to `.github/supply-chain/lifecycle-allowlist.yml` with a non-empty `reason` and `environments` field. Requires PR review.

**Dependency advisory blocked**: Remove the flagged package, find an alternative, or open a PR with a maintainer override justification if the advisory is a false positive.
