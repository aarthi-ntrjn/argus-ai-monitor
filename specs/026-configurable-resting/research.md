# Research: Configurable Resting Duration

## Decision 1: Storage location for the threshold

**Decision**: Store `restingThresholdMinutes` in `DashboardSettings` (localStorage via `useSettings`).

**Rationale**: The threshold is a UI display preference, not a server-side operational setting. It belongs alongside the other dashboard display preferences (`hideEndedSessions`, `hideInactiveSessions`, etc.) in the existing `DashboardSettings` structure. The `ArgusConfig` type is for server-side config (port, retention, yoloMode) and is the wrong bucket for a client display preference.

**Alternatives considered**:
- `ArgusConfig` (server-side): Would require an API round-trip to read/write, add backend migration, and has no user-facing benefit. Rejected.
- Separate localStorage key: Would work but fragments the settings store unnecessarily. Rejected.

## Decision 2: How to thread the threshold into `isInactive`

**Decision**: Add an optional `thresholdMs?: number` parameter to `isInactive` (defaults to `INACTIVE_THRESHOLD_MS`). Callers that have access to settings pass it; callers that do not get the default. `SessionCard` and `SessionMetaRow` will call `useSettings()` directly to read the threshold.

**Rationale**: `isInactive` is called from 3 render contexts: `DashboardPage` (filter), `SessionCard` (opacity), `SessionMetaRow` (resting badge). All three need the configured value for a consistent UI. The options are:
1. Pass threshold as a prop down the component tree (prop drilling)
2. Use `useSettings()` in each component directly (hook colocation)
3. Create a dedicated React context for the threshold

Option 2 is the least invasive for this small feature. `useSettings` already reads from a synchronous localStorage cache so there is no performance concern with calling it in multiple places.

**Alternatives considered**:
- Prop drilling from `DashboardPage`: Would require changing `SessionCard` and `SessionMetaRow` interfaces. More invasive. Rejected.
- React context: Appropriate if more settings were being consumed this way, but overkill for a single numeric value. Rejected.

## Decision 3: `SettingsPanel` props interface change

**Decision**: Add `onUpdateThreshold?: (minutes: number) => void` as an optional prop alongside the existing `onToggle`. Default to no-op.

**Rationale**: `onToggle` is typed `(key: keyof DashboardSettings, value: boolean) => void` which cannot accept a numeric value. Rather than widening the type (which would need all existing call sites updated), a focused new callback keeps the change minimal and backward-compatible. The callback pattern matches how `onToggle` already works in `DashboardPage`.

**Alternatives considered**:
- Generalize `onToggle` to `(key: keyof DashboardSettings, value: DashboardSettings[keyof DashboardSettings]) => void`: Technically correct but breaks TypeScript inference at all call sites. Rejected.
- Have `SettingsPanel` call `useSettings` directly instead of using a callback: Would decouple it from DashboardPage's settings state, causing a stale state split. Rejected.

## Decision 4: Input validation approach

**Decision**: Local React state for the input value with inline error display. Save only on valid input (blur or explicit commit). Range: 1-1440 minutes.

**Rationale**: The threshold is a number input requiring validation before persistence. Using controlled local state allows immediate error feedback without persisting invalid values. The 1440 upper bound (24 hours) covers any realistic use case while preventing absurd values.
