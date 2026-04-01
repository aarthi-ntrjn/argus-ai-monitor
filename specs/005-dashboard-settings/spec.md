# Feature Specification: Dashboard Settings

**Feature Branch**: `005-dashboard-settings`
**Created**: 2026-04-01
**Status**: Draft
**Input**: User description: "add settings to the dashboard and the first setting is to hide or show ended session. Default is to show it."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Toggle Visibility of Ended Sessions (Priority: P1)

A user monitoring multiple repositories can see many sessions in the dashboard. Some of those sessions have ended (completed or timed out). The user wants to reduce visual clutter and hide ended sessions so they can focus only on active ones. A settings panel on the dashboard provides a "Show ended sessions" toggle, which is on by default. Turning it off hides all ended sessions from the list.

**Why this priority**: This is the core deliverable of the feature. Without it, nothing else in this feature has value.

**Independent Test**: Open the dashboard, toggle "Show ended sessions" off, verify ended sessions disappear. Toggle back on, verify they reappear.

**Acceptance Scenarios**:

1. **Given** the dashboard has both active and ended sessions, **When** the user opens the dashboard for the first time, **Then** all sessions (active and ended) are visible by default.
2. **Given** "Show ended sessions" is on, **When** the user toggles it off, **Then** all ended sessions are hidden and only active sessions remain visible.
3. **Given** "Show ended sessions" is off, **When** the user toggles it on, **Then** all ended sessions reappear in the list.
4. **Given** "Show ended sessions" is off and there are no active sessions, **When** the user views the dashboard, **Then** an empty-state message is shown (not a blank page).

---

### User Story 2 - Settings Preference Persists Across Sessions (Priority: P2)

After a user sets their preference to hide ended sessions, they close the browser and reopen the dashboard. Their preference should be remembered  they should not need to re-toggle the setting each time they visit.

**Why this priority**: Without persistence, the setting resets on every page load, making it effectively useless. However, it does not block the core toggle from working.

**Independent Test**: Toggle "Show ended sessions" off, reload the page, verify ended sessions are still hidden.

**Acceptance Scenarios**:

1. **Given** the user has toggled "Show ended sessions" off, **When** the user reloads or reopens the dashboard, **Then** the toggle is still off and ended sessions remain hidden.
2. **Given** the user has never changed the setting, **When** the user opens the dashboard, **Then** the default (show ended sessions = on) is applied.

---

### User Story 3 - Settings Panel is Discoverable and Accessible (Priority: P3)

The settings are accessible via a clearly labelled settings icon or button on the dashboard. The settings panel groups all preferences in one place, making it easy to find and extend with future settings.

**Why this priority**: Important for usability and extensibility, but doesn't block the core toggle behaviour.

**Independent Test**: Locate and open the settings panel from the dashboard header/toolbar without any instructions.

**Acceptance Scenarios**:

1. **Given** the dashboard is loaded, **When** the user looks at the dashboard header/toolbar, **Then** a settings control (icon or button) is visible.
2. **Given** the user clicks the settings control, **When** the settings panel opens, **Then** the "Show ended sessions" toggle is visible with its current state clearly indicated (on/off).

---

### Edge Cases

- What happens when all sessions are ended and "Show ended sessions" is off?  Show an empty-state message, not a blank or broken UI.
- What happens if the persisted preference is corrupted or unreadable?  Fall back to the default (show ended sessions = on).
- What happens if a session transitions from active to ended while the filter is off? → The session disappears from the list immediately (or on next refresh).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The dashboard MUST include a settings panel accessible from a visible control in the dashboard header or toolbar.
- **FR-002**: The settings panel MUST contain a "Show ended sessions" toggle.
- **FR-003**: The "Show ended sessions" toggle MUST default to on (ended sessions are shown).
- **FR-004**: When "Show ended sessions" is off, the dashboard MUST hide all sessions with an ended status from the session list.
- **FR-005**: When "Show ended sessions" is on, the dashboard MUST display all sessions regardless of status.
- **FR-006**: The user's "Show ended sessions" preference MUST be persisted locally and restored on subsequent visits without requiring any action from the user.
- **FR-007**: When "Show ended sessions" is off and no active sessions exist, the dashboard MUST display a clear empty-state message.
- **FR-008**: If the persisted preference cannot be read, the system MUST fall back to the default (show ended sessions = on).
- **FR-009**: The settings panel MUST be designed to accommodate additional settings in the future (extensible structure).

### Key Entities

- **Setting**: A named user preference with a value, persisted locally. Initial setting: `showEndedSessions` (boolean, default: `true`).
- **Session**: An individual Copilot CLI or Claude Code session tracked by Argus. Has a status that is either active or ended.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can locate and toggle the "Show ended sessions" setting in under 10 seconds without any instructions.
- **SC-002**: Toggling the setting takes effect on the displayed session list instantly (no page reload required).
- **SC-003**: The user's preference is correctly restored on 100% of subsequent page loads.
- **SC-004**: The settings panel can accommodate at least 5 additional settings without redesign.

## Assumptions

- "Ended session" means any session whose status indicates it is no longer active (e.g., completed, timed out, errored). The exact status values come from existing session data.
- Settings are stored per-browser (client-side persistence). No backend storage or user account is required.
- The dashboard currently shows all sessions with no filtering; this feature adds opt-in filtering.
- Only one settings panel exists on the dashboard; it is not per-repository.
- Mobile layout is out of scope for v1; the settings control is designed for desktop/tablet use.
- VI security exception applies: this is a single-user localhost tool; no authentication is required for settings storage.
