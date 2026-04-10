# Data Model: 023-stream-attention

This feature introduces no new backend entities. All changes are UI-only.

## Modified: DashboardSettings (frontend/src/types.ts)

Added field: `outputDisplayMode`

```typescript
export type OutputDisplayMode = 'focused' | 'verbose';

export interface DashboardSettings {
  hideEndedSessions: boolean;
  hideReposWithNoActiveSessions: boolean;
  hideInactiveSessions: boolean;
  outputDisplayMode: OutputDisplayMode;   // NEW
}

export const DEFAULT_SETTINGS: DashboardSettings = {
  hideEndedSessions: false,
  hideReposWithNoActiveSessions: false,
  hideInactiveSessions: false,
  outputDisplayMode: 'focused',           // NEW — default to Focused
};
```

**Persistence**: Stored in `localStorage` under the existing `argus:settings` key via `useSettings`. Backwards-compatible: existing stored settings without this field will receive the default value via `{ ...DEFAULT_SETTINGS, ...parsed }` spread in `loadSettings()`.

## New UI-Only Concepts

### OutputDisplayMode

- **Values**: `'focused'` | `'verbose'`
- **Default**: `'focused'`
- **Persistence**: `localStorage` via `DashboardSettings.outputDisplayMode`
- **Scope**: Global (applies to all sessions and pane reopens)

### ExpandedSet (ephemeral, no persistence)

- **Type**: `Set<string>` (set of `SessionOutput.id` values)
- **Scope**: Local to a `SessionDetail` instance; reset on unmount
- **Purpose**: Tracks which individual collapsed rows the user has manually expanded in Focused mode

## Unchanged Backend Entities

The `SessionOutput` entity (defined in `backend/src/models/index.ts` and `frontend/src/types.ts`) is unchanged:

```typescript
interface SessionOutput {
  id: string;
  sessionId: string;
  timestamp: string;
  type: 'message' | 'tool_use' | 'tool_result' | 'error' | 'status_change';
  content: string;
  toolName: string | null;
  role: 'user' | 'assistant' | null;
  sequenceNumber: number;
}
```
