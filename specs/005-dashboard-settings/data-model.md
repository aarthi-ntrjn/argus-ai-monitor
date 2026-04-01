# Data Model: Dashboard Settings

## Entities

### DashboardSettings

Client-side only. Stored in `localStorage` under key `argus:settings` as JSON.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `showEndedSessions` | `boolean` | `true` | When `false`, sessions with status `completed` or `ended` are hidden from all repository cards |

**Validation rules:**
- If the value read from `localStorage` cannot be parsed as valid JSON, fall back to the default `{ showEndedSessions: true }`.
- If a key is missing from the stored JSON, its default value is used (forward-compatible with future settings additions).

**Future extension pattern**: Add new fields to `DashboardSettings` with explicit defaults. The `useSettings` hook merges stored values with defaults, so existing stored data is never broken by new fields.

---

### Session (existing  relevant fields)

| Field | Type | Description |
|-------|------|-------------|
| `status` | `SessionStatus` | `'active' \| 'idle' \| 'waiting' \| 'error' \| 'completed' \| 'ended'` |
| `endedAt` | `string \| null` | Non-null when session has finished |

**"Ended session" definition**: A session is considered ended when `status === 'completed'` OR `status === 'ended'`. Active sessions are those with status `active`, `idle`, `waiting`, or `error`.

---

## State Transitions

```
DashboardSettings.showEndedSessions:
  true  [user toggles off]>  false  [user toggles on]>  true
  
  On toggle:  update React state + write to localStorage
  On load:    read from localStorage (fall back to default if missing/invalid)
```

## Storage Contract

```json
// localStorage key: "argus:settings"
// Value (JSON string):
{
  "showEndedSessions": true
}
```
