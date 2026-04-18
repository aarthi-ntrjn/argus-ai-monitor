# Internal Parser Interface Contracts

**Branch**: `037-fix-jsonl-parsing` | **Date**: 2026-04-18

These are the internal function-level contracts between the watcher layer and the parser layer. No HTTP API changes are made by this feature.

---

## `parseClaudeJsonlLine` (changed)

**File**: `backend/src/services/claude-code-jsonl-parser.ts`

```typescript
// Before
export function parseClaudeJsonlLine(
  line: string,
  sessionId: string,
  sequenceNumber: number
): SessionOutput[]

// After — signature unchanged; ID generation changes internally
export function parseClaudeJsonlLine(
  line: string,
  sessionId: string,
  sequenceNumber: number
): SessionOutput[]
```

**Change**: IDs are now derived from `entry.uuid + role + blockIndex` instead of `randomUUID()`. Callers are unaffected.

**Contract**:
- Returns `[]` for empty lines, unknown types, and `file-history-snapshot` entries.
- Returns one `SessionOutput` per recognized content block (text, tool_use, tool_result).
- Each returned entry's `id` is stable: re-parsing the same JSONL line produces the same IDs.

---

## `parseJsonlLine` (changed)

**File**: `backend/src/services/events-parser.ts`

```typescript
// Before
export function parseJsonlLine(
  line: string,
  sessionId: string,
  sequenceNumber: number
): SessionOutput | null

// After — new optional lineId parameter
export function parseJsonlLine(
  line: string,
  sessionId: string,
  sequenceNumber: number,
  lineId?: string
): SessionOutput | null
```

**Change**: Accepts an optional `lineId`. When provided, it is used as the `SessionOutput.id`. When absent, falls back to `randomUUID()` (preserves backward compatibility for tests that don't supply a lineId).

**Contract**:
- Returns `null` for empty lines, unknown event types with no role, and message events with no extractable content.
- When `lineId` is provided by the caller (Copilot watcher), the ID is stable across re-parses of the same line.

---

## `getMaxSequenceNumber` (new)

**File**: `backend/src/db/database.ts`

```typescript
export function getMaxSequenceNumber(sessionId: string): number
```

**Contract**:
- Returns the maximum `sequence_number` stored for `sessionId`, or `0` if no entries exist.
- Uses the `idx_output_seq` index. O(log n).
- Callers add 1 to get the starting counter for a new watcher attach.

---

## Watcher Attach Contract (both watchers)

The following invariants hold after this feature for both `ClaudeJsonlWatcher.watchFile` and `CopilotCliDetector.watchEventsFile`:

1. **No output clearing**: Neither method calls `deleteSessionOutput` or any destructive DB operation.
2. **Tail read**: File position is initialized to `max(0, fileSize - TAIL_BYTES)`.
3. **Sequence resumption**: Sequence counter is initialized to `getMaxSequenceNumber(sessionId) + 1`.
4. **INSERT OR IGNORE**: Duplicate entries (overlap between tail window and stored entries) are silently skipped.
5. **Async I/O**: All file reads use `fs/promises` (non-blocking).
