# Tasks: Fix Blank MSG Rows in Copilot Output Rendering

**Branch**: `019-fix-output-rendering`
**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Research**: [research.md](research.md)

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2)

---

## Phase 1: Setup

**Purpose**: No new infrastructure needed. This phase is a no-op — the repo, test runner, and file structure already exist.

*(No tasks — skip directly to Phase 2)*

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Understand and reproduce the bug through failing tests before touching implementation.

- [x] T001 Write failing unit test for unrecognised copilot event type producing blank MSG content in `backend/tests/unit/events-parser.test.ts`
- [x] T002 [P] Write failing unit test for `assistant.message` with `data.content` as a text content-block array in `backend/tests/unit/events-parser.test.ts`
- [x] T003 [P] Write failing unit test for `user.message` with `data.content` as a text content-block array in `backend/tests/unit/events-parser.test.ts`
- [x] T004 Run `npm run test --workspace=backend` and confirm T001-T003 test cases fail (red)

**Checkpoint**: Three failing tests confirm the two bug paths are reproduced.

---

## Phase 3: User Story 1 - Copilot Output Shows No Blank Rows (Priority: P1)

**Goal**: Ensure no MSG-badged row in the copilot output pane ever has blank content.

**Independent Test**: Run the new unit tests (T001-T003) — all must turn green. Verify existing T085/T088/T086 regression tests still pass.

### Implementation for User Story 1

- [x] T005 [US1] In `extractContent` in `backend/src/services/events-parser.ts`, add an `Array.isArray(data.content)` branch after the string check that joins `{type: "text", text: "..."}` blocks with `"\n"` (fixes Path B — content-block arrays returning blank)
- [x] T006 [US1] In `parseJsonlLine` in `backend/src/services/events-parser.ts`, after `content` is resolved, add a fallback: if `outputType === 'message' && role === null && !content`, set `content = JSON.stringify(event.data ?? {})` (fixes Path A — unrecognised event types returning blank MSG rows)
- [x] T007 [US1] Run `npm run test --workspace=backend` and confirm all tests pass (green), including T001-T003 and all T085/T088/T086 regressions

**Checkpoint**: All unit tests green. US1 is complete and independently verifiable.

---

## Phase 4: User Story 2 - Content Blocks in Copilot Messages Rendered (Priority: P2)

**Goal**: Forward-compatibility: handle `data.content` as a mixed array of text and non-text blocks.

**Independent Test**: Feed the parser a `data.content` array containing both text and non-text blocks; confirm only text blocks appear in the output (concatenated), non-text blocks are skipped.

### Tests for User Story 2

- [x] T008 [P] [US2] Write unit test for mixed content-block array (text + non-text blocks skipped) in `backend/tests/unit/events-parser.test.ts`
- [x] T009 [P] [US2] Write unit test for `data.content` array with two text blocks (joined with `"\n"`) in `backend/tests/unit/events-parser.test.ts`
- [x] T010 [US2] Run tests and confirm T008-T009 fail (red)

### Implementation for User Story 2

- [x] T011 [US2] Verify `extractContent` array branch (added in T005) correctly skips non-text blocks and joins multiple text blocks — adjust if needed in `backend/src/services/events-parser.ts`
- [x] T012 [US2] Run `npm run test --workspace=backend` and confirm T008-T009 now pass (green)

**Checkpoint**: All tests green. US1 and US2 both independently verifiable.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [x] T013 [P] Update `docs/README-CLI-COMPARISON.md` — add note in the Copilot CLI event mapping table that `data.content` may be a content-block array and that unrecognised event types serialize `data` as their content
- [x] T014 [P] Run full test suite `npm run test --workspace=backend` to confirm no regressions
- [x] T015 Run `npm run build --workspace=frontend` to confirm frontend still builds cleanly (no changes expected)

---

## Dependencies & Execution Order

- **Phase 2** (T001-T004): Must complete before Phase 3 — failing tests must exist first (§IV test-first)
- **Phase 3** (T005-T007): Depends on Phase 2. T005 and T006 can run in parallel (both edit same file but independent logic blocks); T007 depends on both
- **Phase 4** (T008-T012): Depends on Phase 3 completion. T008 and T009 can run in parallel; T010 depends on both; T011 depends on T010; T012 depends on T011
- **Phase 5** (T013-T015): Depends on Phase 4. T013 and T014 can run in parallel; T015 depends on T014

### Parallel Opportunities

```bash
# Phase 2 — write all three failing tests together:
T001: unrecognised event type test
T002: assistant.message array content test
T003: user.message array content test

# Phase 3 — implement both fixes together (different logic blocks in same file):
T005: extractContent array branch
T006: parseJsonlLine unrecognised-type fallback

# Phase 4 — write both new tests together:
T008: mixed block array test
T009: two-text-block join test

# Phase 5 — run in parallel:
T013: README-CLI-COMPARISON.md update
T014: full test suite run
```

---

## Implementation Strategy

### MVP (User Story 1 only)

1. Complete Phase 2 (failing tests)
2. Complete Phase 3 (fix + green tests)
3. **Validate**: All T085/T088/T086 regressions still pass; new tests green
4. Phase 5 polish

### Full Delivery

1. MVP above
2. Phase 4 (content-block array edge cases)
3. Phase 5 (docs + final checks)
