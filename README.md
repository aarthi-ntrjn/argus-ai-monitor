# Argus

A tool that monitors all Claude Code and GitHub Copilot sessions and allows you to control them remotely.

## Overview

Argus provides centralized visibility and remote control over your AI coding assistant sessions, including Claude Code and GitHub Copilot. Named after the all-seeing giant of Greek mythology, Argus keeps watch so you don't have to.

## Features

- **Session Dashboard** — Live-updating view of all registered repositories and their active AI sessions
- **Claude Code & Copilot CLI Detection** — Automatically detects active sessions from both tools
- **Startup Session Discovery** — On launch, Argus scans `~/.claude/projects/` for pre-existing Claude Code sessions and registers them immediately (no missed sessions)
- **Session End Detection** — Sessions are automatically marked `ended` when the underlying process exits, even if the session directory is cleaned up without a graceful shutdown event
- **Folder Browser** — Navigate your filesystem visually when adding repositories; git repos are highlighted with a badge
- **Bulk Repository Import** — Use the "Scan Folder" tab to scan a parent directory for all git repositories and add them in one step
- **Session Control** — Stop running sessions or send prompts to Claude Code sessions directly from the dashboard
- **Real-time Updates** — WebSocket broadcast keeps the dashboard live without manual refresh
- **Output Stream** — View paginated session output history with live append for active sessions

## Bug Fixes

- **Path matching on Windows** — Repository lookup is now case-insensitive (`LOWER(path) = LOWER(?)`) and paths are normalized before storage and comparison, fixing detection failures caused by drive-letter case or separator style differences
- **Session end detection** — `SessionMonitor` now diffs each scan result against a map of previously-active sessions; any session that disappears from scan results is immediately marked `ended` in the database and triggers a `session.ended` event

## Getting Started

### Prerequisites

- Node.js 22+
- npm 10+

### Install

```bash
npm install
```

### Run

```bash
# Start backend (port 7411)
cd backend && npm start

# In a separate terminal, start frontend dev server
cd frontend && npm run dev
```

Open `http://localhost:7411` to view the dashboard (served from the backend in production after `npm run build` in `frontend/`).

### API

The REST API is documented at `http://localhost:7411/api/docs` (Swagger UI).

Key endpoints:

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/repositories` | List registered repos |
| `POST` | `/api/v1/repositories` | Add a repository by path |
| `DELETE` | `/api/v1/repositories/:id` | Remove a repository |
| `GET` | `/api/v1/sessions` | List sessions (filterable by repo, status, type) |
| `POST` | `/api/v1/sessions/:id/stop` | Stop a running session |
| `GET` | `/api/v1/fs/browse` | Browse filesystem directories |
| `GET` | `/api/v1/fs/scan` | Scan a directory for git repositories |

## License

Private repository. All rights reserved.
