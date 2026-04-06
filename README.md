﻿# Argus

Your command center for Claude Code and GitHub Copilot CLI sessions. Watch every session live, send commands, and stop runaway agents, all from a single browser tab.

## Requirements

- Node.js 22 LTS
- GitHub Copilot CLI and/or Claude Code installed

## Getting Started

```sh
# 1. Install dependencies (once)
npm install

# 2. Build the frontend (once, or after frontend changes)
npm run build --workspace=frontend

# 3. Start the server
npm run dev
```

Open **http://localhost:7411** and you're in.

## Monitor

See everything happening across your AI sessions without switching terminals.

### Session Cards

Each card is a live snapshot of a session:

- **Type badge** (copilot-cli / claude-code) and **status badge** (running / idle / ended / resting / ...)
- **Model** in small monospace text when known (e.g. `claude-opus-4-5`)
- **PID** when known, or **session ID prefix** (e.g. `ID: abc12345`) for Claude Code sessions without a detected PID
- **Elapsed time** and a link to the full session detail page
- **Last output preview**: up to 2 lines of the most recent tool result or message

### Session Output

Click any card to open a **live output pane** on the right. The card list stays visible on the left. Press **Escape** or click the **X** icon to close it. Click another card to switch sessions.

Output lines carry type badges so you always know what's what: **YOU** (your input), **AI** (assistant reply), **TOOL** (tool call), **RESULT** (tool result), **STATUS** (status change), **ERR** (error). Claude Code sessions stream everything in real time, including tool calls.

### Session Detection

Argus sniffs out sessions already running when it starts. For Claude Code, it only re-activates sessions whose JSONL file was modified in the last 30 minutes, preventing ghost sessions from cluttering your view. New sessions are picked up every 5 seconds. The OS PID is captured for Claude Code sessions when possible.

## Control

Take charge of any session without touching the terminal.

### Prompt Bar

Every session card has a prompt bar. Type a message and press **Enter** (or **Send**) to talk directly to a Claude Code session. Hit the **⋮** menu for quick commands:

| Command | Action |
|--------|--------|
| **Esc** | Interrupt the current operation (SIGINT / Ctrl+Break) |
| **Exit** | Send `/exit` to close the session (requires confirmation) |
| **Merge** | Send `merge current branch with main` (Claude Code only; requires confirmation) |
| **Pull latest** | Send `pull latest changes from main branch` (Claude Code only; requires confirmation) |

> Prompt injection works with Claude Code sessions only. Copilot CLI support is not available in v1.

### Repository Management

Click **Add Repository**, type or paste a root folder path (e.g. `C:\source` or `/home/user/projects`), then click **Scan &amp; Add**. Argus scans that folder recursively for git repos and registers all new ones in one go. Already-registered repos are skipped automatically.

## To Tackle

The **To Tackle** panel lives on the right side of the dashboard. Use it to jot down tasks, reminders, or notes while your AI sessions run.

- Add items with the input at the top, press **Enter** to save
- Check off completed items; toggle visibility of done items with the button in the header
- Delete items with the trash icon that appears on hover
- Toggle timestamps on/off to see when each item was added
- Items are stored in the local database and survive page refreshes

## Mobile Browser Support

Argus is fully usable on mobile browsers (390px and up). On narrow viewports:

- Sessions and Tasks views are accessible via a **bottom tab bar** (Sessions / Tasks).
- Tapping a session card opens the full **session detail page** instead of the inline output pane.
- The layout reflows automatically when the browser is resized across the 768px breakpoint.

Desktop layout (two-column with inline output pane) is unchanged.

## Dashboard Settings

Click the **gear icon** (top-right) to open Settings.

| Setting | Default | Description |
|---------|---------|-------------|
| Hide ended sessions | Off | Hides sessions with status `completed` or `ended` |
| Hide repos with no active sessions | Off | Hides repo cards that have no sessions with status `active`, `idle`, `waiting`, or `error` |
| Hide inactive sessions | Off | Hides sessions with no output in the last 20 minutes |

Settings are saved in your browser (`localStorage`) and restored on every load.

## Onboarding

New to Argus? A 6-step interactive tour launches automatically on your first visit. Dismiss it any time and replay it later from Settings.

| Feature | Behaviour |
|---------|-----------|
| **Welcome tour** | Auto-launches on first Dashboard load; advance, skip, or close any time |
| **Restart Tour** | Settings panel: replays the tour from step 1 |
| **Reset Onboarding** | Settings panel: clears stored state so the tour auto-launches again |
| **Session hints** | Three dismissible `?` badges on the session detail page; hover for a tooltip; persisted globally |

## Storage

Argus keeps its data in `~/.argus/`:

| File | Purpose |
|------|---------|
| `~/.argus/config.json` | Port, retention settings, watched directories |
| `~/.argus/argus.db` | SQLite: repos, sessions, output |

Default port: **7411**. Override in `~/.argus/config.json`:
```json
{ "port": 7411, "sessionRetentionHours": 24 }
```

## For Contributors

See [docs/README-CONTRIBUTORS.md](docs/README-CONTRIBUTORS.md) for architecture, dev setup, API reference, security model, CI pipeline, and development guides.