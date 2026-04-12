# Data Model: Configurable Resting Duration

## Extended Entity: DashboardSettings

**Location**: `frontend/src/types.ts`
**Storage**: localStorage key `argus:settings`

### Fields (additions only)

| Field | Type | Default | Validation | Description |
|-------|------|---------|------------|-------------|
| `restingThresholdMinutes` | `number` | `20` | 1-1440 integer | Minutes of inactivity before a session is classified as resting |

### Updated TypeScript definition

```typescript
export interface DashboardSettings {
  hideEndedSessions: boolean;
  hideReposWithNoActiveSessions: boolean;
  hideInactiveSessions: boolean;
  outputDisplayMode: OutputDisplayMode;
  restingThresholdMinutes: number;   // NEW
}

export const DEFAULT_SETTINGS: DashboardSettings = {
  hideEndedSessions: false,
  hideReposWithNoActiveSessions: false,
  hideInactiveSessions: false,
  outputDisplayMode: 'focused',
  restingThresholdMinutes: 20,       // NEW
};
```

### Migration / backward compatibility

When the stored JSON is loaded from localStorage, the spread `{ ...DEFAULT_SETTINGS, ...JSON.parse(stored) }` in `useSettings` already handles missing keys by falling back to `DEFAULT_SETTINGS`. No explicit migration needed: existing users without `restingThresholdMinutes` in their stored object will transparently get the default of 20.

## Updated Function: `isInactive`

**Location**: `frontend/src/utils/sessionUtils.ts`

### Signature change

```typescript
// Before
export function isInactive(session: Session): boolean

// After
export function isInactive(session: Session, thresholdMs?: number): boolean
```

`thresholdMs` defaults to `INACTIVE_THRESHOLD_MS` (20 min in ms). All existing callers remain valid without changes; callers with access to settings pass `settings.restingThresholdMinutes * 60_000`.

## State transitions

```
Session last active
        |
        v
  [Time elapsed] ---> < threshold --> NOT resting (active badge, full opacity)
                  \--> >= threshold --> RESTING (moon icon, reduced opacity)
```

Threshold change takes effect on the next render cycle (React re-render triggered by settings state update).
