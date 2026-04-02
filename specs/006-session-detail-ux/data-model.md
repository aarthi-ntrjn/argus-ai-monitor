# Data Model: Session Detail UX Redesign

## Modified Entities

### Session (backend model)

No schema changes — the existing `pid` column (`INTEGER NULL`) is reused. The change is behavioural: `ClaudeCodeDetector` now populates `pid` with the OS process ID of the detected Claude process when it can be determined.

| Field | Type | Change |
|-------|------|--------|
| `pid` | `number \| null` | Now populated for Claude Code sessions when OS process is detected (previously always `null`) |
| All other fields | unchanged | No migration needed |

### ControlActionType (frontend + backend)

```ts
// Before
type ControlActionType = 'stop' | 'send_prompt';

// After
type ControlActionType = 'stop' | 'send_prompt' | 'interrupt';
```

---

## New Frontend Entities

### SelectedSession (UI state — not persisted)

Tracked in `DashboardPage` React state. Controls whether the right output pane is shown.

```ts
const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
```

- `null` — no session selected, single-column layout
- `string` — session selected, two-column layout with `OutputPane` on the right

---

### QuickCommand

A static definition used by the `QuickCommands` component. Not stored anywhere — purely a UI config object.

```ts
interface QuickCommand {
  id: 'esc' | 'exit' | 'merge' | 'pull';
  label: string;
  prompt?: string;        // if set, send as prompt via /send
  isInterrupt?: boolean;  // if true, call /interrupt instead
  requiresConfirm: boolean;
  sessionTypes: SessionType[];  // which session types support this command
}
```

| id | label | action | confirm | session types |
|----|-------|--------|---------|--------------|
| `esc` | Esc | `POST /interrupt` | No | `claude-code` |
| `exit` | Exit | `POST /send` with `/exit` | Yes | `claude-code` |
| `merge` | Merge | `POST /send` with `merge current branch with main` | No | `claude-code` |
| `pull` | Pull latest | `POST /send` with `pull latest changes from main branch` | No | `claude-code` |

> Note: Quick commands are shown only for `claude-code` sessions in v1. Copilot CLI sessions show only an inline stop (via the existing stop endpoint) since prompt injection is unsupported.

---

## State Transitions

### SessionCard confirmation state

```
Normal view
  [Exit clicked]→  Confirming exit
  [Confirm]→  /send ("/exit") dispatched  →  Normal view (session ending)
  [Cancel]→  Normal view
```

### OutputPane lifecycle

```
No session selected (dashboard single-column)
  [card clicked]→  Session selected (two-column layout, OutputPane mounted)
  [different card clicked]→  OutputPane switches to new session
  [close button / Escape]→  No session selected (single-column)
  [selected session ends]→  OutputPane remains, controls hidden, output visible
```

---

## Storage Contract

No new localStorage keys. No backend schema changes. No migrations required.
