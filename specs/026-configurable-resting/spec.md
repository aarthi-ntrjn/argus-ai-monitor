# Feature Specification: Configurable Resting Duration

**Feature Branch**: `026-configurable-resting`
**Created**: 2026-04-11
**Status**: Clarified
**Input**: User description: "make the resting duration configurable. i think it is currently 20min. default 20 min is fine."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Set Custom Resting Threshold (Priority: P1)

A user wants to control how long a session must be inactive before Argus considers it "resting". The default of 20 minutes suits most workflows, but users with long-running tasks (or very short feedback loops) want to tune this value without touching code.

**Why this priority**: This is the core ask. Without this, the feature does not exist. Delivers immediate value to any user whose sessions are incorrectly classified.

**Independent Test**: Can be fully tested by changing the threshold in Settings and verifying that a session last active N minutes ago flips between active and resting state based on the new threshold.

**Acceptance Scenarios**:

1. **Given** the user is on the Settings page, **When** they change the resting threshold from 20 to 5 minutes, **Then** the new value is saved and applied immediately to session state calculations.
2. **Given** the threshold is set to 5 minutes, **When** a session's last activity was 6 minutes ago, **Then** the session is shown as resting.
3. **Given** the threshold is set to 30 minutes, **When** a session's last activity was 25 minutes ago, **Then** the session is not shown as resting.
4. **Given** the user enters an invalid value (zero, negative, or non-numeric), **When** they try to save, **Then** an inline error is shown and the value is not saved.

---

### User Story 2 - Reset to Default (Priority: P2)

A user who has customized the resting threshold wants to restore it to the system default (20 minutes) without having to remember what the original value was.

**Why this priority**: Important quality-of-life companion to P1, but the feature is fully usable without it.

**Independent Test**: Can be tested by setting a custom value, clicking "Reset to default", and confirming the field returns to 20.

**Acceptance Scenarios**:

1. **Given** the threshold has been changed to a custom value, **When** the user clicks "Reset to default", **Then** the threshold is restored to 20 minutes and saved.
2. **Given** the threshold is already at the default (20 minutes), **When** the user opens Settings, **Then** the reset control is visible but the field shows 20.

---

### Edge Cases

- What happens when the user enters a decimal value (e.g., 2.5)? Round to nearest whole minute.
- What happens when the user enters a very large value (e.g., 9999 minutes)? Cap at a reasonable maximum (1440 minutes = 24 hours).
- What happens when the stored setting is corrupt or missing? Fall back to the 20-minute default silently.
- How does a change to the threshold affect already-displayed sessions? Recalculate immediately on the next render cycle.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a user-configurable setting for the resting duration threshold.
- **FR-002**: The default value for the resting threshold MUST be 20 minutes.
- **FR-003**: The accepted range for the threshold MUST be 1 to 60 minutes (inclusive).
- **FR-004**: The system MUST persist the configured threshold so it survives page reloads and app restarts.
- **FR-005**: The system MUST apply the configured threshold immediately after saving, without requiring a page reload.
- **FR-006**: The system MUST reject invalid inputs (zero, negative numbers, non-numeric values, values outside the allowed range) and display a descriptive inline error message.
- **FR-007**: The system MUST provide a "Reset to default" action that restores the threshold to 20 minutes.

### Key Entities

- **Resting Threshold Setting**: A positive integer (minutes) stored in user preferences. Governs the `isInactive` / resting classification for all sessions.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can change the resting threshold in under 30 seconds from opening Settings.
- **SC-002**: Session resting state reflects the updated threshold within 1 second of saving, with no page reload required.
- **SC-003**: Invalid inputs are rejected immediately with a clear, inline error message before any save attempt reaches persistent storage.
- **SC-004**: The default value (20 minutes) is preserved after a reset action regardless of any previously stored value.

## Clarifications

### Session 2026-04-11

- **UI location**: The resting threshold control is added to the existing `SettingsPanel` settings menu (the gear/settings dropdown on the dashboard), not a new page or modal. It appears inline near the "Hide inactive sessions" checkbox, which currently hardcodes 20 minutes. The label for that checkbox will dynamically reflect the configured threshold.

## Assumptions

- The resting threshold is a per-device (browser) preference, not a server-side per-user setting. It is stored in localStorage alongside other Argus UI settings.
- The existing `useSettings` hook and localStorage-based settings infrastructure will be extended rather than replaced.
- The existing `INACTIVE_THRESHOLD_MS` constant in `sessionUtils.ts` will be replaced by reading from the settings store, keeping backward compatibility via the 20-minute default.
- Minutes are the appropriate unit of granularity; sub-minute precision is not required.
- The setting applies globally to all sessions (not per-repository or per-session).
