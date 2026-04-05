# Contract: Onboarding Event Hook Points

**Version**: 1.0.0 | **Date**: 2026-04-04  
**Module**: `frontend/src/services/onboardingEvents.ts`  
**Stability**: Stable (v1) — wired to analytics in a future feature

## Overview

All significant onboarding interactions emit named events through a central hook-point registry. In v1, these hooks are no-ops (stubs). A future analytics feature will replace the no-op implementations with real tracking calls without changing any call site.

---

## Event Definitions

### `tour:started`
Emitted when the Dashboard guided tour begins (either auto-launch or via "Restart Tour").

```typescript
onTourStarted(trigger: 'auto' | 'manual'): void
```

| Field | Type | Description |
|-------|------|-------------|
| `trigger` | `'auto' \| 'manual'` | `'auto'` for first-time auto-launch; `'manual'` for user-initiated replay |

---

### `tour:completed`
Emitted when the user advances through all tour steps and acknowledges the final step.

```typescript
onTourCompleted(): void
```

---

### `tour:skipped`
Emitted when the user clicks Skip at any step, or when the tour silently dismisses due to navigation away from the Dashboard.

```typescript
onTourSkipped(atStep: number, reason: 'user_action' | 'navigation'): void
```

| Field | Type | Description |
|-------|------|-------------|
| `atStep` | `number` | Zero-based step index at which the tour was skipped |
| `reason` | `'user_action' \| 'navigation'` | Whether user explicitly skipped or triggered by navigation |

---

### `step:advanced`
Emitted each time the user advances to the next step.

```typescript
onStepAdvanced(fromStep: number, toStep: number): void
```

| Field | Type | Description |
|-------|------|-------------|
| `fromStep` | `number` | Zero-based index of the step being left |
| `toStep` | `number` | Zero-based index of the step being entered |

---

### `hint:viewed`
Emitted when a contextual hint tooltip becomes visible (badge hovered or focused).

```typescript
onHintViewed(hintId: string): void
```

| Field | Type | Description |
|-------|------|-------------|
| `hintId` | `string` | The hint ID as defined in `sessionHints` configuration (e.g. `'session-status'`) |

---

### `hint:dismissed`
Emitted when a contextual hint is dismissed by the user.

```typescript
onHintDismissed(hintId: string): void
```

| Field | Type | Description |
|-------|------|-------------|
| `hintId` | `string` | The hint ID being dismissed |

---

## v1 Implementation (stubs)

In v1, all functions are no-ops:

```typescript
// frontend/src/services/onboardingEvents.ts

export const onTourStarted = (_trigger: 'auto' | 'manual'): void => {};
export const onTourCompleted = (): void => {};
export const onTourSkipped = (_atStep: number, _reason: 'user_action' | 'navigation'): void => {};
export const onStepAdvanced = (_fromStep: number, _toStep: number): void => {};
export const onHintViewed = (_hintId: string): void => {};
export const onHintDismissed = (_hintId: string): void => {};
```

## Future Wiring (v2)

When the analytics feature is implemented, each stub is replaced with an analytics call. No call site changes are required:

```typescript
export const onTourCompleted = (): void => {
  analytics.track('onboarding_tour_completed');
};
```
