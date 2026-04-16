# Research: Microsoft Teams Channel Integration (Graph API)

**Branch**: `031-teams-channel-integration` | **Date**: 2026-04-14
**Revision**: Replaces prior Bot Framework research (2026-04-13) following architecture decision to switch to Microsoft Graph API.

## Phase 0 Decisions

### D-001: Teams Integration Protocol

**Decision**: Use Microsoft Graph API with OAuth2 Delegated Auth (Device Code Flow) for all Teams communication. Outbound messages posted via Graph. Inbound commands detected via delta polling (Graph `/messages/delta`).

**Rationale**: The original Bot Framework approach required an Azure Bot resource, App Secret, and a publicly reachable webhook endpoint (ngrok). Graph API with Device Code Flow needs only a self-service Azure AD app registration — no bot registration, no public endpoint, no admin consent required for standard delegated scopes (`ChannelMessage.Send`, `ChannelMessage.Read.All`, `User.Read`). The tradeoff is command delivery latency increases from near-instant to ~15s, which is acceptable for a developer tool.

**Alternatives considered**:
- Bot Framework REST API: Rejected (v2 pivot) — requires Azure Bot resource, public endpoint, and ngrok; too much infrastructure for a local tool.
- `botbuilder` SDK: Rejected — heavy transitive dependencies; direct Graph API calls are sufficient.
- Power Automate / Logic Apps: Rejected — external cloud dependency; cannot forward commands back to Argus.
- Graph Change Notifications (webhook): Rejected — same public endpoint problem as Bot Framework.
- Graph Change Notifications + Azure Event Hubs: Rejected — requires Azure subscription; overkill for a local tool.

---

### D-002: OAuth2 Flow Choice

**Decision**: Use `@azure/msal-node` Device Code Flow for initial authentication. The obtained refresh token is stored in `~/.argus/teams-config.json`. Subsequent token refreshes use MSAL's token cache automatically.

**Rationale**: Device Code Flow requires no redirect URI, no web server, and works on any platform including headless machines. The user visits a URL and enters a code in their browser once. MSAL handles token refresh automatically. This is the right choice for a CLI/desktop tool running on localhost.

**Alternatives considered**:
- Authorization Code Flow: Rejected — requires a redirect URI and a temporary local HTTP server; more complex for minimal gain.
- Client Credentials Flow: Rejected — this is app-only auth, not delegated; requires admin consent and cannot act on behalf of the user.
- Raw MSAL-less OAuth: Deferred — possible but `@azure/msal-node` is well-maintained and handles token refresh edge cases correctly.

---

### D-003: Inbound Command Detection

**Decision**: Poll `GET /teams/{teamId}/channels/{channelId}/messages/{messageId}/replies/delta` every 10 seconds per active session. Store the `@odata.deltaLink` in the `teams_threads` table per session. Only process messages from the session owner (AAD Object ID match). First poll on thread creation initialises the delta link.

**Rationale**: Delta queries are efficient — they return only changes since the last `deltaLink`, not all historical messages. A 10-second polling interval is well within Graph API rate limits and satisfies SC-002 (≤15s command delivery). Polling scoped to reply threads (not full channel scan) minimises noise.

**Alternatives considered**:
- Poll entire channel delta (`/messages/delta`): Rejected — returns all messages in channel, requires filtering; more data transferred.
- Graph Change Notifications (push): Rejected — requires public webhook endpoint, defeating the no-public-endpoint goal.
- Polling message thread replies without delta (full GET each time): Rejected — expensive; delta tokens are specifically designed for this.

---

### D-004: Credential Storage

**Decision**: Store Teams credentials (clientId, tenantId, teamId, channelId, ownerUserId, refreshToken) in `~/.argus/teams-config.json`, separate from `~/.argus/config.json`. The `refreshToken` is masked as `"***"` in all API responses. The file is written with default OS user permissions.

**Rationale**: Separating secrets from general config reduces accidental exposure. The refresh token is a long-lived credential and must never appear in logs or API responses. MSAL also maintains its own in-memory cache on top of the stored refresh token.

**Alternatives considered**:
- OS keychain (macOS Keychain, Windows Credential Manager): Deferred — better security, but adds platform-specific native module dependencies; out of scope for v1.
- Environment variables only: Rejected — loses the UI-configurable settings requirement (FR-006).
- Merge into `config.json`: Rejected — secrets mixed with non-sensitive config.

---

### D-005: Owner Identity Capture

**Decision**: After Device Code Flow completes, immediately call `GET /me` (Graph API) to retrieve the authenticating user's AAD Object ID. Store this as `ownerUserId` in the config. All subsequent reply filtering compares reply sender IDs against this stored value.

**Rationale**: Capturing the user ID at auth time is more reliable than asking the user to manually enter it. The AAD Object ID is a stable, non-guessable GUID. This eliminates the FR-004 risk of an incorrect manual entry.

**Alternatives considered**:
- User manually enters their Teams user ID: Rejected — error-prone; resolved by auto-capture during Device Code Flow.
- Match by email or display name: Rejected — Graph message events surface `from.user.id` reliably but email visibility depends on tenant privacy settings.

---

### D-006: Message Buffer

**Decision**: Keep `TeamsMessageBuffer` (in-memory, per-session, max 1000 entries, FIFO eviction). No change from prior decision — still appropriate for Graph API approach.

**Rationale**: Same rationale as D-006 in prior research. Short-lived outages are the primary failure mode; SQLite persistence adds write amplification for a transient concern.

---

### D-007: Graph API Message Format

**Decision**: Post session output as plain-text replies within the session thread. Use `content` field with `contentType: "html"` for code blocks (`<pre>` wrapping). Post a root message when the session starts; all output and status updates are replies to that root message.

**Rationale**: Graph API channel messages support both `text` and `html` content types. Using `html` with `<pre>` tags gives readable code-style formatting without requiring Adaptive Cards. Root message = thread header; replies = output stream and status.

**Alternatives considered**:
- Adaptive Cards: Deferred to v2 — adds complexity without impacting core functionality.
- Plain text only: Acceptable fallback, but `<pre>` HTML gives better readability for CLI output.

