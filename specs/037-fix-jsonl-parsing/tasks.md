# Tasks: Fix JSONL Parsing Logic Differences Between Claude and Copilot

**Branch**: `037-fix-jsonl-parsing` | **Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

## Phase 0: Research and Design

- [X] T001 [P] [US1/US2/US3] Read and analyse existing Claude and Copilot JSONL watcher and parser code; document behavioural differences in research.md
- [X] T002 [P] [US1/US2/US3] Generate plan.md, research.md, data-model.md, and contracts/ for the feature

## Phase 1: DB Helper and Shared Utilities

- [X] T003 [US3] Add `getMaxSequenceNumber(sessionId)` to database.ts using existing idx_output_seq index (no schema change)
- [X] T004 [US1/US2/US3] Create `TAIL_BYTES` constant and `splitLinesWithOffsets` / `makeLineId` helpers (landed in jsonl-watcher-base.ts instead of a separate watcher-utils.ts per plan; equivalent result)

## Phase 2: Parser Updates

- [X] T005 [US1] Update `claude-code-jsonl-parser.ts`: accept `makeId?(blockIndex: number) => string` callback; replace `randomUUID()` with `makeId(blockIndex)` when provided
- [X] T006 [US1/US2] Update `copilot-cli-jsonl-parser.ts` (`parseJsonlLine` and `parseModel`): accept `makeId` callback; replace `randomUUID()` with `makeId(blockIndex)` when provided; normalise return type to `SessionOutput[]`
- [X] T007 [US4] Suppress blank `assistant.message` events (null or empty `data.content`) and unknown Copilot event types from parser output

## Phase 3: Watcher Refactor

- [X] T008 [US3] Extract `JsonlWatcherBase` abstract class with `attachWatcher`, `readNewLines`, and `stopWatchers`; both watchers extend it
- [X] T009 [US3] Extract shared session-update helpers (`applyActivityUpdate`, `applyModelUpdate`, `applySummaryUpdate`) into `watcher-session-helpers.ts`
- [X] T010 [US3] Implement tail-read on `attachWatcher`: set initial position to `max(0, fileSize - TAIL_BYTES)` for both watcher types
- [X] T011 [US3] Implement sequence-counter resumption on `attachWatcher`: initialise from `getMaxSequenceNumber(sessionId) + 1`
- [X] T012 [US3] Remove destructive output-clear from Copilot watcher (previously `deleteSessionOutput` was called on watchEventsFile)
- [X] T013 [US3] Convert Copilot watcher file I/O to async (`fs/promises`) matching Claude watcher
- [X] T014 [US1/US2/US3] Produce stable output entry IDs (`${sessionId}-${byteOffset}-${blockIndex}`) via `makeLineId`; enables INSERT OR IGNORE deduplication to prevent duplicate events after server restart
- [X] T015 [US2] Rename `parseModelFromEvent` to `parseModel` in copilot parser for naming consistency with Claude parser
- [X] T016 [US2] Move model-detection logic from individual parsers into `JsonlWatcherBase.readNewLines` via `parseModelFromLine` (tries Claude and Copilot formats)

## Phase 4: Tests

- [X] T017 [US1/US2] Update `events-parser.test.ts` to cover new `makeId` callback, normalised return type, and `parseModel` rename
- [X] T018 [US3] Add `watcher-session-helpers.test.ts`: unit tests for `applyActivityUpdate`, `applyModelUpdate`, and `applySummaryUpdate`
- [X] T019 [US3] Add `jsonl-watcher-base.test.ts`: unit tests for `attachWatcher` (tail-read, sequence resumption, non-existent file), `readNewLines` (stable IDs, dedup gating), and `stopWatchers`

## Phase 5: Documentation

- [X] T020 [US3] Update README.md to reflect improved session output persistence across backend restarts (headless launch mode section and output pane description)
