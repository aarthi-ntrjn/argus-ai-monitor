# Argus: Launcher Manual Tests

Manual tests for the `argus launch` command and PTY session lifecycle. Run these against a live Argus instance.

**Prerequisites:**
1. `npm run dev` running (backend on `http://localhost:7411`)
2. At least one git repository registered in Argus

---

## L0: Basic launch, command, exit

**Prerequisites:** Claude Code and GitHub Copilot CLI are both installed and available on PATH.

|# | Steps | Expected |
|---|-------|----------|
| L0-01 | On a repo card, click the **Launch with Argus** button | A dropdown opens showing the available tools (Claude Code and/or GitHub Copilot CLI) |
| L0-02 | In the dropdown, click **Launch Claude** | Claude opens in a new terminal window; a new session card with a green **live** badge and "claude-code" (orange) type badge appears on the dashboard within 5 seconds |
| L0-03 | If a Claude session detected automatically (not via Argus launch) is also visible on the dashboard, click its prompt input | Input is disabled; tooltip reads "Start this session with argus launch to enable prompt injection"; the card shows a grey **read-only** badge |
| L0-04 | On the live session card, click the prompt input without typing anything | The send button is disabled (greyed out) |
| L0-05 | On the new session card, type **"what is the day today?"** in the prompt input and press Enter | The prompt appears in the Claude terminal; Claude responds; the response is visible in both the terminal and the session card output stream; the input clears |
| L0-06 | On the same session card, type **"what is the day today?"** and click the send button instead of pressing Enter | Same result: prompt delivered, response appears, input clears |
| L0-07 | Click **View details** on the session card to open the session detail page; type **"what is the day today?"** and send | Prompt is delivered via PTY; response appears in the output stream; input clears |
| L0-08 | Click **Launch with Argus** again and click **Launch Claude** | A second terminal opens; a second session card appears on the dashboard alongside the first |
| L0-09 | On the second session card, type **"what is the day today?"** in the prompt input and press Enter | The prompt appears in the second Claude terminal; Claude responds; the response is visible in both the terminal and the second session card output stream; the first session card is unaffected |
| L0-10 | On the second session card, type `/exit` in the prompt input and press Enter | The Claude CLI exits; the second session card disappears from the dashboard (or transitions to "ended") within a few seconds; the first session card is unaffected |
| L0-11 | In the first Claude terminal, type `/exit` and press Enter | The Claude CLI exits; the first session card disappears from the dashboard (or transitions to "ended") within a few seconds |
| L0-12 | Repeat steps L0-01 through L0-11 using **Launch Copilot** instead of Launch Claude | All the same behaviours apply: session cards show "copilot-cli" (purple) type badge; prompts are delivered to the Copilot CLI terminal; sessions end cleanly |

---

## L1: Launch from terminal

**Prerequisites:** Claude Code and GitHub Copilot CLI are both installed and available on PATH.

Note: `npm run launch --workspace=backend` must always be run from the Argus repo root. Use `--cwd <path>` to target a different repo. If `argus` is installed globally, you can run `argus launch <command>` from any directory.

| # | Steps | Expected |
|---|-------|----------|
| L1-01 | Run `npm run launch --workspace=backend` from the Argus repo root (no arguments) | Prints usage to stderr: `Usage: argus launch <command> [args...] [--cwd <path>]`; exits with code 1 |
| L1-02 | From the Argus repo root, run `npm run launch --workspace=backend -- claude --cwd <path-to-your-repo>` | Claude starts in the terminal targeting your repo; a new session card with a green **live** badge and "claude-code" (orange) type badge appears on the dashboard within 5 seconds |
| L1-03 | From the Argus repo root, run `npm run launch --workspace=backend -- copilot --cwd <path-to-your-repo>` | Copilot CLI starts targeting your repo; a session card with a green **live** badge and "copilot-cli" (purple) type badge appears within 5 seconds |
| L1-04 | Run `npm run launch --workspace=backend -- claude --cwd <path-to-unregistered-repo>` where the target is not yet registered in Argus | After launch, a new repository card appears on the dashboard with the folder name as the repo name; the session appears under it |
| L1-05 | Run the same command from L1-04 again (same unregistered path) | No duplicate repo is created; the session appears under the existing repo entry |
| L1-06 | Run `npm run launch --workspace=backend -- copilot --cwd <path-to-unregistered-repo>` where the target is not yet registered | Same as L1-04: repo is auto-created and the session appears under it |

---

## L2: Session end and cleanup

| # | Steps | Expected |
|---|-------|----------|
| L2-01 | Exit Claude normally (type `/exit` or `quit`) inside a live terminal | Session status changes to "ended" or "completed" on the dashboard within 3 seconds |
| L2-02 | Kill the `argus launch` process externally (Ctrl+C in the terminal; you may need to press Ctrl+C twice in succession) | Session status updates to "ended" within ~5 seconds; live badge disappears |
| L2-03 | Kill the process before Claude fires its first hook (exit immediately) | No orphan session card is left on the dashboard |
| L2-04 | After a session ends, check the dashboard with "Hide ended sessions" OFF | Ended session card remains visible with a grey "ended" status badge |

---

## L3: Backend-offline and error handling

| # | Steps | Expected |
|---|-------|----------|
| L3-01 | Stop the Argus backend, then run `npm run launch --workspace=backend -- claude --cwd <path-to-your-repo>` from the Argus repo root | Claude still starts in the terminal; stderr prints `[argus] Could not connect to Argus backend: ...`; no session card appears in the dashboard |
| L3-02 | Send a prompt from the dashboard while the backend is offline (stop the server after launching) | Inline error message appears below the prompt input |
| L3-03 | Send a prompt to a detected (read-only) session via a direct API call | API returns 202 with `status: failed` and message "Prompt delivery requires starting this session via argus launch"; UI prompt bar remains disabled |
| L3-04 | Start a live session, send a prompt from the dashboard, then kill the `argus launch` process mid-delivery | Prompt bar shows an error; on the next poll the session card transitions to read-only (live badge disappears) |

---

## L4: Windows-specific PID resolution

*Skip on non-Windows.*

| # | Steps | Expected |
|---|-------|----------|
| L4-01 | Launch `claude` on Windows; check the session card's PID meta after ~5 seconds | PID shown is the real `claude.exe` (or `node.exe`) process, not the `powershell.exe` wrapper PID |
| L4-02 | Open Task Manager and look up the displayed PID | The process name is `claude.exe` or `node.exe`, confirming the wrapper PID was resolved correctly |
| L4-03 | Launch `copilot` on Windows; check the session PID in the same way | PID is the innermost non-`conhost.exe` child process in the tree |
