# Data Model: Session Prompt History Navigation

**Branch**: `051-prompt-history` | **Date**: 2026-04-20

All data structures are in-memory only. No database schema changes.

---

## Types

### `PromptHistoryState` (internal hook state)

```typescript
interface PromptHistoryState {
  entries: string[];           // All history entries, chronological order (oldest[0], newest[N-1])
  historyIndex: number | null; // null = draft mode; 0 = most recent entry, 1 = second most recent, ...
  draft: string;               // Saved input text before first up arrow press this navigation session
  pendingBarSends: Map<string, number>; // text → count of bar-sent messages not yet seen in session output
  lastSeenSequence: number;    // Highest sequenceNumber processed from session output
}
```

### `UsePromptHistoryResult` (hook public API)

```typescript
interface UsePromptHistoryResult {
  isNavigating: boolean;       // true when historyIndex !== null
  indicator: string | null;    // e.g., "3 / 12" while navigating, null otherwise
  navigateUp: (currentInput: string) => string;  // returns text to display; saves draft on first call
  navigateDown: () => string;  // returns text to display; returns draft when past newest entry
  addEntry: (text: string) => void;  // called on send; resets navigation state
  resetNavigation: () => void; // resets to draft mode without sending
}
```

---

## Invariants

- `entries.length <= 50` — entries beyond the cap are dropped (oldest first).
- `historyIndex` is always in range `[0, entries.length - 1]` when not null.
- `draft` is only meaningful when `historyIndex !== null`; it holds the exact string present in the input at the moment `historyIndex` transitioned from `null` to `0`.
- `pendingBarSends` counts are always non-negative. A key is deleted when its count reaches 0.
- `lastSeenSequence` starts at 0 and only increases. It prevents processing the same session output entries twice across re-renders.

---

## State Transitions

```
Initial:
  entries = [existing "you" messages from session output]
  historyIndex = null
  draft = ''
  pendingBarSends = {}
  lastSeenSequence = max(sequenceNumber of existing entries)

ArrowUp pressed (historyIndex === null):
  draft ← currentInput
  historyIndex ← 0
  input ← entries[entries.length - 1]  (most recent)

ArrowUp pressed (historyIndex > 0):
  historyIndex ← historyIndex + 1
  input ← entries[entries.length - 1 - historyIndex]

ArrowUp pressed (historyIndex === entries.length - 1):
  no-op (at oldest entry)

ArrowDown pressed (historyIndex > 0):
  historyIndex ← historyIndex - 1
  input ← entries[entries.length - 1 - historyIndex]

ArrowDown pressed (historyIndex === 0):
  historyIndex ← null
  input ← draft

Send (addEntry called):
  entries ← [...entries, text].slice(-50)  (cap at 50, drop oldest)
  pendingBarSends[text] ← (pendingBarSends[text] ?? 0) + 1
  historyIndex ← null
  draft ← ''

New session output "you" message (sequence > lastSeenSequence):
  if pendingBarSends[text] > 0:
    pendingBarSends[text] -= 1
    if pendingBarSends[text] === 0: delete pendingBarSends[text]
    // already in entries from addEntry — skip
  else:
    entries ← [...entries, text].slice(-50)
  lastSeenSequence ← max(lastSeenSequence, sequenceNumber)
```

---

## Source of "You" Messages

Session output items qualify as history entries when ALL of the following hold:
- `role === 'user'`
- `type === 'message'`
- `isMeta !== true`
- `content` is non-empty (after trim)

These are extracted from the React Query cache for key `['session-output', sessionId]`.
