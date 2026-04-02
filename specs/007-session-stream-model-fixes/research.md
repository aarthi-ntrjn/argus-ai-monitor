# Research: Session Stream Legibility, Model Display & Claude Code Fixes

**Feature**: `007-session-stream-model-fixes`  
**Date**: 2026-04-02

---

## 1. Claude Code JSONL File Format

**Decision**: Parse `~/.claude/projects/{encoded-repo-path}/{session-id}.jsonl` directly using chokidar, identical to how Copilot CLI events are tailed.

**File location encoding**:
- Repo path `C:\source\github\artynuts\argus` → `C--source-github-artynuts-argus`
- Rule (from `claude-code-detector.ts` line 87): `repoPath.replace(/[:\\/]/g, '-')`

**Actual schema** (confirmed from `~/.claude/projects/C--source-github-artynuts-argus/*.jsonl`):

Each line is one of several entry types:

### `file-history-snapshot` — skip these
```json
{"type":"file-history-snapshot","messageId":"...","snapshot":{...},"isSnapshotUpdate":false}
```

### `user` entry — user message or tool result
```json
{
  "parentUuid": "...",
  "isSidechain": false,
  "type": "user",
  "message": {
    "role": "user",
    "content": "string or array of content blocks"
  },
  "uuid": "...",
  "timestamp": "2026-04-01T00:38:56.609Z",
  "userType": "external",
  "entrypoint": "cli",
  "cwd": "C:\\source\\github\\artynuts\\argus",
  "sessionId": "341e93b3-858b-4763-9b1e-3497024d4228",
  "version": "2.1.86",
  "gitBranch": "master"
}
```

Content can be:
- A plain string: `"content": "user typed this prompt"`
- Array with text: `[{"type": "text", "text": "user prompt text"}]`
- Array with tool_result: `[{"type": "tool_result", "tool_use_id": "toolu_xxx", "content": "command output"}]`

### `assistant` entry — assistant response (contains model name)
```json
{
  "parentUuid": "...",
  "isSidechain": false,
  "type": "assistant",
  "message": {
    "model": "claude-haiku-4-5-20251001",
    "id": "msg_xxx",
    "type": "message",
    "role": "assistant",
    "content": [
      {"type": "text", "text": "I'll help with that."},
      {
        "type": "tool_use",
        "id": "toolu_xxx",
        "name": "Bash",
        "input": {"command": "npm install"},
        "caller": {"type": "direct"}
      }
    ],
    "stop_reason": "tool_use",
    "usage": {"input_tokens": 3, "output_tokens": 161, ...}
  },
  "requestId": "req_xxx",
  "uuid": "...",
  "timestamp": "2026-04-01T00:39:04.437Z"
}
```

**Model extraction**: `entry.message.model` — always present on `assistant` entries.

### Subagent entries — `isSidechain: true`
Stored in the **same main JSONL file** as the root session (not a separate file). They interleave with root messages. The `agentId` field distinguishes subagent messages. These should be parsed alongside root messages — they represent real tool/assistant activity.

**Note**: Subagent-specific files (`subagents/agent-xxx.jsonl`) are separate and need not be parsed separately since their entries already appear inline.

---

## 2. Claude Code Active State Detection — Root Cause

**Problem confirmed**: `scanExistingSessions()` in `claude-code-detector.ts` (lines 103–149) has two flaws on Windows:

1. **No per-repo process matching**: `psList` on Windows doesn't return process `cwd`, so any process with "claude" in its name triggers re-activation of **all** repos with Claude Code sessions.
2. **Re-activates ended sessions indiscriminately**: If Claude is running for repo A only, it incorrectly re-activates the last ended session for repos B, C, etc.

**Decision**: Replace process-based scan with JSONL file modification time check.

**Rationale**: If a Claude Code JSONL file has been modified within the last 30 minutes, the session is likely still active (or was very recently active). Combined with a process existence check (any Claude process running), this filters out stale sessions:

```
isLikelyActive = anyClaudeProcessRunning AND jsonlFileModifiedWithin30Min
```

**Alternatives considered**:
- Process cmdline matching (rejected: unreliable on Windows — process names are ambiguous, cwd not available)
- Hook-only approach (rejected: hooks don't fire until after first user interaction; session appears "ended" between start and first message)
- File lock detection (rejected: Claude Code doesn't use lock files the way Copilot CLI does)

**Path normalization fix**: `handleHookPayload` calls `getRepositoryByPath(cwd)` where `cwd` comes from Claude Code hooks. On Windows, paths may differ in case or trailing slashes from the stored repository path. Add `normalize()` and case-insensitive comparison.

---

## 3. Output Stream Legibility — Changes Required

**Current issues** (confirmed from `SessionDetail.tsx`):
1. `break-all` class on content breaks mid-character — use `break-words` instead
2. All `message` type items (user + assistant) show the same "MSG" badge — role is lost
3. Tool content (when the raw JSON is not a string) falls through to `JSON.stringify` — readable JSON but unformatted

**Decision**: 
- Add an optional `role?: 'user' | 'assistant' | null` field to `SessionOutput` — used for display only
- Update `events-parser.ts`: `user.message` → role `'user'`; `assistant.message` → role `'assistant'`
- Update `SessionDetail.tsx` TYPE_LABELS to show `USER` vs `ASST` badges differently
- Change `break-all` → `break-words whitespace-pre-wrap` for readable multi-line content

**Badge redesign**:
| type | role | Badge | Color |
|------|------|-------|-------|
| message | user | `YOU` | gray |
| message | assistant | `AI` | blue |
| tool_use | — | `TOOL` | purple |
| tool_result | — | `RESULT` | green |
| error | — | `ERR` | red |
| status_change | — | `STATUS` | yellow |

**Alternatives considered**:
- Full markdown rendering (rejected: adds dependency, out of scope for this sprint)
- Collapsible tool call groups (rejected: too complex, deferred to a future feature)

---

## 4. Model Display

**Decision**: Extract model from Claude Code JSONL and surface it on SessionCard and SessionPage header.

**Data source**: `entry.message.model` from the first `assistant` entry in the JSONL file.
**Storage**: Add `model?: string | null` to the `Session` schema (SQLite column + TypeScript type).
**Detection timing**: When the JSONL watcher reads the first assistant entry for a session, update the session's `model` field via `upsertSession`.

**Display**:
- `SessionCard.tsx`: small gray text badge after the session type icon (e.g., `claude-haiku-4-5`)
- `SessionPage.tsx`: inline in the header alongside type and status

**Copilot CLI model**: Not available from the JSONL format — Copilot CLI sessions will show no model badge. This is acceptable.

**Alternatives considered**:
- Expose model via the hook payload (rejected: Claude Code hooks don't include model in the payload)
- Show model from process inspection (rejected: not feasible without API access)

---

## 5. Database Migration Strategy

**Changes needed**:
- `sessions` table: add `model TEXT` column (nullable, default NULL)
- `session_output` table: add `role TEXT` column (nullable, default NULL)

**Migration approach**: `better-sqlite3` is used with synchronous calls. The existing codebase uses `CREATE TABLE IF NOT EXISTS` patterns in `database.ts`. Use `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` for both columns — SQLite supports this via checking `pragma table_info`. Run at startup before the API server starts.

**No data loss risk**: Both columns are additive and nullable.
