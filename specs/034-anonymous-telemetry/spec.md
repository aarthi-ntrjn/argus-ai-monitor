# Feature Specification: Anonymous Usage Telemetry

**Feature Branch**: `034-anonymous-telemetry`
**Created**: 2026-04-13
**Status**: Draft
**Input**: User description: "i want some usage telemetry without need users to login. it should be lightweight. suggest a proposal."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Passive Usage Reporting (Priority: P1)

Argus silently records which features users engage with, how frequently sessions are started, and what session types are used. No user action is required. The product owner sees aggregate trends (e.g., "most users launch 3+ Claude sessions per day") without any individual being identifiable.

**Why this priority**: This is the core value of telemetry. Without it, there is no data at all.

**Independent Test**: Run Argus, start a session, and verify a telemetry event is recorded with no PII. Delivers the minimum viable insight pipeline.

**Acceptance Scenarios**:

1. **Given** Argus is installed and telemetry is enabled, **When** a user starts any AI session, **Then** an anonymous event is recorded with session type, timestamp, and app version but no personally identifiable information.
2. **Given** Argus is running, **When** the user interacts with a key feature (send prompt, stop session, open compare view), **Then** an event is recorded for that interaction.
3. **Given** Argus has never been run before, **When** it starts for the first time, **Then** a stable anonymous installation ID is generated and persisted locally for future event correlation.

---

### User Story 2 - Opt-Out Control (Priority: P1)

A user who does not want any data sent can disable telemetry via a settings toggle. Once disabled, no events are sent for the remainder of that session or any future session until re-enabled.

**Why this priority**: Opt-out is a baseline privacy expectation. Shipping telemetry without user control risks trust damage.

**Independent Test**: Toggle telemetry off in settings, perform actions, and verify no events are dispatched.

**Acceptance Scenarios**:

1. **Given** the user has disabled telemetry, **When** they start a session or trigger a feature, **Then** no telemetry events are sent.
2. **Given** telemetry is disabled and the user re-enables it, **When** they start a new session, **Then** events resume from that point forward.
3. **Given** Argus is freshly installed, **When** first launched, **Then** a non-blocking banner appears in the main UI with a toggle pre-set to enabled, and the user's choice is saved before any events are sent.
4. **Given** the user wants to change their telemetry preference after dismissing the banner, **When** they navigate to Settings, **Then** a toggle reflecting the current preference is available and functional.

---

### User Story 3 - Resilience to Backend Unavailability (Priority: P2)

If the telemetry endpoint is unreachable (network offline, server down), Argus continues working normally. No errors are surfaced to the user and no session monitoring functionality is degraded.

**Why this priority**: Telemetry must never interfere with the core product.

**Independent Test**: Block the telemetry endpoint and verify Argus operates without any visible errors or slowdowns.

**Acceptance Scenarios**:

1. **Given** the telemetry endpoint is unreachable, **When** an event would normally be sent, **Then** the event is silently dropped and Argus continues without error.
2. **Given** a telemetry send times out, **When** the timeout occurs, **Then** it does not block any UI interaction or session operation.

---

### Edge Cases

- What happens when the local installation ID file is deleted or corrupted? (A new ID is generated silently.)
- What happens if telemetry events accumulate faster than they can be sent? (Events are dropped rather than buffered indefinitely to avoid memory growth.)
- What if the telemetry endpoint returns an error response? (Silently ignored, no retry.)
- What if the same Argus installation is used by multiple OS user accounts? (Each OS user gets their own anonymous ID.)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST generate a persistent anonymous installation ID on first launch and store it locally per OS user.
- **FR-002**: System MUST NOT collect any personally identifiable information (name, email, IP address, file paths, prompt content, or session IDs visible to users).
- **FR-003**: The backend MUST record the following event types: app started, session started (with session type), session ended, prompt sent, session stopped by user, compare view opened.
- **FR-004**: Each event MUST include only: anonymous installation ID, event type, app version, and UTC timestamp. No other fields.
- **FR-005**: Telemetry sends MUST be fire-and-forget (non-blocking, no retry loop) with a hard timeout of 2 seconds per send attempt.
- **FR-006**: System MUST provide a toggle in the settings UI to enable or disable telemetry.
- **FR-007**: When telemetry is disabled, system MUST send zero events until re-enabled.
- **FR-008**: Telemetry preference MUST persist across restarts.
- **FR-009**: System MUST NOT surface any error or warning to the user when a telemetry send fails.
- **FR-010**: Events MUST be sent via HTTP POST with a JSON body to an external endpoint hosted by the Argus maintainer. The endpoint URL MUST be set at build time via a build-time constant and require no code change to update.
- **FR-011**: On first launch, system MUST display a non-blocking dismissable banner in the main UI informing the user that anonymous telemetry will be collected, with a toggle defaulting to enabled. The user's choice MUST be saved before any events are sent. No formal GDPR/CCPA consent machinery is required; plain-language notice is sufficient.
- **FR-012**: A telemetry enable/disable toggle MUST be permanently accessible in the Settings panel, reflecting the current preference at all times.

### Key Entities

- **Installation ID**: A randomly generated UUID created once per OS user profile, stored in a local config file. Never transmitted alongside any user-identifying data.
- **Telemetry Event**: A minimal record containing installation ID, event type, app version, and UTC timestamp.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Telemetry events are dispatched within 500ms of the triggering action and do not delay any UI response.
- **SC-002**: Zero personally identifiable fields appear in any transmitted event payload, verified by payload inspection.
- **SC-003**: Disabling telemetry results in zero events sent, verifiable by intercepting outbound requests during a test session.
- **SC-004**: Argus startup time increases by no more than 50ms when telemetry is enabled compared to when it is disabled.
- **SC-005**: The telemetry system adds no more than 5KB to the installed application size.

## Clarifications

### Session 2026-04-13

- Q: Does this feature need to be GDPR/CCPA compliant? → A: No formal compliance required for v1. Best-effort privacy notice only (plain language, no consent receipts, no data deletion API).
- Q: Where do telemetry events get sent? → A: External HTTP endpoint hosted by the maintainer. URL baked in at build time via a build-time constant.
- Q: Which process sends telemetry events? → A: Backend only. The Node.js backend dispatches all events, including UI interactions relayed through existing session/action data.
- Q: What is the hard timeout for a telemetry send? → A: 2 seconds per event send attempt.
- Q: Where does the first-launch telemetry prompt appear? → A: Non-blocking banner in the main UI on first load (dismissable), plus a persistent toggle in Settings for future changes.

## Assumptions

- Telemetry events are sent via HTTP POST (JSON body) from the Node.js backend to an external endpoint operated by the Argus maintainer; no third-party analytics SDK is required. The frontend does not make outbound telemetry calls.
- Events do not need to be queued or retried; a best-effort single send per event is acceptable.
- No dashboard UI for viewing telemetry data is in scope for this feature (analysis happens externally).
- The anonymous ID is a plain UUID; no additional hashing or salting is needed given no PII is collected.
- Telemetry covers the Argus desktop backend and frontend only; the argus-launch CLI wrapper is out of scope for event instrumentation in v1.
