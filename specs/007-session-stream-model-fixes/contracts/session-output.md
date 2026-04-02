# Contract: Session Output Item

**Feature**: `007-session-stream-model-fixes`  
**Endpoint**: `GET /api/v1/sessions/:id/output`  
**Updated**: 2026-04-02

---

## Response Schema

```typescript
// GET /api/v1/sessions/:id/output
{
  items: SessionOutputItem[];
  nextCursor: string | null;
  total: number;
}

interface SessionOutputItem {
  id: string;           // UUID
  sessionId: string;
  timestamp: string;    // ISO 8601
  type: OutputType;     // 'message' | 'tool_use' | 'tool_result' | 'error' | 'status_change'
  content: string;      // Display text
  toolName: string | null;
  role: OutputRole | null;   // NEW — 'user' | 'assistant' | null
  sequenceNumber: number;
}

type OutputType = 'message' | 'tool_use' | 'tool_result' | 'error' | 'status_change';
type OutputRole = 'user' | 'assistant';
```

## Field Notes

- `role`: populated for `message` items only. `null` for `tool_use`, `tool_result`, `error`, `status_change`.
  - `'user'`: message originated from the user/operator
  - `'assistant'`: message originated from the AI model
  - `null`: not applicable (tool calls, results, status items)

- `toolName`: populated for `tool_use` and `tool_result` items. Contains the tool identifier (e.g. `"Bash"`, `"Edit"`, `"Read"`).

## Breaking Change Assessment

**Non-breaking**: `role` is a new optional/nullable field. Existing clients that don't read `role` continue to function identically.

---

# Contract: Session

**Endpoint**: `GET /api/v1/sessions` and `GET /api/v1/sessions/:id`  
**Updated**: 2026-04-02

## Response Schema (updated)

```typescript
interface Session {
  id: string;
  repositoryId: string;
  type: 'copilot-cli' | 'claude-code';
  pid: number | null;
  status: 'active' | 'ended';
  startedAt: string;      // ISO 8601
  endedAt: string | null; // ISO 8601
  lastActivityAt: string; // ISO 8601
  summary: string | null;
  expiresAt: string | null;
  model: string | null;   // NEW — AI model name e.g. "claude-haiku-4-5-20251001"; null if unknown
}
```

## Field Notes

- `model`: populated for Claude Code sessions once the first assistant response is received and parsed from the JSONL conversation file. Always `null` for Copilot CLI sessions (model information not available from that data source).

## Breaking Change Assessment

**Non-breaking**: `model` is a new nullable field. Existing clients that don't read `model` continue to function identically.
