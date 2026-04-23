# Feature Specification: Telemetry Location Enrichment

**Feature Branch**: `057-telemetry-location`
**Created**: 2026-04-22
**Status**: Draft
**Input**: User description: "get location information from telemetry"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Geographic Distribution of Argus Users (Priority: P1)

As an Argus maintainer, I want to see which countries (and optionally regions) Argus is actively used in, so I can understand the geographic spread of adoption and make informed decisions about documentation, localization, and outreach.

Currently, all telemetry events are sent with location data explicitly suppressed. This story enables country-level (and optionally region-level) geographic enrichment on each event so the analytics dashboard reflects where installations are located.

**Why this priority**: This is the core ask. Without it, no geographic insight is possible. All other stories depend on this being in place first.

**Independent Test**: Enable telemetry, trigger an `app_started` event, then verify the analytics dashboard shows a country attribution for that event. The feature delivers value on its own — geographic distribution is immediately visible.

**Acceptance Scenarios**:

1. **Given** telemetry is enabled and an event is sent, **When** the event is processed by the analytics backend, **Then** it is enriched with at least a country-level location derived from the sending machine's IP address.
2. **Given** telemetry is disabled by the user, **When** an event would have been sent, **Then** no event (and therefore no location data) is transmitted.
3. **Given** geolocation enrichment fails (e.g., IP cannot be resolved to a location), **When** the event is processed, **Then** the event is still recorded without location data rather than being dropped.

---

### User Story 2 - Accurate Privacy Disclosure Reflects Location Collection (Priority: P1)

As an Argus user who has opted into telemetry, I want the privacy disclosure to accurately describe that approximate location (derived from IP address) is now included in telemetry, so I can make an informed consent decision.

Currently the Telemetry & Privacy page and the consent banner explicitly state that "IP address or hostname" is never collected. Enabling GeoIP enrichment changes this and the disclosure must be updated before or at the same time as the enrichment is enabled.

**Why this priority**: The existing disclosure is a promise to users. Collecting location data without updating the disclosure would be a violation of that promise. This must ship together with Story 1.

**Independent Test**: Navigate to the Telemetry & Privacy page and verify it describes approximate location as an item that is collected, and the "never collected" section no longer lists IP address.

**Acceptance Scenarios**:

1. **Given** a user views the Telemetry & Privacy page, **When** location enrichment is active, **Then** the page lists approximate location (country and region/state) as a collected data item, with a plain-language explanation of how it is derived.
2. **Given** a user reads the "What is never collected" section, **When** location enrichment is active, **Then** "IP address" is removed from that list (since IP is now transiently used for geolocation, even if not stored directly).
3. **Given** the telemetry consent banner is visible, **When** it references what is collected, **Then** its summary text is updated to reflect that approximate location is included.

---

### User Story 3 - Granular Location Opt-Out (Priority: P3)

As an Argus user who is comfortable sharing anonymous usage events but not comfortable sharing even approximate location, I want to be able to opt out of location enrichment specifically without disabling all telemetry.

**Why this priority**: Most users will not need this. A single "disable all telemetry" toggle already exists. This is a nice-to-have for privacy-conscious users in sensitive environments.

**Independent Test**: Enable telemetry, then enable the location opt-out setting. Trigger an event and verify in the analytics dashboard that the event has no country attribution, while other telemetry events (counts, session types, etc.) continue to appear.

**Acceptance Scenarios**:

1. **Given** a user enables the location opt-out setting, **When** a telemetry event is sent, **Then** the event is transmitted with location enrichment suppressed (no country or region data).
2. **Given** a user disables the location opt-out setting, **When** a telemetry event is sent, **Then** the event includes location enrichment again.
3. **Given** a user disables all telemetry, **When** events would be sent, **Then** neither usage data nor location data is transmitted (existing behavior preserved).

---

### Edge Cases

- What happens when the Argus server is running behind a proxy or VPN? The location reflected in telemetry will be that of the proxy/VPN exit node, not the user's actual location. This is acceptable and should be noted in the privacy disclosure.
- What happens when the analytics provider cannot determine a location from the IP? The event is recorded without location enrichment; no fallback or error is raised.
- What happens for users who installed Argus before this change and already dismissed the telemetry banner? The existing opt-in/opt-out setting is preserved. The updated disclosure is visible on the Telemetry & Privacy page. No re-prompting is required unless a separate re-consent mechanism is explicitly added (out of scope for this feature).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST include country-level location enrichment in each telemetry event when telemetry is enabled, derived from the IP address of the machine sending the event.
- **FR-002**: System MUST include location data at the granularity of country and region/state (e.g., "United States / California").
- **FR-003**: System MUST update the Telemetry & Privacy page to accurately describe approximate location as a collected data item, including how it is derived (IP-based geolocation).
- **FR-004**: System MUST remove "IP address" from the "What is never collected" list on the Telemetry & Privacy page, since IP is now transiently used for geolocation lookup.
- **FR-005**: System MUST update the telemetry consent banner and any summary text that describes what is collected to reflect location enrichment.
- **FR-006**: When telemetry is disabled, System MUST NOT transmit any location data (existing opt-out behavior is preserved).
- **FR-007**: System SHOULD allow users to suppress location enrichment specifically (opt out of location only) without disabling all telemetry.
- **FR-008**: System MUST handle cases where geolocation enrichment is unavailable gracefully: the event is still sent without location data; no error is surfaced to the user.

### Key Entities

- **TelemetryEvent**: An analytics event sent on user actions (e.g., `app_started`, `session_started`). Currently contains installation ID, app version, timestamp, and session metadata. Will gain an optional location property containing country (and optionally region/city).
- **LocationData**: Approximate geographic location derived from the sending machine's IP address. Contains at minimum a country code/name. May contain region and city depending on configured granularity.
- **TelemetrySettings**: The user-configurable settings for telemetry. Currently a single boolean (enabled/disabled). Will gain an optional `locationEnabled` flag for granular opt-out (P3).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of telemetry events sent while location enrichment is active carry a country attribution visible in the analytics dashboard.
- **SC-002**: 0 telemetry events carry location data when the user has disabled telemetry.
- **SC-003**: The Telemetry & Privacy page accurately reflects the updated data collection policy within the same release that enables location enrichment (no lag between policy and behavior).
- **SC-004**: Enabling or disabling location enrichment takes effect immediately on the next event, with no restart required.
- **SC-005**: Location enrichment failure (e.g., unresolvable IP) does not cause any event to be dropped or any error to be surfaced to the user.

## Assumptions

- Location is derived from the IP address of the Argus server process at the time it sends the event, not from the browser or any user-input locale. For most users this is the same machine, but users behind proxies or VPNs will see their proxy's location.
- The analytics provider (PostHog) already supports IP-based GeoIP enrichment natively; no third-party geolocation service integration is required beyond removing the existing suppression flags.
- No re-consent prompt or re-display of the telemetry banner to existing opt-in users is required. The updated Telemetry & Privacy page serves as the updated disclosure.
- Location opt-out (FR-007) is a P3 nice-to-have. If not implemented in the initial release, the feature is still considered complete.
- Argus is a self-hosted developer tool. All telemetry is anonymous and voluntary. There is no legal obligation to re-obtain consent from existing users, but the disclosure must be updated before the change ships.
