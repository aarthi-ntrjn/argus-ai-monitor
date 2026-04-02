# Data Model: Session Stream Legibility, Model Display & Claude Code Fixes

**Feature**: `007-session-stream-model-fixes`  
**Date**: 2026-04-02

---

## Schema Changes

### `Session` — add `model` field

**Existing** (backend `models/index.ts` and frontend `types.ts`):
```typescript
export interface Session {
  id: string;
  repositoryId: string;
  type: SessionType;       // 'copilot-cli' | 'claude-code'
  pid: number | null;
  status: SessionStatus;   // 'active' | 'ended'
  startedAt: string;
  endedAt: string | null;
  lastActivityAt: string;
  summary: string | null;
  expiresAt: string | null;
}
```

**Updated**:
```typescript
export interface Session {
  id: string;
  repositoryId: string;
  type: SessionType;
  pid: number | null;
  status: SessionStatus;
  startedAt: string;
  endedAt: string | null;
  lastActivityAt: string;
  summary: string | null;
  expiresAt: string | null;
  model: string | null;    // NEW — e.g. "claude-haiku-4-5-20251001"; null when unknown
}
```

**SQLite column**: `model TEXT` — `ALTER TABLE sessions ADD COLUMN model TEXT` (run at startup)  
**Default**: `NULL`

---

### `SessionOutput` — add `role` field

**Existing** (backend `models/index.ts` and frontend `types.ts`):
```typescript
export type OutputType = 'message' | 'tool_use' | 'tool_result' | 'error' | 'status_change';

export interface SessionOutput {
  id: string;
  sessionId: string;
  timestamp: string;
  type: OutputType;
  content: string;
  toolName: string | null;
  sequenceNumber: number;
}
```

**Updated**:
```typescript
export type OutputType = 'message' | 'tool_use' | 'tool_result' | 'error' | 'status_change';
export type OutputRole = 'user' | 'assistant';

export interface SessionOutput {
  id: string;
  sessionId: string;
  timestamp: string;
  type: OutputType;
  content: string;
  toolName: string | null;
  role: OutputRole | null;  // NEW — 'user' | 'assistant'; null for tool/status/error items
  sequenceNumber: number;
}
```

**SQLite column**: `role TEXT` — `ALTER TABLE session_output ADD COLUMN role TEXT` (run at startup)  
**Default**: `NULL`

---

## New Entity: Claude Code JSONL Entry

This is a read-only file format (not stored in the DB beyond parsing). Documented here for parser implementation reference.

### Root-level entry fields (common to all types)

| Field | Type | Notes |
|-------|------|-------|
| `type` | `"user" \| "assistant" \| "file-history-snapshot"` | Entry type |
| `uuid` | string | Unique ID for this entry |
| `parentUuid` | string \| null | Parent entry UUID (null for root) |
| `isSidechain` | boolean | `true` for subagent entries |
| `timestamp` | string | ISO 8601 |
| `sessionId` | string | Claude Code session ID (matches filename) |
| `cwd` | string | Working directory at time of entry |
| `gitBranch` | string | Git branch at time of entry |

### `user` entry — `message` field

| Field | Type | Notes |
|-------|------|-------|
| `message.role` | `"user"` | Always "user" |
| `message.content` | `string \| ContentBlock[]` | Plain text or content block array |

Content block types:
- `{"type": "text", "text": "..."}` — plain text message
- `{"type": "tool_result", "tool_use_id": "...", "content": "..."}` — tool execution result

### `assistant` entry — `message` field

| Field | Type | Notes |
|-------|------|-------|
| `message.model` | string | Model name — e.g. `"claude-haiku-4-5-20251001"` |
| `message.role` | `"assistant"` | Always "assistant" |
| `message.content` | `ContentBlock[]` | Array of content blocks |
| `message.stop_reason` | `"end_turn" \| "tool_use" \| null` | Why the turn ended |

Content block types:
- `{"type": "text", "text": "..."}` — assistant text response
- `{"type": "tool_use", "id": "...", "name": "Bash", "input": {...}}` — tool invocation

---

## Mapping: Claude Code JSONL → SessionOutput

| Claude Code entry | SessionOutput.type | SessionOutput.role | SessionOutput.content | SessionOutput.toolName |
|-------------------|--------------------|--------------------|-----------------------|------------------------|
| `file-history-snapshot` | *(skip)* | — | — | — |
| `user` with string content | `message` | `user` | string content | null |
| `user` with text block | `message` | `user` | block.text | null |
| `user` with tool_result block | `tool_result` | null | block.content (stringified if array) | tool_use_id (short) |
| `assistant` text block | `message` | `assistant` | block.text | null |
| `assistant` tool_use block | `tool_use` | null | JSON.stringify(block.input) | block.name |

**Model extraction**: Set `session.model` from the first `assistant` entry's `message.model`.

---

## State Transitions

### Session active state (updated rules)

```
Created (hook: SessionStart) → active
  OR
Scanned (JSONL file modified < 30 min ago AND any Claude process running) → active

active → active  (on: hook PreToolUse, PostToolUse; or new JSONL file content)
active → ended   (on: hook Stop; or JSONL file not modified for > 30 min AND no Claude process)
```

**Key change**: `scanExistingSessions()` now requires BOTH conditions:
1. A Claude process is running (any)
2. The session's JSONL file was last modified within 30 minutes

Previously only condition 1 was checked (per-repo, blindly).
