# Data Model: AI Choice Alert

## No database schema changes

This feature adds no new tables, columns, or API endpoints. All detection is computed from the existing `SessionOutput` data already returned by `GET /sessions/:id/output`.

## New TypeScript type: `PendingChoice`

**Location**: `frontend/src/utils/sessionUtils.ts` (alongside `isInactive`)

```typescript
export interface PendingChoice {
  question: string;
  choices: string[];
}
```

| Field | Type | Description |
|-------|------|-------------|
| `question` | `string` | The question the AI is asking the user. Empty string if not parseable. |
| `choices` | `string[]` | Ordered list of labelled options. Empty array if the tool has no choices (e.g., AskUserQuestion free-form). |

## New utility function: `detectPendingChoice`

**Location**: `frontend/src/utils/sessionUtils.ts`

```typescript
export function detectPendingChoice(items: SessionOutput[]): PendingChoice | null
```

### Logic

1. Iterate `items` in reverse (most-recent-first).
2. Skip any item that is a `tool_result` — record its `sequenceNumber` as `lastResultSeq` (track the highest).
3. On finding a `tool_use` item with `toolName` in `["ask_user", "AskUserQuestion"]`:
   - If `lastResultSeq > item.sequenceNumber`: the choice was answered — return `null`.
   - Otherwise: parse `item.content` as JSON to extract `question` and `choices` (or `options`). Return a `PendingChoice`.
4. Return `null` if no matching `tool_use` is found.

### Tool input parsing

**Copilot `ask_user`** (content is JSON-stringified arguments):
```json
{ "question": "Which framework?", "choices": ["React", "Vue"] }
```
Map `choices` to `PendingChoice.choices`.

**Claude Code `AskUserQuestion`** (content is JSON-stringified input):
```json
{ "question": "What directory should I use?" }
```
Map `question`; set `choices` to `[]`.

### Error handling

If `JSON.parse(item.content)` throws, return `{ question: '', choices: [] }` — the caller still shows ATTENTION NEEDED without a question or choices.

## Updated component: `SessionCard`

**Location**: `frontend/src/components/SessionCard/SessionCard.tsx`

The summary `<p>` element (currently renders `session.summary`) gains a new conditional branch:

```
pendingChoice !== null
  → render: <span bold red>ATTENTION NEEDED</span> + question text + choices
  → CSS: remove `truncate`, add `line-clamp-3 whitespace-normal`
else
  → render: session.summary or "Nothing sent yet" (unchanged)
  → CSS: `truncate` (unchanged)
```

The `pendingChoice` value is computed via `detectPendingChoice(items)` where `items` comes from the existing `useQuery(['session-output-last', session.id])`.

Sessions with `status === 'ended'` or `status === 'completed'` always take the else branch regardless of output content.
