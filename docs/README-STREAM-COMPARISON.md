# Stream Comparison: Claude Code vs Copilot CLI

This document compares the output stream format, parsing logic, and session state model for the two AI session types Argus supports.

For architecture overview, see [README-ARCH.md](README-ARCH.md).

## Contents

- [Output Stream Format](#output-stream-format)
- [Parsing and Line Classification](#parsing-and-line-classification)
- [Session State Model](#session-state-model)
- [Data Availability](#data-availability)
- [Detection Mechanism](#detection-mechanism)

---

## Output Stream Format

Both session types write output to JSONL files that Argus tails incrementally. The schemas differ substantially.

### Claude Code

**File location:** `~/.claude/projects/{encoded-repo-path}/{session-id}.jsonl`

The repo path is encoded by replacing `:`, `\`, and `/` with `-` (e.g., `C:\source\argus` becomes `C--source-argus`). The JSONL filename (without extension) is the session ID.

**Line schema:**

```json
{
  "type": "user" | "assistant" | "file-history-snapshot",
  "uuid": "string",
  "timestamp": "2025-01-01T12:00:00.000Z",
  "message": {
    "role": "user" | "assistant",
    "model": "claude-opus-4-5",
    "content": "string | ContentBlock[]"
  }
}
```

Content is either a plain string or an array of typed blocks:

```json
{ "type": "text", "text": "Here is my answer..." }
{ "type": "tool_use", "id": "toolu_abc", "name": "Read", "input": { "file_path": "/foo.ts" } }
{ "type": "tool_result", "tool_use_id": "toolu_abc", "content": "...file contents..." }
```

One JSONL line can produce multiple `SessionOutput` rows when an assistant entry contains both a text block and one or more tool_use blocks.

`file-history-snapshot` entries are silently discarded.

### Copilot CLI

**File locations:**
- `~/.copilot/session-state/{uuid}/events.jsonl` (event stream)
- `~/.copilot/session-state/{uuid}/workspace.yaml` (session metadata)
- `~/.copilot/session-state/{uuid}/inuse.{PID}.lock` (process liveness indicator)

**Line schema:**

```json
{
  "type": "user.message" | "assistant.message" | "tool.execution_start" | "tool.execution_complete" | "session.start",
  "timestamp": "2025-01-01T12:00:00.000Z",
  "data": {
    "content": "string",
    "model": "gpt-4o",
    "toolName": "string",
    "arguments": "object | string",
    "result": {
      "content": "string",
      "detailedContent": "string"
    }
  }
}
```

Each event line maps one-to-one to a single `SessionOutput` row.

**Comparison summary:**

| Attribute | Claude Code | Copilot CLI |
|-----------|------------|------------|
| Event granularity | One line, multiple outputs | One line, one output |
| Content location | `message.content` (string or block array) | `data.content`, `data.arguments`, `data.result` |
| Tool identity | `block.name` (in `tool_use` block) | `data.toolName` |
| Model location | `message.model` on assistant entries | `data.model` on `tool.execution_complete` events |
| Session metadata | Encoded in file path and filename | Separate `workspace.yaml` file |
| Extra metadata files | None | `workspace.yaml` (summary, timestamps, cwd) |

---

## Parsing and Line Classification

Both parsers produce `SessionOutput` records with the same fields. The badge shown in the UI is derived from `type` and `role`.

### Output types and badges

| `type` | `role` | Badge | Color |
|--------|--------|-------|-------|
| `message` | `user` | YOU | Gray |
| `message` | `assistant` | AI | Blue |
| `tool_use` | (none) | TOOL | Purple |
| `tool_result` | (none) | RESULT | Green |
| `status_change` | (none) | STATUS | Yellow |
| `error` | (none) | ERR | Red |

### Claude Code line mapping

| JSONL entry type | Content block type | Parsed as | Badge |
|------------------|--------------------|-----------|-------|
| `user` | `text` | `message / user` | YOU |
| `user` | `tool_result` | `tool_result` | RESULT |
| `assistant` | `text` | `message / assistant` | AI |
| `assistant` | `tool_use` | `tool_use` | TOOL |
| `file-history-snapshot` | (any) | Discarded | (none) |

### Copilot CLI event mapping

| Event type | Parsed as | Badge | Content source |
|------------|-----------|-------|----------------|
| `user.message` | `message / user` | YOU | `data.content` |
| `assistant.message` | `message / assistant` | AI | `data.content` |
| `tool.execution_start` | `tool_use` | TOOL | `data.arguments` (stringified if object) |
| `tool.execution_complete` | `tool_result` | RESULT | `data.result.content` or `data.result.detailedContent` |
| `session.start` | `status_change` | STATUS | (no content body) |

### Model extraction

- **Claude Code:** Extracted from `message.model` on the first `assistant` entry encountered.
- **Copilot CLI:** Extracted from `data.model` on the first `assistant.message` or `tool.execution_complete` event.

In both cases the model is stored once and never overwritten with `null` on subsequent scans (SQL `COALESCE(excluded.model, model)`).

---

## Session State Model

The two session types share the same status enum but follow different lifecycle paths.

### Statuses

`active` | `idle` | `waiting` | `error` | `completed` | `ended`

### Claude Code lifecycle

Detection is a hybrid push/pull model. Claude Code injects curl-based hooks into `~/.claude/settings.json` that POST to Argus on four events: `SessionStart`, `PreToolUse`, `PostToolUse`, and `Stop`.

```
[not tracked]
     |
     v  hook: SessionStart
  active  <---------+
     |               |
     v  hook: Stop   | hook: SessionStart / PreToolUse / PostToolUse
   idle  ------------+
     |
     v  PID dead OR JSONL mtime > 30 min (reconciliation check, every 5 s)
   ended
```

State rules:
- All hook events set status to `active` and refresh `lastActivityAt`.
- `Stop` hook (end of an AI turn, not process exit) transitions to `idle`.
- The background reconciler checks every 5 seconds: if the session has a PID, it checks liveness; if no PID, it checks JSONL file freshness.
- If no Claude process is running system-wide, all hook-created (null-PID) sessions are ended together.

On startup, JSONL files modified within the last 30 minutes are re-activated.

### Copilot CLI lifecycle

Detection is pull-only. Argus polls `~/.copilot/session-state/` every 5 seconds.

```
[not tracked]
     |
     v  inuse.{PID}.lock appears + PID in running processes
  active
     |
     v  lock file absent OR PID not running
   ended
```

State rules:
- There is no `idle` state for Copilot CLI sessions. A session is either active (lock present, PID alive) or ended.
- Lock file removal is the primary signal for process exit. PID liveness is the secondary check.
- Session directories are not cleaned up by Argus; they are managed by the Copilot CLI process.

### State comparison

| Aspect | Claude Code | Copilot CLI |
|--------|------------|------------|
| Detection method | Push (hooks) + pull (scan) | Pull only (directory scan) |
| Idle state | Yes (after Stop hook) | No |
| Active/idle cycling | Yes, per AI turn | Not applicable |
| Liveness signal | PID check + JSONL mtime | Lock file + PID check |
| Stale threshold | JSONL mtime > 30 min | Lock file absent |
| Hook injection | Yes (`~/.claude/settings.json`) | No |
| Startup re-activation | JSONL mtime < 30 min | Lock present + PID alive |

---

## Data Availability

Both session types are stored in the same `sessions` table and share the same `Session` interface.

| Field | Claude Code | Copilot CLI |
|-------|------------|------------|
| `id` | JSONL filename (UUID assigned by Claude) | `workspace.id` (UUID assigned by Copilot CLI) |
| `pid` | Often `null` (hook-created sessions may lack PID) | Always set (extracted from lock filename `inuse.{PID}.lock`) |
| `model` | From first assistant entry's `message.model` | From first `assistant.message` or `tool.execution_complete` event's `data.model` |
| `summary` | Always `null` (not provided by Claude) | From `workspace.summary` (populated by the CLI process) |
| `startedAt` | Hook arrival time or JSONL file mtime | `workspace.created_at` |
| `endedAt` | When PID dies or JSONL is stale | When lock disappears or PID is dead; uses `workspace.updated_at` |
| `lastActivityAt` | Updated on every hook event | Updated on each new event parsed from JSONL |

### PID availability

For Claude Code, hook-created sessions (the common case) often arrive without a PID in the hook payload. Argus attempts to match them via `ps-list` by looking for a Claude process whose working directory matches the session's repo. If no match is found, `pid` stays `null`. Interrupt and stop operations that require a PID return 422 for these sessions.

For Copilot CLI, the PID is always known because the process must create a lock file named `inuse.{PID}.lock` to register itself. Interrupt and stop operations work reliably for all Copilot CLI sessions.

---

## Detection Mechanism

### Claude Code

Argus injects four hooks into `~/.claude/settings.json`:

```json
{
  "hooks": {
    "SessionStart":    [{ "hooks": [{ "type": "command", "command": "curl -s -X POST http://127.0.0.1:{port}/hooks/claude ..." }] }],
    "PreToolUse":      [...],
    "PostToolUse":     [...],
    "Stop":            [...]
  }
}
```

The hook payload sent to `POST /hooks/claude` includes `session_id` (validated as UUID v4) and `cwd` (used to look up the registered repository). Payloads with unknown `cwd` values are silently dropped; payloads attempting to overwrite a live session's PID are rejected with 409.

File watching is incremental: Argus tracks the last byte position read per session and reads only new bytes on each change event.

### Copilot CLI

No injection is possible. Argus polls `~/.copilot/session-state/` every 5 seconds, reading `workspace.yaml` for each subdirectory. If a lock file is present and the PID is alive, the session is active and Argus starts (or continues) watching `events.jsonl` for new lines. File watching is incremental in the same way as Claude Code.
