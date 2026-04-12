# Tasks: AI Choice Alert

**Branch**: `028-ai-choice-alert`
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

---

## Phase 1: Setup

**Goal**: Add the `PendingChoice` type and `detectPendingChoice` function signature (stub) to `sessionUtils.ts`. No behaviour change yet.

- [x] T001 [P1] Add `PendingChoice` interface and stub `detectPendingChoice(items: SessionOutput[]): PendingChoice | null` (returns `null`) to `frontend/src/utils/sessionUtils.ts`.

---

## Phase 2: Foundational (tests first — CRITICAL gate)

**Goal**: Write failing tests for `detectPendingChoice` before implementing it.

**Independent test criteria**: `npm test` in the frontend passes overall; the new `detectPendingChoice` tests fail until T003 is implemented.

- [x] T002 [P2] Add `describe('detectPendingChoice', ...)` block to `frontend/src/__tests__/sessionUtils.test.ts` covering:
  - Returns `null` for empty items array.
  - Returns `null` when no `ask_user` or `AskUserQuestion` tool_use exists.
  - Returns `PendingChoice` with question and choices when last item is an unanswered `ask_user` tool_use (Copilot format).
  - Returns `PendingChoice` with question and empty choices when last item is an unanswered `AskUserQuestion` tool_use (Claude format).
  - Returns `null` when the `ask_user` tool_use has a subsequent `tool_result` (answered).
  - Returns `{ question: '', choices: [] }` when tool input is malformed JSON (does not throw).
  - Returns `null` when matching tool_use exists but session items contain a tool_result with higher sequenceNumber.

*Confirm tests are red, then implement T003.*

- [x] T003 [P2] Implement `detectPendingChoice` in `frontend/src/utils/sessionUtils.ts` (full logic per data-model.md). Confirm all T002 tests turn green.

---

## Phase 3: US1 + US2 — Render ATTENTION NEEDED in SessionCard

**Goal**: `SessionCard` renders the alert for both readonly and connected sessions.

**Independent test criteria**: Mocking `useQuery` to return a pending `ask_user` tool_use causes the summary line to show "ATTENTION NEEDED" with the question and choices.

### Test tasks (write first)

- [x] T004 [P3] Add tests to `frontend/src/__tests__/SessionCard.test.tsx`:
  - Summary shows "ATTENTION NEEDED" (with `role="alert"`) when `useQuery` returns items with a pending `ask_user` tool_use (readonly session).
  - Summary shows the question text alongside "ATTENTION NEEDED".
  - Summary shows labelled choices ("1. Option A / 2. Option B") alongside "ATTENTION NEEDED".
  - Summary shows "ATTENTION NEEDED" for a connected (PTY) session with a pending choice.
  - Normal summary is shown when there is no pending choice (no regression).
  - Normal summary is shown when session status is "ended", even if output has a pending tool_use.
  - "ATTENTION NEEDED" is NOT shown when `ask_user` tool_use has a subsequent `tool_result`.

### Implementation tasks

- [x] T005 [P3] Update `frontend/src/components/SessionCard/SessionCard.tsx`:
  - Call `detectPendingChoice(items)` after deriving `items` from the query.
  - Replace the summary `<p>` conditional to render:
    - If `pendingChoice !== null` AND `session.status` not in `['ended', 'completed']`:
      - `<span>` with `font-bold text-red-600` containing "ATTENTION NEEDED"
      - Question text (if non-empty) appended after a space
      - Choices formatted as "1. X / 2. Y / ..." appended after a space (if any)
      - Apply `line-clamp-3 whitespace-normal break-words` instead of `truncate`
      - Add `role="alert"` to the `<p>` element for screen readers
    - Else: existing `session.summary || 'Nothing sent yet'` logic (unchanged)

---

## Phase 4: Polish

**Goal**: E2E test coverage; README update; build verification.

- [x] T006 [P4] Write `frontend/tests/e2e/sc-028-ai-choice-alert.spec.ts` with mocked API:
  - A session card with a pending `ask_user` tool_use shows "ATTENTION NEEDED" in the summary line.
  - The question text appears in the summary line.
  - The labelled choices appear in the summary line.
  - A session card with an answered `ask_user` (tool_result present) shows the normal summary.
  - A session with `status: 'ended'` does not show the alert even with a pending tool_use in output.
- [x] T007 [P4] Update `README.md`: document the ATTENTION NEEDED alert (what triggers it, what it shows, difference between readonly and connected sessions).
- [x] T008 [P4] Run `npm run build --workspace=frontend` and confirm zero errors.
- [x] T009 [P4] Run `npm test --workspace=frontend` (all unit tests pass) and `npm run test:e2e` (all e2e mock tests pass).

---

## Phase 5: Real-Time Detection via Claude Code PreToolUse Hook

**Goal**: Claude Code's `AskUserQuestion` tool_use is detected the moment Claude issues it (before the user answers), not after the JSONL file is written. This eliminates the race condition where the JSONL updates only after the user has already responded.

**Context and approach**: Claude Code supports lifecycle hooks configured in `~/.claude/settings.json`. Argus already injects `SessionStart` and `SessionEnd` hooks via `ClaudeCodeDetector.injectHooks()`. We extend this to also inject `PreToolUse` (matcher: `AskUserQuestion`) and `PostToolUse` (matcher: `AskUserQuestion`) hooks. When Claude Code calls `AskUserQuestion`, the `PreToolUse` hook fires BEFORE the interactive menu is shown, giving Argus a real-time signal. The backend broadcasts `session.pending_choice` via WebSocket; when the user answers, `PostToolUse` fires and Argus broadcasts `session.pending_choice.resolved`.

**Hook payload format** received by the backend at `POST /api/v1/hooks/claude`:
```json
{
  "hook_event_name": "PreToolUse",
  "session_id": "7da2ce24-07b2-479d-8cdc-a721357255c4",
  "tool_name": "AskUserQuestion",
  "tool_use_id": "toolu_01...",
  "tool_input": {
    "questions": [
      {
        "question": "Which color do you prefer?",
        "header": "Color",
        "multiSelect": false,
        "options": [
          {"label": "Red", "description": "Bold, fiery red"},
          {"label": "Blue", "description": "Calm, cool blue"}
        ]
      }
    ]
  },
  "cwd": "C:\\source\\github\\artynuts\\argus2"
}
```

**WebSocket events broadcast by backend**:
- `session.pending_choice` with data `{ sessionId: string, question: string, choices: string[] }` — sent on `PreToolUse`
- `session.pending_choice.resolved` with data `{ sessionId: string }` — sent on `PostToolUse`

**Independent test criteria**: Unit tests for `handleHookPayload` verify that `PreToolUse/AskUserQuestion` stores the pending choice and would broadcast the event, and that `PostToolUse/AskUserQuestion` clears it. No Claude Code process required.

### Test tasks (write first)

- [ ] T010 [P5] Add unit tests to `backend/tests/unit/claude-code-detector-hook.test.ts` covering:
  - `handleHookPayload` with `hook_event_name: 'PreToolUse'` and `tool_name: 'AskUserQuestion'` stores pending choice in the internal map.
  - Pending choice is extracted correctly from the nested `questions[0].question` / `questions[0].options[].label` format.
  - `handleHookPayload` with `hook_event_name: 'PostToolUse'` and `tool_name: 'AskUserQuestion'` removes the pending choice from the internal map.
  - `handleHookPayload` with a non-AskUserQuestion tool name and `PreToolUse` event does nothing (no pending choice stored).
  - `handleHookPayload` with `PreToolUse/AskUserQuestion` but `session_id` not matching any known repository does nothing (existing behaviour preserved).

### Implementation tasks

- [ ] T011 [P5] Refactor `HOOK_EVENTS` constant in `backend/src/services/claude-code-detector.ts` from `string[]` to `Array<{ event: string; matcher: string }>`:
  ```typescript
  const HOOK_EVENTS: Array<{ event: string; matcher: string }> = [
    { event: 'SessionStart', matcher: '' },
    { event: 'SessionEnd', matcher: '' },
    { event: 'PreToolUse', matcher: 'AskUserQuestion' },
    { event: 'PostToolUse', matcher: 'AskUserQuestion' },
  ];
  ```
  Update `hasHook(settings, event, matcher)` to match on both event AND matcher. Update `injectHooks()` to push entries with the correct matcher (not always `''`). Update `removeAllHooks()` to filter by both event+matcher. Update the stale-entry cleanup loop to remove Argus entries whose event is no longer in `HOOK_EVENTS` OR whose matcher no longer matches.

- [ ] T012 [P5] Add `private pendingChoices = new Map<string, import('../../models/index.js').PendingChoice>()` to `ClaudeCodeDetector` in `backend/src/services/claude-code-detector.ts`. Expose a `getPendingChoice(sessionId: string): PendingChoice | null` method (used by tests).

  Add `PendingChoice` type to `backend/src/models/index.ts` (or reuse from frontend type, but define independently in backend):
  ```typescript
  export interface PendingChoice {
    question: string;
    choices: string[];
  }
  ```

- [ ] T013 [P5] Extend `handleHookPayload()` in `backend/src/services/claude-code-detector.ts` to handle PreToolUse and PostToolUse for AskUserQuestion. Insert the new cases before the existing `SessionEnd` block:

  For `PreToolUse/AskUserQuestion`:
  - Extract `question` from `payload.tool_input?.questions?.[0]?.question` (or `payload.tool_input?.question` as fallback).
  - Extract `choices` by mapping `payload.tool_input?.questions?.[0]?.options` array entries via their `label` field (or `payload.tool_input?.choices` string array as fallback).
  - Store in `this.pendingChoices.set(session_id, { question, choices })`.
  - Broadcast: `broadcast({ type: 'session.pending_choice', timestamp: now, data: { sessionId: session_id, question, choices } })`.
  - Return early (do not fall through to session upsert logic).

  For `PostToolUse/AskUserQuestion`:
  - Call `this.pendingChoices.delete(session_id)`.
  - Broadcast: `broadcast({ type: 'session.pending_choice.resolved', timestamp: now, data: { sessionId: session_id } })`.
  - Return early.

  Condition: only act if `session_id` maps to a known session (`getSession(session_id)` returns non-null). If the session is unknown, return silently.

---

## Phase 6: Frontend Hook-Aware Detection

**Goal**: `SessionCard` shows ATTENTION NEEDED in real time when the `session.pending_choice` WebSocket event arrives, independently of the JSONL-based detection path.

**Independent test criteria**: Mocking the WebSocket to fire a `session.pending_choice` event causes the `['session-pending-choice', sessionId]` React Query cache to be populated, and the SessionCard renders ATTENTION NEEDED with the correct question and choices.

### Implementation tasks

- [ ] T014 [P6] Add two event handlers to `initSocketHandlers()` in `frontend/src/services/socket.ts`:

  ```typescript
  onEvent('session.pending_choice', (data) => {
    const { sessionId, question, choices } = data as {
      sessionId: string; question: string; choices: string[];
    };
    qc.setQueryData<import('../utils/sessionUtils').PendingChoice | null>(
      ['session-pending-choice', sessionId],
      { question, choices }
    );
  });

  onEvent('session.pending_choice.resolved', (data) => {
    const { sessionId } = data as { sessionId: string };
    qc.setQueryData<import('../utils/sessionUtils').PendingChoice | null>(
      ['session-pending-choice', sessionId],
      null
    );
  });
  ```

- [ ] T015 [P6] Update `frontend/src/components/SessionCard/SessionCard.tsx` to read the hook-based pending choice from React Query and merge it with the JSONL-based detection:

  Add a new `useQuery` call below the existing session output query:
  ```tsx
  const { data: hookPendingChoice = null } = useQuery<PendingChoice | null>({
    queryKey: ['session-pending-choice', session.id],
    queryFn: () => Promise.resolve(null),
    staleTime: Infinity,
    gcTime: Infinity,
  });
  ```

  Change the `pendingChoice` derivation line to:
  ```tsx
  const pendingChoice = isTerminated ? null : (hookPendingChoice ?? detectPendingChoice(items));
  ```

  The hook-based choice takes priority (it fires in real time before the JSONL is written). The JSONL-based detection remains as the fallback for Copilot `ask_user` and any session where the hook fires after Argus restarts.

### Test tasks

- [ ] T016 [P6] Add tests to `frontend/src/__tests__/SessionCard.test.tsx` for the hook-aware path:
  - When `['session-pending-choice', sessionId]` cache is pre-populated with a `PendingChoice` (via `qc.setQueryData`), the SessionCard renders ATTENTION NEEDED with the correct question and choices — even if `getSessionOutput` returns no pending tool_use items.
  - When `['session-pending-choice', sessionId]` is `null` and `getSessionOutput` returns a pending `ask_user` item, ATTENTION NEEDED still renders (JSONL fallback still works).
  - When `isTerminated` is `true` and `['session-pending-choice']` is populated, ATTENTION NEEDED is NOT shown (terminated sessions are always suppressed regardless of hook state).

---

## Phase 7: Polish

**Goal**: Documentation, build check, full test run.

- [ ] T017 [P7] Update `README.md` to document the PreToolUse hook mechanism under the "ATTENTION NEEDED Alert" section: explain that for Claude Code sessions Argus uses a `PreToolUse` hook (auto-configured in `~/.claude/settings.json`) for real-time detection, and that for Copilot sessions the detection is via output stream parsing.
- [ ] T018 [P7] Run `npm run build --workspace=frontend` and `cd backend && npm run build` — both must succeed with zero errors.
- [ ] T019 [P7] Run `npm test --workspace=frontend` (all unit tests pass) and `cd backend && npm test` (all backend unit tests pass) and `npm run test:e2e` (all e2e mock tests pass).

---

## Dependency Notes

- T010 (backend tests) can be written before T011-T013 and should fail until T011-T013 are done.
- T011 and T012 can be done in either order (no circular dep).
- T013 depends on T011 and T012.
- T014 and T015 can be done in parallel (different files).
- T016 depends on T015 (tests need the SessionCard to read the new query key).
- T017, T018, T019 can start only after all prior tasks are complete.
- **IMPORTANT**: Do not commit or push any changes until the user has reviewed and approved the plan.
