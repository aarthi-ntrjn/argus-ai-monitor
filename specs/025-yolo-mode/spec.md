# Feature Specification: Yolo Mode Launch Setting

**Feature Branch**: `025-yolo-mode`
**Created**: 2026-04-11
**Status**: Draft
**Input**: User description: "add the ability to launch Claude code and copilot in yolo mode. This should be a setting and when user turns on this setting showing a warning dialog. If this setting is on then all launch with Argus should have --allow-all for copilot and --dangerously-skip-permissions for claude code."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Enable Yolo Mode with Warning (Priority: P1)

A developer wants to launch sessions with all permission checks disabled so they can work without interruption. They navigate to the Argus settings panel and toggle on "Yolo Mode". A warning dialog appears explaining the risks. They confirm, and the setting is saved. From that point forward, every Claude Code session launched by Argus includes `--dangerously-skip-permissions` and every Copilot session includes `--allow-all`.

**Why this priority**: This is the core feature. Without the setting and warning, nothing else functions.

**Independent Test**: Can be tested by enabling yolo mode, confirming the dialog, then verifying the generated launch command contains the correct flags for both Claude Code and Copilot.

**Acceptance Scenarios**:

1. **Given** yolo mode is off, **When** the user toggles on yolo mode in the settings panel, **Then** a warning dialog is shown explaining that all permission checks will be bypassed.
2. **Given** the warning dialog is shown, **When** the user confirms, **Then** yolo mode is saved as enabled.
3. **Given** the warning dialog is shown, **When** the user cancels, **Then** yolo mode remains off and the toggle reverts.
4. **Given** yolo mode is on, **When** the user copies or triggers a Claude Code launch command, **Then** `--dangerously-skip-permissions` is appended to the command.
5. **Given** yolo mode is on, **When** the user copies or triggers a Copilot launch command, **Then** `--allow-all` is appended to the command.
6. **Given** yolo mode is on, **When** the Argus backend launches a session via PTY, **Then** the spawned process receives the appropriate yolo flag for its session type.

---

### User Story 2 - Disable Yolo Mode (Priority: P2)

A developer who previously enabled yolo mode wants to return to safe defaults. They toggle off "Yolo Mode" in settings. No warning is needed for disabling. The setting is saved and subsequent launches no longer include yolo flags.

**Why this priority**: Reversibility is required by the constitution. Users must be able to opt back out cleanly.

**Independent Test**: Can be tested by enabling yolo mode, then disabling it, and verifying that the generated launch commands no longer include the yolo flags.

**Acceptance Scenarios**:

1. **Given** yolo mode is on, **When** the user toggles it off, **Then** no warning dialog is shown.
2. **Given** yolo mode is off, **When** the user copies or triggers a Claude Code launch command, **Then** `--dangerously-skip-permissions` is NOT present.
3. **Given** yolo mode is off, **When** the user copies or triggers a Copilot launch command, **Then** `--allow-all` is NOT present.

---

### User Story 3 - Yolo Mode Status Visibility (Priority: P3)

A developer wants to know at a glance whether yolo mode is active. The settings panel clearly indicates the current state of yolo mode, and the yolo mode toggle shows a visible risk label when on.

**Why this priority**: Awareness of risky settings is good UX but not required for the feature to be usable.

**Independent Test**: Can be tested independently by checking the settings panel UI renders the correct state label.

**Acceptance Scenarios**:

1. **Given** yolo mode is on, **When** the user opens the settings panel, **Then** the yolo mode toggle is in the on state with a visible warning label.
2. **Given** yolo mode is off, **When** the user opens the settings panel, **Then** the yolo mode toggle is in the off state with no warning label.

---

### Edge Cases

- What happens if the user enables yolo mode while a session is already running? No effect on running sessions; only new launches are affected.
- What if the backend config file is corrupt or unreadable? Treat yolo mode as off; do not fail launch.
- What if a future Claude Code version changes the flag name? The flag is a named constant so only one place needs updating.
- What if both the yolo flag and a user-provided identical flag are present? Duplicate flags are benign for both CLIs; no deduplication needed.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST add a `yoloMode` boolean field to `ArgusConfig` with a default of `false`.
- **FR-002**: System MUST expose `yoloMode` via `GET /api/v1/settings` and allow it to be toggled via `PATCH /api/v1/settings`.
- **FR-003**: Frontend MUST show a confirmation warning dialog when the user attempts to enable yolo mode.
- **FR-004**: Frontend MUST revert the toggle to off if the user cancels the warning dialog.
- **FR-005**: When `yoloMode` is `true`, the backend MUST append `--dangerously-skip-permissions` to every Claude Code launch command.
- **FR-006**: When `yoloMode` is `true`, the backend MUST append `--allow-all` to every Copilot launch command.
- **FR-007**: When `yoloMode` is `false`, no yolo flags MUST be added to any launch command.
- **FR-008**: The warning dialog MUST clearly state that all permission checks and safety prompts will be bypassed.
- **FR-009**: The settings panel MUST display the current yolo mode state and a risk label when it is on.
- **FR-010**: Disabling yolo mode MUST NOT require a confirmation dialog.
- **FR-011**: The `yoloMode` setting MUST persist across page reloads and server restarts (stored in backend config, not localStorage).

### Key Entities

- **ArgusConfig**: Server-side configuration stored in `~/.argus/config.json`. Gains `yoloMode: boolean` field.
- **YoloWarningDialog**: Frontend modal component shown once when enabling yolo mode.
- **LaunchCommand**: The resolved command struct in `launch-command-resolver.ts` that determines which flags are injected.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Enabling yolo mode results in `--dangerously-skip-permissions` appearing in the Claude Code launch command within one UI interaction.
- **SC-002**: Enabling yolo mode results in `--allow-all` appearing in the Copilot launch command within one UI interaction.
- **SC-003**: The warning dialog appears exactly once per enable action and does not appear when disabling.
- **SC-004**: Cancelling the warning dialog leaves yolo mode off (toggle reverted, backend setting unchanged).
- **SC-005**: The yolo mode setting persists across page reloads and server restarts.
- **SC-006**: All existing launch tests continue to pass when yolo mode is off (no regression).

## Assumptions

- The correct flag for Claude Code yolo mode is `--dangerously-skip-permissions` (verified in existing codebase tests).
- The correct flag for GitHub Copilot yolo mode is `--allow-all`.
- Yolo mode applies globally to all launches from this Argus instance; per-session override is out of scope for v1.
- No changes are needed to session detection or reconnection logic; yolo flags only affect the spawned command.
- The warning dialog is a frontend concern only; the backend applies the flags regardless of whether the warning was acknowledged.
- This is a single-user localhost tool (§VI exception applies; no auth/authz changes needed).
- Concurrent session count target: same as existing sessions (§VIII exception applies).
