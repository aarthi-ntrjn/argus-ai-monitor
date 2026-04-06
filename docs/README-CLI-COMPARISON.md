# CLI Comparison: Claude Code vs Copilot CLI

This document compares the output stream format, parsing logic, and session state model for the two AI session types Argus supports.

For architecture overview, see [README-ARCH.md](README-ARCH.md).

## Contents

- [Output Stream Format](#output-stream-format)
- [Example Messages](#example-messages)
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

---

#### Entry types

| `type` | Description | Argus action |
|--------|-------------|--------------|
| `user` | User turn (prompt or tool result) | Parsed into `SessionOutput` rows |
| `assistant` | Assistant turn (text and/or tool calls) | Parsed into one or more `SessionOutput` rows |
| `system` | CLI lifecycle events (session start, bridge status, local commands) | Discarded |
| `attachment` | Deferred tool list deltas | Discarded |
| `permission-mode` | Permission mode declaration at session open | Discarded |
| `file-history-snapshot` | File-state checkpoint written by Claude Code | Discarded |

---

#### Common fields (present on every entry)

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | Entry type (see table above) |
| `uuid` | string (UUID) | Unique ID for this entry |
| `parentUuid` | string \| null | UUID of the parent entry — forms the conversation tree |
| `timestamp` | ISO 8601 string | When the entry was written |
| `isSidechain` | boolean | True for background tool invocations not shown to the user |
| `sessionId` | string (UUID) | Session this entry belongs to |
| `userType` | string | Always `"external"` in practice |
| `entrypoint` | string | Always `"cli"` in practice |
| `cwd` | string | Working directory at the time of the entry |
| `version` | string | Claude Code version (e.g. `"2.1.92"`) |
| `gitBranch` | string \| null | Git branch active in `cwd` at the time of the entry |

---

#### `user` entry

Additional fields beyond the common set:

| Field | Type | Description |
|-------|------|-------------|
| `message.role` | `"user"` | Always `"user"` |
| `message.content` | string \| ContentBlock[] | The user's prompt text, or an array of content blocks when the entry carries tool results |
| `promptId` | string (UUID) | Groups all entries that belong to one user-initiated prompt round-trip |
| `isMeta` | boolean | True when this entry is injected by the CLI (e.g. skill expansion text) rather than typed by the user |
| `toolUseResult` | object \| undefined | Present on tool-result entries: `{ success: boolean, commandName: string }` |
| `sourceToolAssistantUUID` | string \| undefined | UUID of the assistant entry that triggered this tool result |
| `sourceToolUseID` | string \| undefined | ID of the specific `tool_use` block this result answers |

**Example — plain prompt:**

```jsonl
{"type":"user","uuid":"a1b2c3d4-0001-0000-0000-000000000000","parentUuid":null,"isSidechain":false,"promptId":"p-001","isMeta":false,"timestamp":"2026-04-06T10:00:00.000Z","sessionId":"e5f6a7b8-cafe-0000-0000-000000000000","cwd":"C:\\source\\argus2","version":"2.1.92","gitBranch":"main","message":{"role":"user","content":"Add a health check endpoint"}}
```

Produces: `type: message`, `role: user`, `content: "Add a health check endpoint"`

**Example — tool result returned to Claude:**

```jsonl
{"type":"user","uuid":"a1b2c3d4-0004-0000-0000-000000000000","parentUuid":"a1b2c3d4-0003-0000-0000-000000000000","isSidechain":false,"promptId":"p-001","isMeta":false,"timestamp":"2026-04-06T10:00:03.000Z","sessionId":"e5f6a7b8-cafe-0000-0000-000000000000","cwd":"C:\\source\\argus2","version":"2.1.92","gitBranch":"main","message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"toolu_abc123","content":"export const healthRoute = ..."}]},"toolUseResult":{"success":true,"commandName":"Read"},"sourceToolAssistantUUID":"a1b2c3d4-0003-0000-0000-000000000000","sourceToolUseID":"toolu_abc123"}
```

Produces: `type: tool_result`, `role: null`, `toolName: "toolu_abc123"`, `content: "export const healthRoute = ..."`

**SessionOutput mapping:**

| Scenario | `type` | `role` | `content` | `toolName` |
|----------|--------|--------|-----------|------------|
| Plain prompt (`message.content` is a string) | `'message'` | `'user'` | `message.content` string | `null` |
| Tool result (`message.content[n].type === 'tool_result'`) | `'tool_result'` | `null` | Block's `content` string | Block's `tool_use_id` |

---

#### `assistant` entry

Additional fields beyond the common set:

| Field | Type | Description |
|-------|------|-------------|
| `message.role` | `"assistant"` | Always `"assistant"` |
| `message.model` | string | Model ID, e.g. `"claude-sonnet-4-6"` |
| `message.id` | string | Anthropic message ID, e.g. `"msg_01..."` |
| `message.type` | `"message"` | Always `"message"` |
| `message.content` | ContentBlock[] | One or more content blocks (see below) |
| `message.stop_reason` | string \| null | `"tool_use"`, `"end_turn"`, or null while streaming |
| `message.stop_sequence` | string \| null | The stop sequence that ended the turn, or null |
| `message.usage` | object | Token counts — see Usage object below |
| `requestId` | string | Anthropic API request ID for tracing |

**Example — text reply:**

```jsonl
{"type":"assistant","uuid":"a1b2c3d4-0002-0000-0000-000000000000","parentUuid":"a1b2c3d4-0001-0000-0000-000000000000","isSidechain":false,"timestamp":"2026-04-06T10:00:01.000Z","sessionId":"e5f6a7b8-cafe-0000-0000-000000000000","cwd":"C:\\source\\argus2","version":"2.1.92","gitBranch":"main","requestId":"req_01abc","message":{"role":"assistant","model":"claude-sonnet-4-6","id":"msg_01","type":"message","stop_reason":"tool_use","stop_sequence":null,"content":[{"type":"text","text":"I'll add that now. Let me read the routes file first."}],"usage":{"input_tokens":120,"output_tokens":18,"cache_read_input_tokens":800,"cache_creation_input_tokens":0,"cache_creation":{"ephemeral_1h_input_tokens":0,"ephemeral_5m_input_tokens":0},"output_tokens":18,"service_tier":"standard","inference_geo":"not_available"}}}
```

Produces: `type: message`, `role: assistant`, `content: "I'll add that now. Let me read the routes file first."`

**Example — tool call:**

```jsonl
{"type":"assistant","uuid":"a1b2c3d4-0003-0000-0000-000000000000","parentUuid":"a1b2c3d4-0002-0000-0000-000000000000","isSidechain":false,"timestamp":"2026-04-06T10:00:02.000Z","sessionId":"e5f6a7b8-cafe-0000-0000-000000000000","cwd":"C:\\source\\argus2","version":"2.1.92","gitBranch":"main","requestId":"req_01abc","message":{"role":"assistant","model":"claude-sonnet-4-6","id":"msg_02","type":"message","stop_reason":"tool_use","stop_sequence":null,"content":[{"type":"tool_use","id":"toolu_abc123","name":"Read","input":{"file_path":"backend/src/api/routes/health.ts"},"caller":{"type":"direct"}}],"usage":{"input_tokens":140,"output_tokens":32,"cache_read_input_tokens":800,"cache_creation_input_tokens":0,"service_tier":"standard","inference_geo":""}}}
```

Produces: `type: tool_use`, `role: null`, `toolName: "Read"`, `content: "{\"file_path\":\"backend/src/api/routes/health.ts\"}"`

**Example — mixed reply (text + tool call, produces two `SessionOutput` rows):**

```jsonl
{"type":"assistant","uuid":"a1b2c3d4-0005-0000-0000-000000000000","parentUuid":"a1b2c3d4-0004-0000-0000-000000000000","isSidechain":false,"timestamp":"2026-04-06T10:00:04.000Z","sessionId":"e5f6a7b8-cafe-0000-0000-000000000000","cwd":"C:\\source\\argus2","version":"2.1.92","gitBranch":"main","requestId":"req_01def","message":{"role":"assistant","model":"claude-sonnet-4-6","id":"msg_03","type":"message","stop_reason":"tool_use","stop_sequence":null,"content":[{"type":"text","text":"Running tests now."},{"type":"tool_use","id":"toolu_def456","name":"Bash","input":{"command":"npm test"},"caller":{"type":"direct"}}],"usage":{"input_tokens":200,"output_tokens":45,"cache_read_input_tokens":900,"cache_creation_input_tokens":0,"service_tier":"standard","inference_geo":""}}}
```

Produces two rows:
1. `type: message`, `role: assistant`, `content: "Running tests now."`
2. `type: tool_use`, `role: null`, `toolName: "Bash"`, `content: "{\"command\":\"npm test\"}"`

**SessionOutput mapping:**

| Content block type | `type` | `role` | `content` | `toolName` |
|-------------------|--------|--------|-----------|------------|
| `text` | `'message'` | `'assistant'` | `block.text` | `null` |
| `tool_use` | `'tool_use'` | `null` | `JSON.stringify(block.input)` | `block.name` |
| `thinking` | Discarded | (none) | (none) | (none) |

One `assistant` entry can produce multiple `SessionOutput` rows (one per non-discarded block). A mixed entry with a `text` block and a `tool_use` block produces two rows.

---

#### Content blocks (`message.content` array)

| `type` | Key fields | Description |
|--------|-----------|-------------|
| `text` | `text: string` | Plain text response from the assistant |
| `thinking` | `thinking: string`, `signature: string` | Extended thinking block (internal reasoning); `signature` is an opaque verification token |
| `tool_use` | `id: string`, `name: string`, `input: object`, `caller: { type: string }` | Tool invocation — `name` is the tool name, `input` is the arguments, `caller.type` is always `"direct"` |
| `tool_result` | `tool_use_id: string`, `content: string \| object` | Tool result returned to the assistant (appears inside `user` entries, not `assistant` entries) |

---

#### Usage object (`message.usage`)

| Field | Description |
|-------|-------------|
| `input_tokens` | Tokens in the prompt sent to the API |
| `output_tokens` | Tokens generated in the response |
| `cache_read_input_tokens` | Prompt tokens served from the prompt cache |
| `cache_creation_input_tokens` | Prompt tokens written into the cache this turn |
| `cache_creation.ephemeral_1h_input_tokens` | Tokens written into the 1-hour ephemeral cache |
| `cache_creation.ephemeral_5m_input_tokens` | Tokens written into the 5-minute ephemeral cache |
| `service_tier` | e.g. `"standard"` |
| `inference_geo` | Region where inference ran, or `"not_available"` |

---

#### Discarded entries

```jsonl
{"type":"file-history-snapshot","messageId":"snap-001","snapshot":{"messageId":"snap-001","trackedFileBackups":{},"timestamp":"2026-04-06T10:00:00.000Z"},"isSnapshotUpdate":false}
{"type":"system","subtype":"local_command","content":"<command-name>/foo</command-name>","level":"info","isMeta":false,"uuid":"...","parentUuid":"...","timestamp":"...","sessionId":"...","version":"2.1.92","gitBranch":"main"}
{"type":"permission-mode","permissionMode":"bypassPermissions","sessionId":"..."}
{"type":"attachment","attachment":{"type":"deferred_tools_delta","addedNames":["WebFetch"],"addedLines":["WebFetch"],"removedNames":[]},"uuid":"...","parentUuid":"...","timestamp":"..."}
```

All four types are silently discarded by the parser — they carry no conversation content.

**SessionOutput mapping:** No row is emitted for any of these entry types.

---

### Copilot CLI

**File locations:**
- `~/.copilot/session-state/{uuid}/events.jsonl` (event stream)
- `~/.copilot/session-state/{uuid}/workspace.yaml` (session metadata)
- `~/.copilot/session-state/{uuid}/inuse.{PID}.lock` (process liveness indicator)

Each event line maps one-to-one to a single `SessionOutput` row (unlike Claude Code where one line can produce multiple rows).

---

#### Entry types

| `type` | Description | Argus action |
|--------|-------------|--------------|
| `session.start` | Session opened | Parsed as `status_change` |
| `user.message` | User prompt | Parsed as `message / user` |
| `assistant.message` | AI reply | Parsed as `message / assistant` |
| `tool.execution_start` | Tool invocation started | Parsed as `tool_use` |
| `tool.execution_complete` | Tool invocation finished | Parsed as `tool_result` |
| *(any other type)* | Lifecycle/bookkeeping (e.g. `turn.start`, `interaction.complete`) | Discarded |

---

#### Common fields (present on every entry)

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | Entry type (see table above) |
| `id` | string | Unique ID for this event (format: `"evt-{uuid}"` or similar) |
| `parentId` | string \| null | ID of the parent event — forms the event chain |
| `timestamp` | ISO 8601 string | When the event was written |
| `data` | object | Event-specific payload — fields vary by type (see below) |

---

#### `session.start` entry

`data` is an empty object `{}`.

```jsonl
{"type":"session.start","id":"evt-0001","parentId":null,"timestamp":"2026-04-06T10:00:00.000Z","data":{}}
```

Produces: `type: status_change`, `role: null`, `content: ""`

**SessionOutput mapping:**

| `type` | `role` | `content` | `toolName` |
|--------|--------|-----------|------------|
| `'status_change'` | `null` | `''` (empty string) | `null` |

---

#### `user.message` entry

| `data` field | Type | Description |
|-------------|------|-------------|
| `content` | string \| ContentBlock[] | The text the user typed. May be a plain string or a content-block array in newer CLI versions |
| `transformedContent` | string | The prompt after context expansion by the CLI (often identical to `content`) |
| `attachments` | array | File or context attachments added to the prompt (usually empty `[]`) |

```jsonl
{"type":"user.message","id":"evt-0002","parentId":"evt-0001","timestamp":"2026-04-06T10:00:01.000Z","data":{"content":"Refactor the auth middleware","transformedContent":"Refactor the auth middleware","attachments":[]}}
```

Produces: `type: message`, `role: user`, `content: "Refactor the auth middleware"`

**SessionOutput mapping:**

| `type` | `role` | `content` | `toolName` |
|--------|--------|-----------|------------|
| `'message'` | `'user'` | `data.content` if string; text blocks joined with `'\n'` if array | `null` |

---

#### `assistant.message` entry

| `data` field | Type | Description |
|-------------|------|-------------|
| `messageId` | string | Unique ID for this AI message |
| `content` | string \| ContentBlock[] | The AI's reply text. May be a plain string or a content-block array. Empty/null when the AI only made tool calls |
| `toolRequests` | array | Tool calls the AI wants to make (handled via subsequent `tool.execution_start` events) |
| `model` | string \| undefined | Model ID if present on this event (more commonly on `tool.execution_complete`) |

```jsonl
{"type":"assistant.message","id":"evt-0003","parentId":"evt-0002","timestamp":"2026-04-06T10:00:02.000Z","data":{"messageId":"msg-001","content":"Sure, I'll start by reading the current middleware.","toolRequests":[]}}
```

Produces: `type: message`, `role: assistant`, `content: "Sure, I'll start by reading the current middleware."`

> If `data.content` is null, empty, or a content-block array with no text blocks, the entry is suppressed (no `SessionOutput` row emitted). The tool calls will appear separately as `tool.execution_start` rows.

**SessionOutput mapping:**

| Condition | `type` | `role` | `content` | `toolName` |
|-----------|--------|--------|-----------|------------|
| `data.content` is a non-empty string | `'message'` | `'assistant'` | `data.content` | `null` |
| `data.content` is an array with `text` blocks | `'message'` | `'assistant'` | Text blocks joined with `'\n'` | `null` |
| `data.content` is null, empty, or has no `text` blocks | (suppressed) | (none) | (none) | (none) |

---

#### `tool.execution_start` entry

| `data` field | Type | Description |
|-------------|------|-------------|
| `toolCallId` | string | Correlates this start event with its matching `tool.execution_complete` |
| `toolName` | string | Name of the tool being invoked (e.g. `"bash"`, `"read_file"`) |
| `arguments` | object \| string | Tool input arguments. Argus extracts a single string value if there is only one argument; otherwise JSON-stringifies the whole object |

```jsonl
{"type":"tool.execution_start","id":"evt-0004","parentId":"evt-0003","timestamp":"2026-04-06T10:00:03.000Z","data":{"toolCallId":"tc-0001","toolName":"bash","arguments":{"command":"cat backend/src/middleware/auth.ts"}}}
```

Produces: `type: tool_use`, `role: null`, `toolName: "bash"`, `content: "cat backend/src/middleware/auth.ts"`

**SessionOutput mapping:**

| `type` | `role` | `content` | `toolName` |
|--------|--------|-----------|------------|
| `'tool_use'` | `null` | Single argument value if one key; `JSON.stringify(data.arguments)` if multiple keys | `data.toolName` |

---

#### `tool.execution_complete` entry

| `data` field | Type | Description |
|-------------|------|-------------|
| `toolCallId` | string | Matches the `toolCallId` from the corresponding `tool.execution_start` |
| `toolName` | string | Name of the tool that completed |
| `model` | string \| undefined | Model ID — Argus uses this to populate `session.model` if not already set |
| `success` | boolean | Whether the tool call succeeded |
| `result.content` | string | Short summary of the tool output (Argus uses this as the display content) |
| `result.detailedContent` | string \| undefined | Full tool output when it differs from `content` |

```jsonl
{"type":"tool.execution_complete","id":"evt-0005","parentId":"evt-0004","timestamp":"2026-04-06T10:00:04.000Z","data":{"toolCallId":"tc-0001","toolName":"bash","model":"gpt-4o","success":true,"result":{"content":"export function authMiddleware(req, res, next) { ... }","detailedContent":"Full file contents..."}}}
```

Produces: `type: tool_result`, `role: null`, `toolName: "bash"`, `content: "export function authMiddleware(req, res, next) { ... }"`

> `data.model` (`"gpt-4o"`) is also used by Argus to populate `session.model` if not already set.

**SessionOutput mapping:**

| `type` | `role` | `content` | `toolName` |
|--------|--------|-----------|------------|
| `'tool_result'` | `null` | `data.result.content` | `data.toolName` |

---

#### Discarded entries (bookkeeping)

Events like `turn.start`, `interaction.complete`, and similar lifecycle signals carry only ID metadata and no human-readable content. They are silently discarded.

```jsonl
{"type":"turn.start","id":"evt-x","parentId":null,"timestamp":"2026-04-06T10:00:00.000Z","data":{"turnId":"10","interactionId":"f82b5d1a-6bf0-4380-a957-a3ab00cb3715"}}
```

Produces: nothing (discarded).

**SessionOutput mapping:** No row is emitted.

---

### Comparison summary

| Attribute | Claude Code | Copilot CLI |
|-----------|------------|------------|
| Event granularity | One line, multiple outputs possible | One line, one output |
| Content location | `message.content` (string or block array) | `data.content`, `data.arguments`, `data.result` |
| Tool identity | `block.name` in `tool_use` content block | `data.toolName` |
| Model location | `message.model` on `assistant` entries | `data.model` on `tool.execution_complete` |
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
| `user.message` | `message / user` | YOU | `data.content` (string or text content-block array) |
| `assistant.message` | `message / assistant` | AI | `data.content` (string or text content-block array) |
| `tool.execution_start` | `tool_use` | TOOL | `data.arguments` (stringified if object) |
| `tool.execution_complete` | `tool_result` | RESULT | `data.result.content` or `data.result.detailedContent` |
| `session.start` | `status_change` | STATUS | (no content body) |
| *(any other type)* | Discarded | (none) | — |

`data.content` may be either a plain string or an array of typed content blocks (`{type: "text", text: "..."}` etc.). When it is an array, only `text`-typed blocks are joined (with `\n`); non-text blocks are skipped. Unrecognised event types (e.g. `turn.start`, interaction bookkeeping) are silently discarded — they carry only ID metadata and no human-readable content.

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
