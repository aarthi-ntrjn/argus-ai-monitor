# Feature Specification: Telemetry Location Enrichment

**Feature Branch**: `057-telemetry-location`
**Created**: 2026-04-22
**Status**: Implemented
**Input**: User description: "get location information from telemetry"

## Clarifications

### Session 2026-04-24

- Q: What is the PostHog IP suppression/enrichment mechanism, and how should location enrichment be implemented? → A: PostHog's ingestion pipeline natively performs GeoIP enrichment using the connection IP of the HTTP request. Argus does not need to detect or transmit an IP address at all. Instead, the PostHog project is configured to **"Capture no IP"** (Settings → Project → General → IP data capture configuration), which causes PostHog to perform GeoIP enrichment transiently (country, region) and then discard the raw IP rather than storing it in event records. No client-side IP detection or masking is needed. *(Note: an earlier draft of this clarification described a subnet-masking approach using `lan-network` and setting `$ip` on each event. That approach was superseded during implementation in favour of the simpler PostHog-native solution.)*
- Q: What is the required granularity for location data — is region always included or best-effort? → A: Country is always present; region is included when PostHog's GeoIP can resolve it (best-effort, no separate configuration).
- Q: Where should the location-specific opt-out UI live, and should it be implemented? → A: Descoped entirely. The main telemetry on/off toggle is the only control needed. No granular location opt-out will be implemented.
- Q: Is any GDPR or compliance handling needed for EU installations? → A: No. Telemetry is opt-out (enabled by default). The product currently has no users, so there is no re-consent burden and no existing user data to protect.
- Q: When is IP detection/masking performed, and should failures be logged? → A: *Superseded.* No IP detection or masking is performed by Argus. PostHog handles GeoIP natively from the connection IP. The "Capture no IP" project setting in PostHog controls whether the raw IP is retained after enrichment.

---

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

As an Argus user who has not opted out of telemetry, I want the privacy disclosure to accurately describe that approximate location (derived from IP address) is now included in telemetry, so I can make an informed decision about whether to opt out.

Currently the Telemetry & Privacy page and the consent banner explicitly state that "IP address or hostname" is never collected. Enabling GeoIP enrichment changes this and the disclosure must be updated before or at the same time as the enrichment is enabled.

**Why this priority**: The existing disclosure is a promise to users. Collecting location data without updating the disclosure would be a violation of that promise. This must ship together with Story 1.

**Independent Test**: Navigate to the Telemetry & Privacy page and verify it describes approximate location as an item that is collected, and the "never collected" section no longer lists IP address.

**Acceptance Scenarios**:

1. **Given** a user views the Telemetry & Privacy page, **When** location enrichment is active, **Then** the page lists approximate location (country and region/state) as a collected data item, with a plain-language explanation of how it is derived.
2. **Given** a user reads the "What is never collected" section, **When** location enrichment is active, **Then** "IP address" is removed from that list (since IP is now transiently used for geolocation, even if not stored directly).
3. **Given** the telemetry consent banner is visible, **When** it references what is collected, **Then** its summary text is updated to reflect that approximate location is included.

---

### ~~User Story 3 - Granular Location Opt-Out~~ *(Descoped)*

Explicitly out of scope. The main telemetry on/off toggle is sufficient. No granular location opt-out will be implemented.

---

### Edge Cases

- What happens when the Argus server is running behind a proxy or VPN? The location reflected in telemetry will be that of the proxy/VPN exit node, not the user's actual location. This is acceptable and should be noted in the privacy disclosure.
- What happens when the analytics provider cannot determine a location from the IP? The event is recorded without location enrichment; no fallback or error is raised.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST include country-level location enrichment in each telemetry event when telemetry is enabled, derived from the IP address of the HTTP connection as seen by PostHog. No client-side IP detection is required.
- **FR-009**: ~~System MUST mask the last octet of the Argus server's outbound IP address.~~ *Superseded: Argus does not transmit an `$ip` property. PostHog uses its connection IP natively. The PostHog project's "Capture no IP" setting (Settings → Project → General) prevents raw IP from being stored in event records.*
- **FR-002**: System MUST include country in every enriched telemetry event. Region/state SHOULD be included when PostHog's GeoIP can resolve it (best-effort); it is not required to be present on every event.
- **FR-003**: System MUST update the Telemetry & Privacy page to accurately describe approximate location as a collected data item, including how it is derived (IP-based geolocation).
- **FR-004**: System MUST remove "IP address" from the "What is never collected" list on the Telemetry & Privacy page, since IP is now transiently used for geolocation lookup.
- **FR-005**: System MUST update the telemetry consent banner and any summary text that describes what is collected to reflect location enrichment.
- **FR-006**: When telemetry is disabled, System MUST NOT transmit any location data (existing opt-out behavior is preserved).
- **FR-007**: ~~System SHOULD allow users to suppress location enrichment specifically (opt out of location only) without disabling all telemetry.~~ *Descoped: the main telemetry toggle is the only control.*
- **FR-008**: ~~System MUST detect and mask the Argus server's outbound IP at startup, cache the masked value, and refresh it when a network-change event is detected.~~ *Superseded: No client-side IP handling is required. GeoIP enrichment is fully managed by PostHog's ingestion pipeline.*

### Key Entities

- **TelemetryEvent**: An analytics event sent on user actions (e.g., `app_started`, `session_started`). Contains installation ID, app version, timestamp, and session metadata. No `$ip` property is set by Argus; PostHog derives location from the connection IP of each incoming HTTP request.
- **LocationData**: Approximate geographic location derived by PostHog from the connection IP. Country is always present when GeoIP resolves. Region/state is included when PostHog's GeoIP can resolve it; it is not guaranteed on every event. City is not collected. Raw IP is not stored in event records when the PostHog project has "Capture no IP" enabled.
- **TelemetrySettings**: The user-configurable settings for telemetry. A single boolean (enabled/disabled). No location-specific flag; location enrichment is always active when telemetry is enabled (via PostHog's native GeoIP pipeline).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of telemetry events sent while location enrichment is active carry a country attribution visible in the analytics dashboard.
- **SC-002**: 0 telemetry events carry location data when the user has disabled telemetry.
- **SC-003**: The Telemetry & Privacy page accurately reflects the updated data collection policy within the same release that enables location enrichment (no lag between policy and behavior).
- **SC-004**: When telemetry is re-enabled after being disabled, location enrichment resumes on the next event with no restart required.
- **SC-005**: Location enrichment failure (e.g., unresolvable IP) does not cause any event to be dropped or any error to be surfaced to the user.

## Assumptions

- Location is derived by PostHog from the connection IP of each telemetry HTTP request. Argus does not perform any IP detection, masking, or caching. For users behind proxies or VPNs, the location will reflect the proxy/VPN exit node.
- PostHog is configured with "Capture no IP" (Settings → Project → General → IP data capture configuration). This causes PostHog to perform GeoIP enrichment transiently and discard the raw IP, so it is not stored in event records.
- No re-consent handling is required. Telemetry is opt-out (enabled by default). The product currently has no users, so there is no existing user data or consent state to migrate. The updated Telemetry & Privacy page is the sole disclosure mechanism.
- Location opt-out (FR-007) is explicitly out of scope. Location enrichment is always active when telemetry is enabled. The only way to suppress location data is to disable telemetry entirely.
- Argus is a self-hosted developer tool. Telemetry is opt-out (enabled by default) and anonymous. There is no legal obligation to re-obtain consent from existing users, and there are currently no existing users.
