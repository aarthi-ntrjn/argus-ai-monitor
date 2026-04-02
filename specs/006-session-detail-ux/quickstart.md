# Quickstart: Session Detail UX Redesign

## What Changed

The Argus dashboard now lets you interact with sessions directly from the card — no full-page navigation needed for the most common actions.

---

## Two-Pane Layout

Click any session card to open its live output stream in a right pane. The card list remains visible on the left. Click a different card to switch sessions. Press **Esc** on the keyboard or click the ✕ button to dismiss the pane.

```
┌─────────────────────┬──────────────────────────────────────┐
│  Repo: argus        │  Output: abc-session-id              │
│  ┌───────────────┐  │  10:23:01  MSG   Starting task...    │
│  │ claude-code ● │◄─┤  10:23:02  TOOL  [write_file]        │
│  │ Esc Exit ↗ ↓  │  │  10:23:03  RESULT  Done              │
│  │ [type here…]  │  │  10:23:04  MSG   File written.       │
│  └───────────────┘  │                                      │
└─────────────────────┴──────────────────────────────────────┘
```

---

## Quick Command Buttons

Each active Claude Code session card shows four shortcut buttons:

| Button | What it does |
|--------|-------------|
| **Esc** | Interrupts the current running command (sends SIGINT/Ctrl+Break to the process) |
| **Exit** | Asks the session to exit gracefully (sends `/exit`). Requires inline confirmation. |
| **Merge** | Sends the prompt "merge current branch with main" to the session |
| **Pull latest** | Sends the prompt "pull latest changes from main branch" to the session |

> Copilot CLI sessions show no command buttons in v1 (prompt injection not supported).

---

## Inline Prompt Input

Active Claude Code session cards include a compact text field. Type your message and press **Enter** (or click **→**) to send it directly to the session. The output pane will show the response in real time.

---

## Last Output Preview

Each card shows a truncated preview of the most recent output item from the session — useful for scanning many sessions at once without opening the output pane.

---

## Claude Process Info

Active Claude Code sessions now display two identifiers:
- **Claude session ID** (e.g. `abc-12345`) — always shown
- **PID** (e.g. `PID: 14203`) — shown when the OS process was detected

Both appear in the session card header alongside the status badge.

---

## Drill-In Page

The full `/sessions/:id` page still exists and provides complete output history and legacy controls. Access it from any card via the **↗** (open) icon.

---

## Scenarios

### Interrupt a stuck tool call

1. Notice a session card showing `waiting` with a tool call that looks stalled
2. Click the card to see the output in the right pane (confirm it's stuck)
3. Click **Esc** on the card → the interrupt signal is sent
4. Output pane updates as Claude handles the interrupt

### Send a follow-up prompt without navigating away

1. An active Claude Code session is visible on the dashboard
2. Type your follow-up into the inline prompt input on the card
3. Press **Enter** → prompt is sent
4. Click the card to open the output pane and watch the response stream in

### Exit a session cleanly

1. Click **Exit** on the card
2. An inline "Confirm exit?" prompt appears with **Yes** and **Cancel**
3. Click **Yes** → `/exit` is sent → session transitions to `ended`
