# Research: AI Choice Alert

## Decision 1: Detection location — frontend vs backend

**Decision**: Detect pending user-choice interactions in the frontend (`SessionCard`) by examining the already-fetched session output items. No backend changes.

**Rationale**: The session output store already contains `tool_use` rows with `toolName` and `toolCallId` for every tool call, including `ask_user` and `AskUserQuestion`. The `session-output-last` query cache in React Query is kept up-to-date via WebSocket events (`session.output` and `session.output.batch` handlers in `socket.ts`). A pure frontend O(N) scan of the last N items is sufficient and avoids any backend schema or API changes.

**Alternatives considered**:
- Add a `hasPendingChoice` flag to the Session model (backend change): Would require DB migration, API change, and broadcasting. Overkill for a display-only flag. Rejected.
- New `/sessions/:id/pending-choice` endpoint: Same drawbacks. Rejected.

## Decision 2: Detection algorithm

**Decision**: Scan the items array in reverse order. The first `tool_use` item found with `toolName` in `["ask_user", "AskUserQuestion"]` is the candidate. If no `tool_result` item with a `sequenceNumber` greater than the candidate's `sequenceNumber` exists in the array, the choice is pending. Return the parsed question and choices; otherwise return null.

**Rationale**: Sessions pause output production while waiting for user input. The pending tool call is always near the end of the output window. Scanning in reverse is O(N) and hits the common case immediately.

**Edge cases handled**:
- Answered choice (tool_result follows): algorithm finds the tool_result and returns null.
- Multiple unanswered calls: reverse scan naturally picks the most recent one.
- No choice calls at all: scan finds nothing, returns null.

## Decision 3: Output fetch window size

**Decision**: Keep `limit: 10` for the `session-output-last` query and the WebSocket slice size. Do not increase.

**Rationale**: When the AI issues an `ask_user` call, it immediately stops producing output (it is waiting for the user). So the pending tool_use is always one of the last 1-2 items. Increasing the limit adds no detection coverage and would require changing the WebSocket cache slice as well.

## Decision 4: AskUserQuestion input schema

**Decision**: Parse `AskUserQuestion` input JSON as `{ question: string; options?: string[] }`. If `options` is absent, show ATTENTION NEEDED + question only.

**Rationale**: `AskUserQuestion` is a Claude Code built-in deferred tool used for free-form questions to the human. From the Claude Code SDK, its input is `{ question: string }` — no choices array. The `options` field is treated as optional to future-proof against SDK changes. If present (hypothetically), display them the same as Copilot choices. In practice, `AskUserQuestion` alerts will show ATTENTION NEEDED + question text only.

**Copilot `ask_user` schema** (confirmed from live logs):
```json
{
  "question": "Could you clarify what you mean by...",
  "choices": ["Option A", "Option B", "Option C"]
}
```

## Decision 5: Summary line layout for the alert

**Decision**: Replace the `<p>` summary line content with: `ATTENTION NEEDED` (bold red span) + question text + choices formatted as "1. A / 2. B / 3. C". Remove the `truncate` CSS class when an alert is active so choices wrap naturally. Apply `line-clamp-3` instead to cap the height at a readable but bounded size.

**Rationale**: `truncate` (single-line ellipsis) would hide most of the choices, defeating the purpose. A 3-line clamp allows the question and several choices to be visible without unbounded growth.

**Alternatives considered**:
- Keep `truncate`: loses all choices after the first few characters. Rejected.
- No height cap: cards could grow very tall with many choices. Rejected.
- Separate DOM element for choices: cleaner DOM but requires more layout changes. Rejected for this scope.
