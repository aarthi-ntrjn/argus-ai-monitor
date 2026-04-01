# Argus

Local dashboard that monitors GitHub Copilot CLI and Claude Code sessions across your git repositories — real-time output, remote stop, all in a browser tab.

## What it does

- **Session visibility** — see every active Copilot CLI and Claude Code session, which repo it's running in, and live output as it streams
- **Remote control** — stop a session from the dashboard without touching the terminal
- **Auto-detection** — detects sessions already running when Argus starts; watches for new ones every 5 seconds
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

## Add repositories

**Single repo**: Click **Add Repository** → native folder picker opens → select any git repo folder → it appears on the dashboard immediately.

**Bulk import**: Click **Add Multiple** → pick a parent folder → Argus recursively scans all subdirectories → every git repo found is added in one go. Already-registered repos are skipped automatically.

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
| `POST` | `/api/v1/sessions/:id/stop` | Stop a running session |
| `POST` | `/api/v1/fs/pick-folder` | Open native OS folder picker, returns selected path |
| `POST` | `/api/v1/fs/scan-folder` | Recursively scan a folder for git repos, returns list |

## Tech stack

Fastify + Node.js backend · React + Vite frontend · SQLite (better-sqlite3) · WebSockets for live updates

