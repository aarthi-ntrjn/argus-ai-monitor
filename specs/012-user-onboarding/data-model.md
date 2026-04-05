# Data Model: User Onboarding Journey

**Branch**: `012-user-onboarding` | **Date**: 2026-04-04

## Entities

---

### OnboardingState

The root entity persisted to localStorage under the key `argus:onboarding`. Represents the complete onboarding state for a browser installation (v1) or user account (v2+).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `schemaVersion` | `number` | ✅ | Schema version for forward-compatible migration. Always `1` in v1. |
| `userId` | `string \| null` | ✅ | Reserved for future per-account migration. Always `null` in v1. |
| `dashboardTour` | `DashboardTourState` | ✅ | State of the Dashboard guided tour. |
| `sessionHints` | `SessionHintsState` | ✅ | State of dismissed contextual hints on session pages. |

**Validation rules**:
- `schemaVersion` MUST be a positive integer. Unknown versions trigger a graceful reset rather than corrupt reads.
- When reading state, if `schemaVersion > CURRENT_SCHEMA_VERSION`, treat as unrecognised and initialise a fresh default state.

---

### DashboardTourState

Tracks the lifecycle of the Dashboard guided tour.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `status` | `"not_started" \| "completed" \| "skipped"` | ✅ | Current state of the tour. |
| `completedAt` | `string \| null` | ✅ | ISO 8601 timestamp of tour completion. `null` if not completed. |
| `skippedAt` | `string \| null` | ✅ | ISO 8601 timestamp of tour skip. `null` if not skipped. |

**State transitions**:

```
not_started → [user opens Dashboard for first time]
    ↓
  (tour auto-launches)
    ↓
  in-progress (transient, not persisted — only persisted states are above)
    ↓
  completed  ← user advances through all steps
  skipped    ← user clicks Skip at any step, or navigates away
  not_started ← user triggers "Reset Onboarding" action (resets to default)
```

**Business rules**:
- Tour auto-launches only when `status === "not_started"`.
- "Restart Tour" replays the tour in-session but does NOT change `status` until the replay completes or is skipped.
- "Reset Onboarding" sets `status` back to `"not_started"` and clears all timestamps.

---

### SessionHintsState

Tracks which contextual hint badges the user has dismissed on session detail pages.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `dismissed` | `string[]` | ✅ | Array of hint IDs that have been dismissed. Dismissal is global (not per-session). |

**Hint IDs (v1)**:

| ID | Target Element | Description |
|----|---------------|-------------|
| `session-status` | Status badge (active/idle/etc.) | Explains session status indicators |
| `session-prompt-bar` | SessionPromptBar component | Explains the remote control / prompt input |
| `session-output-stream` | Output Stream panel | Explains what the output stream shows |

**Business rules**:
- A hint is shown if its ID is NOT in the `dismissed` array.
- Dismissal is permanent within the current schema version (not time-limited).
- "Reset Onboarding" clears the `dismissed` array, making all hints visible again.

---

### TourStep (configuration, not persisted)

Defines a single step in the Dashboard guided tour. Not stored in localStorage — defined in source code as static configuration.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `target` | `string` | ✅ | CSS selector for the highlighted element. Uses `data-tour-id` attribute format: `[data-tour-id="..."]`. |
| `title` | `string` | ✅ | Short heading displayed in the tooltip. Max 60 characters. |
| `content` | `string \| ReactNode` | ✅ | Body text explaining the element. Max 200 characters for conciseness. |
| `placement` | `"top" \| "bottom" \| "left" \| "right" \| "auto"` | ✅ | Tooltip anchor position. |
| `disableBeacon` | `boolean` | ❌ | If `true`, skip the beacon animation on this step. Default: `false`. |

**Dashboard Tour Steps (v1)**:

| # | `data-tour-id` | Title | Placement |
|---|---------------|-------|-----------|
| 1 | `dashboard-header` | Welcome to Argus | `bottom` |
| 2 | `dashboard-add-repo` | Add a Repository | `bottom` |
| 3 | `dashboard-repo-card` | Your Repositories | `right` |
| 4 | `dashboard-session-card` | AI Sessions | `right` |
| 5 | `dashboard-settings` | Customise Your View | `bottom` |
| 6 | (no target — centered modal) | You're all set! | `center` |

---

### ContextualHint (configuration, not persisted)

Defines a single contextual hint badge. Not stored in localStorage — defined in source code as static configuration.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | ✅ | Unique hint ID. Must match an entry in `SessionHintsState.dismissed` format. |
| `label` | `string` | ✅ | Tooltip content shown when badge is hovered/focused. |
| `ariaLabel` | `string` | ✅ | Screen-reader label for the badge button. |
| `placement` | `"top" \| "bottom" \| "left" \| "right"` | ✅ | Tooltip position relative to badge. |

---

## Default State

The following is the initial state written to localStorage for a brand-new user:

```json
{
  "schemaVersion": 1,
  "userId": null,
  "dashboardTour": {
    "status": "not_started",
    "completedAt": null,
    "skippedAt": null
  },
  "sessionHints": {
    "dismissed": []
  }
}
```

---

## Storage Key

| Key | Value |
|-----|-------|
| `argus:onboarding` | Serialised `OnboardingState` JSON blob |

The `argus:` namespace prefix is consistent with the existing convention in the codebase (`argus:skipRemoveConfirm`).
