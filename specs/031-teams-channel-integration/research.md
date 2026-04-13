# Research: Microsoft Teams Channel Integration

**Branch**: `031-teams-channel-integration` | **Date**: 2026-04-13

## Phase 0 Decisions

### D-001: Teams Integration Protocol

**Decision**: Use the Microsoft Bot Framework REST API directly via native `fetch` calls, with a Bot Framework-compliant webhook endpoint on Argus to receive inbound messages.

**Rationale**: The Bot Framework REST API is the only supported way to achieve bidirectional communication with Microsoft Teams. Incoming Webhooks (Office 365 Connectors) are one-way only and cannot receive replies. The Microsoft Teams Toolkit and `botbuilder` SDK are heavy dependencies. Direct REST calls give full control with minimal footprint.

**Alternatives considered**:
- `botbuilder` SDK: Rejected — pulls in 30+ transitive packages; REST API is sufficient for Argus's narrow use case.
- Microsoft Graph API: Rejected — Graph's channel messaging APIs require delegated auth scopes not suitable for a background service.
- Power Automate / Logic Apps: Rejected — requires external cloud service dependency and cannot forward commands back to Argus.

---

### D-002: Localhost Webhook Exposure

**Decision**: Document that users must expose Argus's bot endpoint (`/api/botframework/messages`) to the internet during Teams integration use. Recommended approach: ngrok (`ngrok http 7411`) for development; a reverse proxy or cloud relay for persistent deployments. Argus does not manage the tunnel itself.

**Rationale**: Microsoft Teams cannot POST to `127.0.0.1`. This is an inherent constraint of running a bot on localhost. The responsibility lies with the user/operator, not with Argus.

**Alternatives considered**:
- Bundling ngrok or cloudflare tunnel: Rejected — adds a binary dependency and obscures the networking model; better left explicit.
- Azure Bot Service relay (Direct Line): Rejected — adds Azure dependency and billing; out of scope for a simple local tool.

---

### D-003: Teams Message Display Format

**Decision**: Session output is batched into a periodically updated message (edit existing message) using plain text formatted with a code block. A new plain-text reply is posted at the start of each session and updated in-place at a configurable interval (default: every 3 seconds or when output is idle for 500 ms).

**Rationale**: Posting every output chunk as a separate reply would flood the thread and hit Teams rate limits immediately. Adaptive Cards were considered for richer formatting but add significant implementation complexity for minimal UX gain in a developer tool context.

**Alternatives considered**:
- Adaptive Cards: Deferred to v2 — visual improvement but not required for core functionality.
- One reply per batch: Rejected — creates unreadable threads for long-running sessions.

---

### D-004: Teams Credential Storage

**Decision**: Store Teams credentials (bot App ID, bot App Password, channel ID, service URL, owner Teams user ID) in a separate file `~/.argus/teams-config.json`, distinct from the general `~/.argus/config.json`.

**Rationale**: Separating credentials from general config reduces the risk of accidentally logging or exposing them. The file is created with restrictive permissions. Bot passwords are sensitive secrets.

**Alternatives considered**:
- Merge into `config.json`: Rejected — secrets mixed with non-sensitive config increases exposure surface.
- OS keychain: Deferred — good long-term approach but adds platform-specific dependencies; out of scope for v1.
- Environment variables only: Rejected — loses the UI-configurable settings requirement (FR-006).

---

### D-005: Owner Identity Verification

**Decision**: When saving Teams configuration, the user provides their own Teams user ID (from their Teams profile). This is stored as `ownerTeamsUserId`. Inbound webhook events include `activity.from.id` (the Teams user ID of the message sender). Argus compares `activity.from.id` to `ownerTeamsUserId` to determine if the sender is the session owner.

**Rationale**: This is the simplest verifiable identity mechanism without requiring a full OAuth 2.0 flow. The Teams user ID is a stable, non-guessable identifier (AAD Object ID format). The bot endpoint is already protected by Bot Framework token validation, preventing spoofed webhook calls.

**Alternatives considered**:
- Full OAuth 2.0 Microsoft login in Argus settings UI: Deferred — more secure auto-capture of user ID, but adds significant OAuth flow complexity; suitable for v2.
- Match by email: Rejected — Teams activity events surface user ID reliably but email may be absent depending on privacy settings.

---

### D-006: Message Buffer Implementation

**Decision**: Implement `TeamsMessageBuffer` as an in-memory per-session circular buffer (max 1000 entries). Buffer is keyed by session ID. On connectivity restore (detected by successful API call after failure), the buffer is flushed in order. Oldest entries are discarded (FIFO eviction) when the cap is reached, and a warning is emitted to the Argus log.

**Rationale**: In-memory buffer is sufficient for a local tool with short-lived outages. Persisting the buffer to SQLite would add write amplification for a transient concern.

**Alternatives considered**:
- SQLite-backed buffer: Deferred — better durability but overkill for local tool; revisit if Argus runs as a long-lived server.
- No buffer (drop on disconnect): Rejected per FR-010 and user preference.

---

### D-007: Bot Framework Token Validation

**Decision**: Validate all inbound requests to `/api/botframework/messages` using Bot Framework authentication (verify JWT bearer token from `Authorization` header against Microsoft's JWKS endpoint). Use the `botframework-connector` token validation library or implement JWKS validation directly with `jose`.

**Rationale**: The Bot Framework webhook endpoint is publicly reachable (via ngrok). Without token validation, any party on the internet could POST fake activity events and inject commands into sessions. This is a §VI security requirement.

**Alternatives considered**:
- IP allowlist: Rejected — Microsoft's Bot Framework uses a large dynamic IP range.
- Shared secret header: Rejected — Bot Framework doesn't support this natively; JWKS is the standard.
