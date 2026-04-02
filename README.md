# Argus

Local dashboard that monitors GitHub Copilot CLI and Claude Code sessions across your git repositories — real-time output, remote stop, all in a browser tab.

## What it does

- **Session visibility** — see every active Copilot CLI and Claude Code session, which repo it's running in, and live output as it streams
- **Two-pane output view** — click any session card to open a live output pane on the right without leaving the dashboard
- **Quick commands** — send **Esc** (interrupt), **Exit**, **Merge** with main, or **Pull latest** directly from the session card
- **Inline prompt** — type and send prompts to active Claude Code sessions straight from the dashboard card
- **Last output preview** — each card shows the most recent output line at a glance
- **Remote control** — stop or interrupt a session from the dashboard without touching the terminal; drill into the full session page for complete history
- **Auto-detection** — detects sessions already running when Argus starts; watches for new ones every 5 seconds; captures the OS PID for Claude Code sessions when possible
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

Settings are saved automatically in your browser (`localStorage`) and restored on every page load.

### Adding a new setting (developers)

1. Add a field with a default to `DashboardSettings` in `frontend/src/types.ts`
2. Add the default value to `DEFAULT_SETTINGS` in the same file
3. Add a toggle row in `frontend/src/components/SettingsPanel/SettingsPanel.tsx`
4. Consume it in any component via `const [settings] = useSettings()`

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
| `POST` | `/api/v1/sessions/:id/stop` | Stop a running session (SIGTERM) |
| `POST` | `/api/v1/sessions/:id/interrupt` | Interrupt the current operation in a session (SIGINT / Ctrl+Break). Returns 501 if the session has no OS PID. |
| `POST` | `/api/v1/sessions/:id/send` | Send a prompt string to an active Claude Code session |
| `POST` | `/api/v1/fs/pick-folder` | Open native OS folder picker, returns selected path |
| `POST` | `/api/v1/fs/scan-folder` | Recursively scan a folder for git repos, returns list |

## Tech stack

Fastify + Node.js backend · React + Vite frontend · SQLite (better-sqlite3) · WebSockets for live updates

