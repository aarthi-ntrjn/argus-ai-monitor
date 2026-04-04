# Argus

Local dashboard that monitors GitHub Copilot CLI and Claude Code sessions across your git repositories — real-time output, remote stop, all in a browser tab.

## What it does

- **Session visibility** — see every active Copilot CLI and Claude Code session, which repo it's running in, and live output as it streams
- **Two-pane output view** — click any session card to open a live output pane on the right without leaving the dashboard
- **Role-labelled output** — messages from you and the AI are labelled **YOU** / **AI** so conversations are easy to follow at a glance
- **Model badge** — the AI model in use (e.g. `claude-opus-4-5`) is shown on each session card and the session detail page
- **Claude Code output streaming** — Argus reads Claude Code's JSONL conversation files in real-time and streams all content into the output pane, including tool calls
- **Quick commands** — send **Esc** (interrupt), **Exit**, **Merge** with main, or **Pull latest** directly from the session card
- **Inline prompt** — type and send prompts to active Claude Code sessions straight from the dashboard card
- **Last output preview** — each card shows the most recent output line at a glance
- **Remote control** — stop or interrupt a session from the dashboard without touching the terminal; drill into the full session page for complete history
- **Auto-detection** — detects sessions already running when Argus starts; for Claude Code, only re-activates sessions whose JSONL conversation file was modified in the last 30 minutes (prevents ghost sessions); watches for new ones every 5 seconds; captures the OS PID for Claude Code sessions when possible
- **Repository management** — add repos one at a time, browse your filesystem to pick the right folder, or scan a parent directory to bulk-import all git repos inside it

## Requirements

- Node.js 22 LTS
- GitHub Copilot CLI and/or Claude Code installed

## Run

```sh
# 1. Install dependencies (once)
npm install

# 2. Build the frontend (once, or after frontend changes)
cd frontend && npm run build && cd ..

# 3. Start the server
npm run dev
```

Open **http://localhost:7411**

## Session Cards

Each session card on the dashboard shows:

- **Type badge** (copilot-cli / claude-code) and **status badge** (active / idle / ended / …)
- **Model** — the AI model name when known (e.g. `claude-opus-4-5`), displayed in small monospace text next to the type badge
- **PID** when known, or **session ID prefix** (e.g. `ID: abc12345`) for Claude Code sessions without a detected PID
- **Elapsed time** and a **View details** link to the full session page
- **Last output line** — most recent output truncated to one line

### Quick commands

Buttons appear on each active session card:

| Button | Action |
|--------|--------|
| **Esc** | Send an interrupt signal (SIGINT / Ctrl+Break) to cancel the current operation |
| **Exit** | Send `/exit` (requires confirmation) |
| **Merge** *(claude-code only)* | Send `merge current branch with main` |
| **Pull latest** *(claude-code only)* | Send `pull latest changes from main branch` |

### Inline prompt

Active Claude Code cards include a text input. Type a message and press **Enter** (or click **Send**) to send it directly to the session.

### Two-pane output view

Click anywhere on a session card to open a **live output pane** on the right side of the dashboard. The card list stays visible on the left. Press **Escape** or click **✕** to close the pane. Click a different card to switch the pane to that session.



**Single repo / Bulk import**: Click **Add Repository** → native folder picker opens → if the selected folder is a git repo it is added immediately; if not, Argus scans all subdirectories and adds every git repo found in one go. Already-registered repos are skipped automatically.

## Dashboard Settings

Click the **⚙ gear icon** in the top-right of the dashboard header to open the Settings panel.

| Setting | Default | Description |
|---------|---------|-------------|
| Hide ended sessions | Off | When turned on, sessions with status `completed` or `ended` are hidden from all repository cards |
| Hide repos with no active sessions | Off | When turned on, repository cards are hidden if they have no sessions with status `active`, `idle`, `waiting`, or `error` (including repos with zero sessions) |
| Hide inactive sessions | Off | When turned on, sessions with no output in the last 20 minutes are hidden from all repository cards |

Settings are saved automatically in your browser (`localStorage`) and restored on every page load.

### Adding a new setting (developers)

1. Add a field with a default to `DashboardSettings` in `frontend/src/types.ts`
2. Add the default value to `DEFAULT_SETTINGS` in the same file
3. Add a toggle row in `frontend/src/components/SettingsPanel/SettingsPanel.tsx`
4. Consume it in any component via `const [settings, updateSetting] = useSettings()`

## Config

Argus stores config and the session database in `~/.argus/`:

| File | Purpose |
|------|---------|
| `~/.argus/config.json` | Port, retention settings, watched directories |
| `~/.argus/argus.db` | SQLite — repos, sessions, output |

Default port: **7411**. Override in `~/.argus/config.json`:
```json
{ "port": 7411, "sessionRetentionHours": 24 }
```

## API

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/repositories` | List registered repos |
| `POST` | `/api/v1/repositories` | Add a repository by path |
| `DELETE` | `/api/v1/repositories/:id` | Remove a repository |
| `GET` | `/api/v1/sessions` | List sessions (filterable by repo, status, type) |
| `GET` | `/api/v1/sessions/:id` | Get a single session by ID |
| `GET` | `/api/v1/sessions/:id/output` | Get paginated output for a session (`?limit=&before=`) |
| `POST` | `/api/v1/sessions/:id/stop` | Stop a running session (SIGTERM) |
| `POST` | `/api/v1/sessions/:id/interrupt` | Interrupt the current operation in a session (SIGINT / Ctrl+Break). Returns 422 if PID not on record or process not running; 403 if PID does not belong to an AI tool. |
| `POST` | `/api/v1/sessions/:id/send` | Send a prompt string to an active Claude Code session |
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
| **Shell injection** | All `taskkill` calls on Windows use `spawnSync` with an explicit args array — no shell string interpolation. |
| **Hook endpoint** | `POST /hooks/claude` enforces a 64 KB body limit, validates `session_id` as UUID v4, and ignores `cwd` values not registered as known repositories. Payloads attempting to overwrite an active session's PID are rejected with 409. |
| **Filesystem routes** | Browse, scan, and scan-folder endpoints resolve and validate all user-supplied paths against `homedir()` and registered repository paths. Paths outside this boundary return 403. Recursive directory scans skip symlinks to prevent traversal loops. |
| **HTTP headers** | All responses include `X-Content-Type-Options: nosniff` and `X-Frame-Options: DENY`. No server version or runtime information is exposed. |

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
| **Dependency advisory check** | PRs that add a dependency with a critical advisory or malicious flag are blocked before merge. |
| **Critical CVE audit** | `npm audit --audit-level=critical` runs on every build against the committed lockfile. |

### Responding to CI failures

**Lockfile mismatch**: Run `npm install` locally to regenerate the lockfile, commit the updated `package-lock.json`, and push.

**Unpinned action**: Use `git ls-remote https://github.com/<owner>/<repo> "refs/tags/<tag>.*" | tail -1` to find the SHA. Add it as `uses: owner/repo@<sha> # vX.Y.Z`. See `.github/supply-chain/action-shas.md` for the current pinned SHAs.

**Lifecycle script blocked**: Add the package to `.github/supply-chain/lifecycle-allowlist.yml` with a non-empty `reason` and `environments` field. Requires PR review.

**Dependency advisory blocked**: Remove the flagged package, find an alternative, or — if the advisory is a false positive — open a PR with a maintainer override justification.

## Tech stack

Fastify + Node.js backend · React + Vite frontend · SQLite (better-sqlite3) · WebSockets for live updates

