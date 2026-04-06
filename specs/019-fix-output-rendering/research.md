# Research: Fix Blank MSG Rows in Copilot Output Rendering

## Decision 1 — Root Cause of Blank MSG Rows

**Decision**: Two separate code paths produce blank MSG rows.

**Rationale**:
- Path A: An event type not present in `EVENT_TYPE_MAP` (e.g. a future `thinking` event) defaults to `type: 'message', role: null`. The `extractContent` fallback strips all known meta-fields (`type`, `timestamp`, `id`, `parentId`, `data`, `tool_name`, `content`) and returns `""` because nothing meaningful remains in `rest`.
- Path B: An `assistant.message` or `user.message` event whose `data.content` is a typed content-block array (rather than a plain string) fails the `typeof data.content === 'string'` check and also falls through to the same empty fallback.

**Alternatives considered**:
- Suppress unknown event types entirely (return null from parser): rejected per user decision — best-effort visibility is preferred.
- Show a fixed placeholder string like `"[unknown event]"`: rejected — serializing `event.data` is more informative and transparent.

---

## Decision 2 — Content-Block Array Handling

**Decision**: Join all `{type: "text", text: "..."}` blocks with `"\n"`. Non-text blocks (tool_use, tool_result) are skipped.

**Rationale**: The Anthropic Claude API and GitHub Copilot CLI both use the same content-block schema. The Claude Code parser (`claude-code-jsonl-parser.ts`) already handles this correctly. Reusing the same join pattern keeps both parsers consistent.

**Alternatives considered**:
- JSON-stringify the entire array: too noisy; raw JSON is harder to read than plain text.
- Only take the first text block: loses information when multiple text blocks exist.

---

## Decision 3 — Where to Inject the Data Serialization Fallback

**Decision**: Inside `parseJsonlLine`, after `extractContent` runs, check `if (outputType === 'message' && role === null && !content)` and replace content with `JSON.stringify(event.data ?? {})`.

**Rationale**: Keeping this logic in `parseJsonlLine` rather than inside `extractContent` preserves the single-responsibility of `extractContent` (content extraction) vs. the event-routing logic in `parseJsonlLine`. It also means known event types (those with role set) are never affected.

**Alternatives considered**:
- Add the fallback inside `extractContent`: requires passing the event type into `extractContent`, coupling it to routing logic.
- Filter out MSG rows in the frontend: hides the symptom rather than fixing the cause; the data would still be lost.
