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

// After — new optional makeId callback
export function parseClaudeJsonlLine(
  line: string,
  sessionId: string,
  sequenceNumber: number,
  makeId?: (blockIndex: number) => string
): SessionOutput[]
```

**Change**: Each `SessionOutput` is assigned `id = makeId(blockIndex)` when `makeId` is provided, or `randomUUID()` when absent (preserves backward compatibility for existing tests). Block index is 0-based per JSONL entry.

**Contract**:
- Returns `[]` for empty lines, unknown types, and `file-history-snapshot` entries.
- Returns one `SessionOutput` per recognized content block (text, tool_use, tool_result).
- When `makeId` is provided, re-parsing the same JSONL line produces identical IDs — enabling INSERT OR IGNORE deduplication.
- `makeId` is called once per output block, in the order blocks are produced.

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

// After — new optional makeId callback
export function parseJsonlLine(
  line: string,
  sessionId: string,
  sequenceNumber: number,
  makeId?: (blockIndex: number) => string
): SessionOutput | null
```

**Change**: The single returned `SessionOutput` (if any) is assigned `id = makeId(0)` when `makeId` is provided, or `randomUUID()` when absent. Block index is always `0` for Copilot (one output per line).

**Contract**:
- Returns `null` for empty lines, unknown event types with no role, and message events with no extractable content.
- When `makeId` is provided, re-parsing the same line produces an identical ID.

---

## `splitLinesWithOffsets` (new)

**File**: `backend/src/utils/watcher-utils.ts`

```typescript
export function splitLinesWithOffsets(
  buffer: Buffer,
  baseOffset: number
): Array<{ text: string; byteOffset: number }>
```

**Contract**:
- Splits `buffer` on `\n`, tracking each line's absolute byte position in the source file (`baseOffset` is the file offset of the buffer's first byte).
- Blank lines (after trim) are excluded from the result.
- `byteOffset` for each entry is the absolute position of the line's first byte within the file.
- Used by both `claude-jsonl-watcher.ts` and `copilot-cli-detector.ts` to produce byte offsets for `makeLineId`.

---

## `makeLineId` (new)

**File**: `backend/src/utils/watcher-utils.ts`

```typescript
export function makeLineId(
  sessionId: string,
  byteOffset: number,
  blockIndex: number
): string
```

**Contract**:
- Returns `${sessionId}-${byteOffset}-${blockIndex}`.
- Called by watchers to construct the `makeId` callback passed into both parsers:
  ```typescript
  // In both watchers, per line:
  const lineId = (blockIndex: number) => makeLineId(sessionId, line.byteOffset, blockIndex);
  parseClaudeJsonlLine(line.text, sessionId, seq, lineId);
  parseJsonlLine(line.text, sessionId, seq, lineId);
  ```

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

## Watcher Attach Invariants (both watchers)

After this feature, both `ClaudeJsonlWatcher.watchFile` and `CopilotCliDetector.watchEventsFile` satisfy:

1. **No output clearing**: Neither method calls `deleteSessionOutput` or any destructive DB operation.
2. **Tail read**: File position initialized to `max(0, fileSize - TAIL_BYTES)`.
3. **Sequence resumption**: Sequence counter initialized to `getMaxSequenceNumber(sessionId) + 1`.
4. **Stable IDs**: Every parsed line passes `(blockIndex) => makeLineId(sessionId, byteOffset, blockIndex)` to the parser.
5. **INSERT OR IGNORE**: Duplicate entries from tail-window overlap with stored entries are silently skipped.
6. **Async I/O**: All file reads use `fs/promises` (non-blocking).
