﻿# Argus

Your command center for Claude Code and GitHub Copilot CLI sessions. Watch every session live, send commands, and stop runaway agents, all from a single browser tab.

## Requirements

- Node.js 22 LTS  
  [aarthin] isnt Node.js actually installed with Argus npm install. Is this really required as a pre-req?
- GitHub Copilot CLI and/or Claude Code installed

## Getting Started

```sh
# 1. Install dependencies (once)
npm install

# 2. Build the frontend (once, or after frontend changes)
npm run build --workspace=frontend
[aarthin] this is a comment for contributors. not for folks who are just using it. isnt it. what is the right way to address this properly for users vs contributors. should npm run dev first build?

# 3. Start the server
npm run dev
[aarthin] for users who are not contributors should they really do a run dev. should they have a different command like argus start or something? need to decide how best to package this. learn from clawbot.

```

Open **http://localhost:7411** and you're in.  
[aarthin] we need to make this configurable somewhere.

## Monitor

See everything happening across your AI sessions without switching terminals.  
[aarthin] add images to the README.md

### Session Cards

Each card is a live snapshot of a session:

- **CLI badge** (copilot-cli / claude-code) Argus currently support GitHub Copilot CLI and Claude Code CLI
- **status badge** (running / resting / ended) Running - for conversations that have had activity within the configured resting threshold (default: 20 minutes), resting for conversations that have had no activity beyond the threshold, Ended for conversations that have exited.
- **session type** (readonly / live) readonly - for conversation that were started outside of Argus, these sessions can be monitored only, they cannot be controlled from Argus. live - for conversations that were started from Argus using _Lauch with Argus_, these sessions can be monitored and controlled from Argus using the send prompt input
- **Model** in small monospace text when known (e.g. `claude-opus-4-5`)
- **PID** when known, or **session ID prefix** (e.g. `ID: abc12345`) for Claude Code sessions without a detected PID  
  [aarthin] both CC GHCP should now show the PID. So fix this text  
  [aarthin] Need manual confirmation that the PID is a required field now. add this as a task for user to confirm  
  [aarthin] The session ID can also be added separately to show consistently. add this as a task.
- **Elapsed time** representing how long since the session start
- **Drill in link**: displays a larger view of the session.  
  [aarthin] the session details page can be bigger to show more output stream. add a task to fix it.
  [aarthin] the session details page should have everything that is shown in the session card.
- **Current prompt**: the most recent question you asked, shown below the badges and updated live as the conversation progresses
- **Last output preview**: up to 2 lines of the most recent tool result or message
- **Send prompt input and button**: (only in live sessions) Type a prompt and send to the CLI session from Argus.

### Session Output

Click any card to open a **live output pane** on the right inline. The card list stays visible on the left. Press **Escape** or click the **X** icon to close it. Click another card to switch sessions.

Output lines carry type badges so you always know what's what: **YOU** (your input), **AI** (assistant reply), **TOOL** (tool call), **RESULT** (tool result), **STATUS** (status change), **ERR** (error). These are streamed in real time, including tool calls.

[aarthin] Add description of the Verbose and Focused mode for the output pane. This is a new feature being worked on in a branch and this needs to get fixed once the branch is merged.

#### Focused and Verbose Mode

The output pane has two display modes, toggled via the **Focused / Verbose** button in the pane header:

- **Focused** (default): hides noisy tool results. Tool calls show a compact one-line summary. Click **show result** on any row to expand it inline. Your messages, AI replies, status changes, and errors are always visible.
- **Verbose**: shows everything. Long tool results (over 40 lines) are truncated with a **show more** button. Tool calls show their full content.

The selected mode persists across sessions and page reloads.

### Session Detection

Argus detects sessions using two sources:

- **Claude Code**: Reads `~/.claude/sessions/{PID}.json` files that Claude maintains. Each file maps a process ID to a session ID and working directory. This gives Argus a deterministic PID-to-session mapping that works with any number of concurrent sessions, even in the same repo. Sessions launched via `argus launch` get their PID from the PTY registry instead.
- **Copilot CLI**: Reads `inuse.{PID}.lock` files in `~/.copilot/session-state/{sessionId}/`.
  [aarthin] There is a YAML file that that has the session details. include information about that.

In both cases, Argus checks every 5 seconds whether the session's PID is still running. If the process has exited, the session is marked **ended**. If a session has no PID yet (e.g., the registry file hasn't appeared), Argus falls back to JSONL file freshness with a configurable idle threshold (default: 60 minutes).  
[aarthin] the above statement about 60min is wrong. there should be no idle threshold. confirm and fix this statement.
The frontend shows a **resting** badge when there has been no output beyond the configured resting threshold (default: 20 minutes) but the process is still running. The threshold is configurable in Settings.

## Control

Take charge of any session without touching the terminal.

### Killing a Session

Every session card and the session detail page have a **kill button** (■ icon) next to the session badges. It appears for sessions that have a known PID and are still running (not ended or completed).

1. Click the kill button on any active session card or on the session detail page header.
2. A confirmation dialog appears showing the session type and ID prefix.
3. Click **Kill Session** to terminate the process, or **Cancel** to dismiss.
4. If the kill fails (session already ended, not found, or a network error), the error message is shown in the dialog so you can retry or dismiss.

### Starting a Session with Prompt Control

To send prompts to a session, start it through Argus using the `argus launch` command. This gives Argus a direct PTY write channel to the process.

```sh
# Claude Code
npm run launch --workspace=backend -- claude

# GitHub Copilot CLI
npm run launch --workspace=backend -- copilot
```

[aarthin] the command above are wrong because hthey are missing the repository path. so fix it properly.  
[aarthin] in addition the better way is to launch with Argus from the header for each repo. use that as the main entry and provide this argus command launch as a note.

Run this in any terminal: VS Code integrated terminal, Windows Terminal, iTerm2, or any other terminal emulator. The session appears in the Argus dashboard with a **live** badge and the prompt bar is enabled.

Sessions detected automatically (not started via `argus launch`) show a **read-only** badge. Their prompt bars are not visible. Interrupt (Esc) and Stop still work for any detected session since those use OS signals, not stdin.  
[aarthin] check the note about esc and stop. i dont think the work properly. it has not been tested. add as task to test.

### Prompt Bar

Every session card has a prompt bar. For **live** (PTY-launched) sessions, type a message and press **↵** to send it.

Prompt injection works for both Claude Code and Copilot CLI when started via `Launch with Argus`.

### Repository Management

Click **Add Repository**, type or paste a root folder path (e.g. `C:\source` or `/home/user/projects`), then click **Scan &amp; Add**. Argus scans that folder recursively for git repos and registers all new ones in one go. Already-registered repos are skipped automatically.

## To Tackle

The **To Tackle** panel lives on the right side of the dashboard. Use it to jot down tasks, reminders, or notes essentially your brain dump.

- Add items with the input at the top, press **Enter** to save
- Check off completed items; toggle visibility of done items with the button in the header
- Delete items with the trash icon that appears on hover
- Toggle timestamps on/off to see when each item was added
- Items are stored in the local database and survive page refreshes

## Mobile Browser Support

Argus is fully usable when you remote into your machine from mobile devices (390px and up). On narrow viewports:

- Sessions and Tasks views are accessible via a **bottom tab bar** (Sessions / Tasks).
- Tapping a session card opens the full **session detail page** instead of the inline output pane.
- The layout reflows automatically when the browser is resized across the 768px breakpoint.

Desktop layout (two-column with inline output pane) is unchanged.

## Dashboard Settings

Click the **gear icon** (top-right) to open Settings.

| Setting                            | Default  | Description                                                                        |
| ---------------------------------- | -------- | ---------------------------------------------------------------------------------- |
| Hide ended sessions                | Off      | Hides sessions with status `completed` or `ended`                                  |
| Hide repos with no active sessions | Off      | Hides repo cards that have no sessions with status `active`, `waiting`, or `error` |
| Hide inactive sessions             | Off      | Hides sessions with no output in the last N minutes (see Resting threshold below)  |
| Resting after (minutes)            | 20       | Minutes of inactivity before a session is shown as **resting**. Valid range: 1 to 60. Click **Reset** to restore the default. |

These settings are saved in your browser (`localStorage`) and restored on every load.  
[aarthin] the default for hide ended sessions should be On.

### Launch Behaviour: Yolo Mode

| Setting    | Default | Description                                                                             |
| ---------- | ------- | --------------------------------------------------------------------------------------- |
| Yolo mode  | Off     | Launches all sessions with all permission checks and safety prompts disabled            |

When **Yolo mode** is enabled, a warning dialog is shown. After confirmation:

- **Claude Code** sessions are launched with `--dangerously-skip-permissions`
- **Copilot CLI** sessions are launched with `--allow-all`

This applies to both sessions launched directly from the Argus UI and commands copied to clipboard. The setting is stored in `~/.argus/config.json` and persists across restarts.

To disable, toggle Yolo mode off in Settings. No confirmation is required to disable.

## Onboarding

New to Argus? An interactive tour launches automatically on your first visit. Dismiss it any time and replay it later from Settings.

## Storage

Argus keeps its data in `~/.argus/`:

| File                   | Purpose                                       |
| ---------------------- | --------------------------------------------- |
| `~/.argus/config.json` | Port, retention settings, watched directories |
| `~/.argus/argus.db`    | SQLite: repos, sessions, output               |

Default port: **7411**. Override in `~/.argus/config.json`:

```json
{
  "port": 7411,
  "sessionRetentionHours": 24
}
```

[aarthin] ensure that this setting is not in the config - idleSessionThresholdMinutes  
[aarthin] review and understand the sessionRetentionHours.

## For Contributors

See [docs/README-CONTRIBUTORS.md](docs/README-CONTRIBUTORS.md) for architecture, dev setup, API reference, security model, CI pipeline, and development guides.
