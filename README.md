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

- **Type badge** (copilot-cli / claude-code) and **status badge** (running / resting / ended / ...)
- **Model** in small monospace text when known (e.g. `claude-opus-4-5`)
- **PID** when known, or **session ID prefix** (e.g. `ID: abc12345`) for Claude Code sessions without a detected PID
- **Elapsed time** and a link to the full session detail page
- **Current prompt**: the most recent question you asked, shown below the badges and updated live as the conversation progresses (both Claude Code and Copilot CLI)
- **Last output preview**: up to 2 lines of the most recent tool result or message

### Session Output

Click any card to open a **live output pane** on the right. The card list stays visible on the left. Press **Escape** or click the **X** icon to close it. Click another card to switch sessions.

Output lines carry type badges so you always know what's what: **YOU** (your input), **AI** (assistant reply), **TOOL** (tool call), **RESULT** (tool result), **STATUS** (status change), **ERR** (error). Claude Code sessions stream everything in real time, including tool calls.

#### Focused and Verbose Mode

The output pane has two display modes, toggled via the **Focused / Verbose** button in the pane header:

- **Focused** (default): hides noisy tool results. Tool calls show a compact one-line summary. Click **show result** on any row to expand it inline. Your messages, AI replies, status changes, and errors are always visible.
- **Verbose**: shows everything. Long tool results (over 40 lines) are truncated with a **show more** button. Tool calls show their full content.

The selected mode persists across sessions and page reloads.

### Session Detection

Argus detects sessions using two sources:

- **Claude Code**: Reads `~/.claude/sessions/{PID}.json` files that Claude maintains. Each file maps a process ID to a session ID and working directory. This gives Argus a deterministic PID-to-session mapping that works with any number of concurrent sessions, even in the same repo. Sessions launched via `argus launch` get their PID from the PTY registry instead.
- **Copilot CLI**: Reads `inuse.{PID}.lock` files in `~/.copilot/session-state/{sessionId}/`.

In both cases, Argus checks every 5 seconds whether the session's PID is still running. If the process has exited, the session is marked **ended**. If a session has no PID yet (e.g., the registry file hasn't appeared), Argus falls back to JSONL file freshness with a configurable idle threshold (default: 60 minutes). The frontend shows a **resting** badge when there has been no output for 20 minutes but the process is still running.

## Control

Take charge of any session without touching the terminal.

### Starting a Session with Prompt Control

To send prompts to a session, start it through Argus using the `argus launch` command. This gives Argus a direct PTY write channel to the process.

```sh
# Claude Code
npm run launch --workspace=backend -- claude

# GitHub Copilot CLI
npm run launch --workspace=backend -- gh copilot suggest
```

Run this in any terminal: VS Code integrated terminal, Windows Terminal, iTerm2, or any other terminal emulator. The session appears in the Argus dashboard with a **live** badge and the prompt bar is enabled.

Sessions detected automatically (not started via `argus launch`) show a **read-only** badge. Their prompt bars are disabled. Interrupt (Esc) and Stop still work for any detected session since those use OS signals, not stdin.

### Prompt Bar

Every session card has a prompt bar. For **live** (PTY-launched) sessions, type a message and press **↵** to send it. Hit the **⋮** menu for quick commands:

| Command | Action |
|--------|--------|
| **Esc** | Interrupt the current operation (SIGINT / Ctrl+Break) — works for all sessions |
| **Exit** | Send `/exit` to close the session (requires confirmation) |
| **Merge** | Send `merge current branch with main` (requires confirmation) |
| **Pull latest** | Send `pull latest changes from main branch` (requires confirmation) |

Prompt injection works for both Claude Code and Copilot CLI when started via `argus launch`.

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
| Hide repos with no active sessions | Off | Hides repo cards that have no sessions with status `active`, `waiting`, or `error` |
| Hide inactive sessions | Off | Hides sessions with no output in the last 20 minutes |
| Idle threshold (min) | 60 | Minutes of JSONL inactivity before Argus checks the process. If the process is still running the session stays active (shows **resting**); if it has exited the session is marked `ended`. Saved to `~/.argus/config.json` via `PATCH /api/v1/settings`. Takes effect within 5 seconds. |

The first three settings are saved in your browser (`localStorage`) and restored on every load. The idle threshold is persisted server-side in `~/.argus/config.json`.

## Onboarding

New to Argus? A 6-step interactive tour launches automatically on your first visit. Dismiss it any time and replay it later from Settings.

| Feature | Behaviour |
|---------|-----------|
| **Welcome tour** | Auto-launches on first Dashboard load; advance, skip, or close any time |
| **Restart Tour** | Settings panel: resets all onboarding state and replays the tour from step 1 |
| **Session hints** | Three dismissible `?` badges on the session detail page; hover for a tooltip; persisted globally |

## Storage

Argus keeps its data in `~/.argus/`:

| File | Purpose |
|------|---------|
| `~/.argus/config.json` | Port, retention settings, watched directories |
| `~/.argus/argus.db` | SQLite: repos, sessions, output |

Default port: **7411**. Override in `~/.argus/config.json`:
```json
{
  "port": 7411,
  "sessionRetentionHours": 24,
  "idleSessionThresholdMinutes": 60
}
```

The `idleSessionThresholdMinutes` setting controls how long a Claude Code session can be quiet (no JSONL writes) before Argus checks whether the process is still running. Increase it for workflows with long pauses; decrease it for faster cleanup of dead sessions. Alternatively, change it live via the **Idle threshold** field in the Dashboard Settings panel, which calls `PATCH /api/v1/settings` without requiring a restart.

## For Contributors

See [docs/README-CONTRIBUTORS.md](docs/README-CONTRIBUTORS.md) for architecture, dev setup, API reference, security model, CI pipeline, and development guides.