# Feature Specification: Slack Event Notifications

**Feature Branch**: `037-slack-event-notifications`
**Created**: 2026-04-14
**Status**: Draft
**Input**: User description: "I want to build an integration where from my backend server sees AI events and sessions it sends that message to a slack channel. I have slack workspace. but its a free tier. Give me options of what i can and cannot do"

## Free Tier Slack: What You Can and Cannot Do

Before detailing requirements, here is a clear breakdown of Slack Free tier capabilities relevant to this integration.

### What You CAN Do (Free Tier)

- **Send messages via Incoming Webhooks**: One webhook URL per configured app, posts to a designated channel. Simple, no OAuth flow or token management beyond the URL itself. Fully supported on free tier.
- **Post rich messages with Block Kit**: Buttons, sections, dividers, markdown text, code blocks, timestamps. Full Block Kit formatting is free.
- **Post to any public or private channel** the bot has been invited to.
- **Thread replies**: Group related notifications under one parent message (e.g., all events for one session in one thread). Requires a Bot token, not available with plain Incoming Webhook.
- **Update existing messages**: Edit a previously posted message (e.g., update a session-start message when the session ends with final stats). Also requires a Bot token.
- **Up to 10 active app integration slots**: Installing this Argus notifier app uses 1 of your 10 available slots.
- **Rate limit**: Approximately 1 message per second per webhook for sustained delivery; short bursts of a few messages per second are tolerated. Sufficient for monitoring an AI session workload.

### What You CANNOT Do (Free Tier)

- **Message history beyond 90 days**: Notifications older than 90 days are hidden (not deleted, but inaccessible without upgrading). Historical audit via Slack is limited to the past 90 days.
- **More than 10 integrations**: Once 10 apps are installed, adding more requires removing existing ones.
- **Slack Connect or cross-workspace sharing**: Cannot share your notification channel with external Slack workspaces.
- **Bulk data export**: Cannot export Slack message history for external analysis or auditing.
- **Advanced workflow automation triggered from Slack**: Slack Workflow Builder is limited on free tier. Argus pushes notifications out; reacting to Slack-initiated commands requires a Bot token but the logic lives in Argus, not Slack's Workflow Builder.

### Chosen Approach

This integration uses a **Slack Bot with the Web API** and a Bot token. This enables per-session message threading (all events for one session grouped in one Slack thread) and message updates. The Bot token is obtained once when creating a Slack App in your workspace and is fully supported on free tier. See the Clarifications section for the rationale.

---

## Clarifications

### Session 2026-04-14

- Q: Should session lifecycle events be grouped in Slack threads (requires Bot token) or sent as independent flat messages (works with Incoming Webhook)? → A: Threaded using a Bot token. Session-start posts the parent message; all follow-up events reply in that thread.
- Q: Which mid-session event types qualify as "notable" alerts for P2? → A: All events that Argus already tracks, enabled by default, with individual event types configurable off via configuration.
- Q: When a Slack delivery fails (network error, API error, rate limit), should the system retry or discard? → A: Discard on first failure. Log the failure with full context (session ID, event type, HTTP status, error body) and move on. No retries, no persistent queue.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Session Lifecycle Notifications (Priority: P1)

As a developer monitoring AI sessions through Argus, when a Claude Code or Copilot session starts or ends, I want to receive a Slack notification containing key session details so I can track active work without switching tools.

**Why this priority**: This is the core value of the integration. A developer can instantly see when AI-assisted work begins and ends across their team, even when not watching the Argus dashboard.

**Independent Test**: Can be fully tested by triggering a session start event and verifying a Slack message appears in the configured channel within 5 seconds with the correct session metadata.

**Acceptance Scenarios**:

1. **Given** Argus is running and a Slack channel is configured, **When** a new AI session is detected, **Then** a Slack message appears in the channel within 5 seconds with the session ID, model name, and start time.
2. **Given** an active session is being tracked, **When** the session ends, **Then** a Slack message appears in the channel with the session duration and final status.
3. **Given** Slack is unreachable, **When** a session event fires, **Then** the Argus server continues operating normally and the failed notification is logged without crashing or stalling the main process.

---

### User Story 2 - All-Event Notifications (Priority: P2)

As a developer, for every event Argus already tracks during a session, I want a corresponding Slack notification posted into that session's thread, so I have a complete real-time feed of AI activity in Slack. I can disable specific event types I do not care about via configuration.

**Why this priority**: All-event coverage makes Slack a live mirror of Argus activity. Filtering down to only what matters is a per-developer preference handled by configuration, not by limiting the feature scope.

**Independent Test**: Can be tested independently by triggering any known Argus event type (e.g., tool call, error, cost update) and verifying a thread reply appears in the session's Slack thread with the correct event type and metadata.

**Acceptance Scenarios**:

1. **Given** all event types are enabled (the default), **When** any Argus event fires during a session, **Then** a thread reply is posted to that session's Slack thread within 5 seconds with the event type and relevant metadata.
2. **Given** a specific event type is disabled in configuration, **When** that event type fires, **Then** no Slack message is sent for it, and other event types continue to post normally.
3. **Given** multiple events fire in rapid succession, **When** they occur within a short time window, **Then** they are queued and delivered in order, spaced to respect Slack rate limits, without silently dropping any notification.

---

### User Story 3 - Notification Configuration (Priority: P3)

As a developer, I want to control which events trigger Slack notifications and to which channel they are sent, so I can reduce noise and route different event types to appropriate audiences.

**Why this priority**: Configuration is a quality-of-life improvement. The feature is useful with sensible defaults; fine-grained control is not required for initial value.

**Independent Test**: Can be tested by modifying configuration to disable a previously enabled event type and verifying no Slack message is sent when that event fires.

**Acceptance Scenarios**:

1. **Given** configuration specifying enabled event types, **When** a disabled event type fires, **Then** no Slack message is sent for that event.
2. **Given** a Slack channel is reconfigured, **When** the next event fires, **Then** the notification goes to the newly configured channel.
3. **Given** invalid or missing Slack configuration, **When** Argus starts, **Then** a clear warning is logged and the Slack integration is disabled gracefully without affecting other Argus functionality.

---

### User Story 4 - Slack-to-Argus Question Routing (Priority: P4)

As a developer, I want to ask the Argus Slack bot a question (such as "what sessions are running?" or "status of session X") directly in Slack and receive a formatted answer, so I can query Argus from wherever I am without opening the dashboard.

**Why this priority**: Bidirectional communication turns the Slack channel from a passive notification feed into an interactive tool. It is lower priority than outbound notifications but adds significant convenience.

**Independent Test**: Can be tested by sending an app mention or direct message to the Argus bot in Slack and verifying a reply with current session data appears within 10 seconds.

**Acceptance Scenarios**:

1. **Given** the Argus bot is connected and sessions are active, **When** a developer mentions the bot with "sessions" or "status", **Then** the bot replies in the same thread with a list of current sessions and their statuses.
2. **Given** the developer sends an unrecognized command, **When** the bot receives it, **Then** it replies with a brief help message listing supported commands.
3. **Given** Argus is running on a developer's local machine with no public IP, **When** the bot receives a Slack message, **Then** Argus processes it via a Socket Mode connection (Argus connects outbound to Slack; no inbound port required).

---

### Edge Cases

- What happens when Slack returns a rate-limit response or any other error? The failure is logged with session ID, event type, and error detail, and the message is discarded. No retries.
- What happens when a Bot token has been revoked? The system logs a meaningful error on the failed delivery, disables further attempts for that delivery, and continues processing all other Argus functionality normally.
- What if an event fires before configuration is fully loaded at startup? Notifications should be queued or discarded safely, never causing a startup crash.
- What if multiple sessions start simultaneously? Each notification must be independent; one delivery failure must not suppress another session's notification.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST send a Slack message when an AI session start event is detected, including session ID, model name, and timestamp. This message is the thread parent for all subsequent events in that session.
- **FR-002**: System MUST send a Slack thread reply when an AI session end event is detected, including session duration and final status.
- **FR-002a**: System MUST send a Slack thread reply for every other event type that Argus already tracks (tool calls, errors, cost updates, approval prompts, and any other session events), posted into the thread of the session that produced the event. All event types are enabled by default.
- **FR-003**: System MUST NOT crash, block, or stall the main Argus server process if the Slack API is unavailable or returns an error.
- **FR-004**: System MUST support configuration of the target Slack channel and delivery credential (webhook URL or bot token) via environment variable or configuration file.
- **FR-005**: System MUST allow each event type to be individually enabled or disabled for Slack notification via configuration. All event types are enabled by default; configuration is used only to suppress unwanted types.
- **FR-006**: System MUST enforce a minimum delivery interval between outgoing Slack messages. If delivery fails for any reason (rate limit, network error, API error), the message is discarded after logging. No retries. No persistent queue.
- **FR-011**: System MUST accept inbound messages from Slack users (app mentions, direct messages to the bot) and route them to Argus query handlers that respond with current session data. This MUST use Slack Socket Mode (outbound WebSocket connection from Argus to Slack) so no public-facing HTTP endpoint is required.
- **FR-007**: System MUST log all Slack delivery failures with sufficient detail to diagnose the cause (response status, error body, event type, session ID).
- **FR-008**: System MUST validate Slack configuration at startup and emit a clear warning if configuration is missing or invalid, disabling the integration without affecting other Argus functionality.
- **FR-009**: System MUST group session lifecycle events (start, mid-session alerts, end) under a single Slack thread per session. The session-start message is the thread parent; all subsequent events for that session are posted as thread replies. This requires a Bot token (not an Incoming Webhook).
- **FR-010**: System SHOULD support customizable message content so notification text can be adjusted without code changes.

### Key Entities

- **SlackNotificationConfig**: Delivery credential (webhook URL or bot token), default channel name, list of enabled event types, rate limit interval, optional message templates.
- **SessionNotification**: Session ID, event type (session-start, session-end, error, alert), model name, event timestamp, session duration (for end events), delivery status, Slack thread anchor (the message timestamp of the session-start post, used to route follow-up events into the correct thread).
- **DeliveryRecord**: Timestamp of delivery attempt, event type, session ID, outcome (delivered, failed, skipped), response status code, error detail if any.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Slack notifications appear in the configured channel within 5 seconds of the triggering event under normal network conditions.
- **SC-002**: Zero Argus server crashes or degradations attributable to Slack integration failures across 30 days of continuous operation.
- **SC-003**: Each notification contains sufficient context (session ID, model, timestamp, status) for a developer to identify the session without opening the Argus dashboard.
- **SC-004**: All Slack delivery failures (including rate-limit responses) are logged with session ID, event type, HTTP status, and error body. No delivery failure causes a crash, hang, or error visible to the developer in the Argus UI.
- **SC-005**: Enabling or disabling specific event types takes effect without restarting the Argus server.
- **SC-006**: A developer can type a question or command directed at the Argus bot in Slack and receive a response with current session data within 10 seconds, without any public HTTP endpoint being exposed by the developer.

---

## Assumptions

- The Argus backend can make outbound HTTPS requests to Slack's API (`hooks.slack.com` or `slack.com/api`) without firewall restrictions.
- The user will create a Slack app or Incoming Webhook manually in their Slack workspace; Argus provides the client-side integration only.
- Free tier message retention (90 days) is acceptable; long-term notification audit will be handled by Argus's own logs rather than Slack history.
- One Slack integration slot (of the 10 available on free tier) will be consumed by this feature.
- The initial scope targets session lifecycle events (start/end) as P1; specific mid-session event alerting is P2.
- A Slack Bot token (`xoxb-...`) is required (not an Incoming Webhook) because threading depends on the Bot token API. The user will create a Slack App, add it to the target channel, and supply the Bot token to Argus via configuration.
- Slack Socket Mode is used for inbound message routing (US4). It requires an additional App-level token (`xapp-...`) obtained from the Slack App settings. Socket Mode is supported on Slack free tier and requires no public-facing HTTP endpoint.
- Supported inbound query commands are limited to session listing and status lookups for the initial implementation; extensibility to other query types is deferred.
