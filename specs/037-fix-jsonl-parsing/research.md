# Research: Fix JSONL Parsing Differences Between Claude and Copilot

**Branch**: `037-fix-jsonl-parsing` | **Date**: 2026-04-18

## Phase 0 Findings

No external research required. All decisions are fully resolved from direct code inspection of the existing implementation. Findings are documented below.

---

## Decision 1: Stable ID Scheme for Output Entry Deduplication

**Decision**: Claude entries use `${entry.uuid}-${role}-${blockIndex}` as the output ID. Copilot entries use `${sessionId}-${lineByteOffset}` as the output ID.

**Rationale**:
- Claude JSONL entries each carry a native `uuid` field. A single JSONL entry can produce multiple `SessionOutput` rows (one per content block). The block index suffix disambiguates them. The suffix `u` (user) / `a` (assistant) prevents any collision if the same UUID appeared in both roles.
- Copilot events have no native UUID. The file is append-only, so the absolute byte offset of a line is stable for the lifetime of the file. A re-read of the same line always starts at the same offset. This makes `${sessionId}-${lineByteOffset}` a reliable content-addressable key with no dependency on Copilot's event format.
- Both schemes replace the current `randomUUID()` call, which produces a new ID every parse, making INSERT OR IGNORE effectively useless today.

**Alternatives considered**:
- Hash of line content: rejected because identical content could appear twice (e.g., user sends the same message again), producing an incorrect deduplication collision.
- Sequential counter persisted in DB: rejected as unnecessary complexity given the byte-offset approach.
- Copilot native event ID: no such field exists in observed real events.

---

## Decision 2: Tail-Read on Every Watcher Attach (Both Watchers)

**Decision**: Both watchers set their initial file position to `max(0, fileSize - TAIL_BYTES)` on every call to `watchFile` / `watchEventsFile`, regardless of whether stored output already exists.

**Rationale**:
- This eliminates the full-file re-read that Claude currently performs on restart (position starts at 0).
- Combined with stable IDs and INSERT OR IGNORE, lines already in the DB are silently skipped; genuinely new lines (written while Argus was offline) are appended.
- Matches the clarified requirement: no persistent byte-offset storage, tail read on every attach.

**Alternatives considered**:
- Persist the last file position in the DB: rejected (user confirmed: tail read on restart is preferred over persistent position tracking).
- Apply tail only on first attach (no stored output): rejected (user confirmed: tail applies on every attach, deduplication handles overlap).

---

## Decision 3: Copilot Async I/O Conversion

**Decision**: Convert `copilot-cli-detector.ts` `readNewLines` from `openSync / readSync / closeSync` to `fsOpen / fh.read / fh.close` from `fs/promises`. Make `readNewLines` and `watchEventsFile` async. Call `readNewLines().catch()` from the chokidar onChange handler.

**Rationale**:
- Blocking sync I/O on the chokidar event loop thread can stall the scan cycle when events.jsonl is large.
- The Claude watcher already uses async I/O (fs/promises); aligning Copilot removes the asymmetry.
- No behavior change; only the I/O model changes.

**Alternatives considered**:
- Worker threads: over-engineered; async I/O is sufficient.
- Keep sync and add a comment: rejected (constitution §VIII and spec FR-015 explicitly require non-blocking I/O).

---

## Decision 4: Sequence Counter Resumption

**Decision**: On every watcher attach, query `SELECT MAX(sequence_number) FROM session_output WHERE session_id = ?` and initialize the in-memory sequence counter to `max + 1` (or 1 if no rows exist).

**Rationale**:
- Currently both watchers reset the sequence counter to 0 on every attach. After fixing ID stability and removing the output clear, new entries picked up from the tail would get sequence numbers starting at 1, appearing before all pre-restart entries in the UI (ordered by sequence_number ASC).
- The max query is cheap (indexed on `session_id, sequence_number`).
- No schema change needed.

**Alternatives considered**:
- Sort by timestamp instead of sequence_number: rejected; timestamps from JSONL files can be out of order relative to insertion time and may not be monotonic.
- Store sequence counter in DB: rejected; derivable from existing data with a single indexed query.

---

## Decision 5: TAIL_BYTES Constant Location

**Decision**: Extract `TAIL_BYTES = 16 * 1024` to a new shared constants file `backend/src/utils/watcher-constants.ts`, imported by both `claude-jsonl-watcher.ts` and `copilot-cli-detector.ts`.

**Rationale**:
- CLAUDE.md prohibits the same string/value defined in more than one place.
- Both watchers now use the same tail window; a single named constant prevents them from drifting apart.

---

## Decision 6: Remove `deleteSessionOutput` Call

**Decision**: Remove the `deleteSessionOutput(sessionId)` call from `copilot-cli-detector.ts watchEventsFile`. No replacement.

**Rationale**:
- The sole reason for clearing output was to give a clean slate before re-reading the tail. With stable IDs and INSERT OR IGNORE, the clear is no longer needed.
- Removing it directly fixes FR-006 / FR-011 (stored output must survive watcher restarts).

---

## No-Change Decisions

- **Parser modules stay separate**: `claude-code-jsonl-parser.ts` and `events-parser.ts` remain independent. Merging them would be a premature abstraction given the format differences.
- **`OutputEntry` type unchanged**: The ID field changes in value-generation logic only; the type signature is unchanged.
- **DB schema unchanged**: No new columns or tables needed. Existing `INSERT OR IGNORE` constraint + stable IDs is sufficient.
- **Tail window size unchanged**: 16 KB is the existing default. Tuning it is out of scope.
