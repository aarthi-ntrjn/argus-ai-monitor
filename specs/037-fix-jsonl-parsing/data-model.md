# Data Model: Fix JSONL Parsing Differences Between Claude and Copilot

**Branch**: `037-fix-jsonl-parsing` | **Date**: 2026-04-18

## Unchanged Entities

The DB schema (`session_output` table) is **not changed** by this feature. All changes are in the ID-generation logic and the watcher attach behavior.

---

## OutputEntry (SessionOutput)

**Type**: `backend/src/models/index.ts` — `SessionOutput`

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| `id` | TEXT | No | Unique ID. **Changes in this feature.** See ID Scheme below. |
| `sessionId` | TEXT | No | Foreign key to sessions.id |
| `timestamp` | TEXT | No | ISO 8601 from JSONL entry, or now() |
| `type` | TEXT | No | `message`, `tool_use`, `tool_result`, `status_change` |
| `content` | TEXT | No | Extracted text content |
| `toolName` | TEXT | Yes | Tool name for tool_use / tool_result rows |
| `toolCallId` | TEXT | Yes | Correlates tool_use with tool_result |
| `role` | TEXT | Yes | `user`, `assistant`, or null |
| `sequenceNumber` | INTEGER | No | **Changes in this feature.** See Sequence Counter below. |
| `isMeta` | BOOLEAN | Yes | True for meta/internal messages (not persisted to DB) |

### ID Scheme (changed)

**Before**: `randomUUID()` on every parse call. INSERT OR IGNORE never deduplicates because IDs are always new.

**After** — unified scheme for both Claude and Copilot:

```
${sessionId}-${lineByteOffset}-${blockIndex}
```

| Source | Example ID |
|--------|------------|
| Claude JSONL entry, first block | `sess-abc-8192-0` |
| Claude JSONL entry, second block | `sess-abc-8192-1` |
| Copilot events.jsonl line (always one block) | `sess-xyz-16384-0` |

- `lineByteOffset` is the absolute byte position of the line's first character within the JSONL file.
- `blockIndex` is 0-based per line. Claude lines can produce multiple blocks (text, tool_use, tool_result). Copilot lines always produce at most one, so `blockIndex` is always `0` for Copilot.
- Both files are append-only, so a line at offset X is always the same line across re-reads.

**Stability guarantee**: The ID is derived from file position, computed before JSON parsing. A malformed line still gets a stable ID; it will be skipped by the parser but the ID will not be re-inserted as a duplicate.

---

## Sequence Counter (changed behavior)

**Before**: Resets to 0 on every watcher attach. New entries after restart have sequence numbers starting at 1, sorting before all pre-restart entries.

**After**: On every watcher attach, the counter initializes to `getMaxSequenceNumber(sessionId) + 1`. If no stored entries exist, starts at 1.

**DB query** (new helper function added to `database.ts`):
```sql
SELECT COALESCE(MAX(sequence_number), 0)
FROM session_output
WHERE session_id = ?
```

This query uses the existing `idx_output_seq` index on `(session_id, sequence_number)` and is O(log n).

---

## File Position (watcher internal state)

**No DB storage.** Held in the watcher's in-memory `Map<string, number>`.

**Before (Claude)**: Initialized to `0` (full-file read on attach).
**Before (Copilot)**: Initialized to `max(0, fileSize - TAIL_BYTES)` (tail read on attach), but stored output was cleared first.

**After (both)**: Initialized to `max(0, fileSize - TAIL_BYTES)` on every attach. Stored output is never cleared. Deduplication via INSERT OR IGNORE handles tail-window overlap with already-stored entries.

---

## New Shared Watcher Utilities

**File**: `backend/src/utils/watcher-utils.ts` (new)

| Export | Type | Description |
|--------|------|-------------|
| `TAIL_BYTES` | `const number` | `16 * 1024` — tail window for both watchers |
| `splitLinesWithOffsets(buffer, baseOffset)` | function | Splits a `Buffer` into `{text, byteOffset}[]` using absolute file offsets |
| `makeLineId(sessionId, byteOffset, blockIndex)` | function | Returns `${sessionId}-${byteOffset}-${blockIndex}` |

Imported by both `claude-jsonl-watcher.ts` and `copilot-cli-detector.ts`. The parsers do not import from this file directly; they receive IDs via a `makeId` callback (see contracts).
