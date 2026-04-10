# Feature Specification: Test GitHub Copilot CLI (GHCP) Launch with Argus

**Feature Branch**: `022-test-ghcp-launch`
**Created**: 2026-04-10
**Status**: Clarified
**Input**: User description: "test that GHCP launch with argus is working well"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Copilot CLI Session Detection via Real-Server API (Priority: P1)

As a developer testing the Argus integration, I want to verify that when the CopilotCliDetector
finds a workspace.yaml + lock file for a registered repository, it creates a `copilot-cli`
session in the DB with the correct fields, and that session is retrievable via the API.

**Why this priority**: Core detection is the foundational path — without it, nothing else works.
All other tests depend on a copilot-cli session existing in the backend.

**Independent Test**: Create a fake `workspace.yaml` + `inuse.{PID}.lock` under a test-controlled
copilot session-state dir pointing to a registered repo, trigger a scan cycle, then call
`GET /api/v1/sessions` and verify the session appears with `type: 'copilot-cli'`.

**Acceptance Scenarios**:

1. **Given** a repo is registered and a valid `workspace.yaml` exists in the copilot session-state
   dir with `cwd` matching that repo, **When** `CopilotCliDetector.scan()` runs, **Then** the
   session appears in `GET /api/v1/sessions` with `type: 'copilot-cli'` and `status: 'active'`
   (when lock file PID is running) or `status: 'ended'` (when no lock file / PID not running).

2. **Given** a detected copilot-cli session, **When** `GET /api/v1/sessions/:id` is called with
   its ID, **Then** it returns the session with `launchMode: null`, `type: 'copilot-cli'`,
   and `repositoryId` matching the registered repo.

3. **Given** a copilot-cli session-state dir entry with a `cwd` that has no matching registered
   repo, **When** the scan runs, **Then** no session is created in the DB for that entry.

---

### User Story 2 - Send Prompt API Contract for Copilot CLI Sessions (Priority: P1)

As a developer testing the Argus integration, I want to verify the correct API behavior when
attempting to send a prompt to a detected copilot-cli session (one without a PTY connection).

**Why this priority**: Verifies the error-handling contract for the most common copilot-cli
scenario (detected, not launched via `argus launch`). Critical to confirm Argus does not
silently drop prompts.

**Independent Test**: Create a detected copilot-cli session via the CopilotCliDetector, then
POST to `/api/v1/sessions/:id/send` and verify the returned ControlAction has `status: 'failed'`
with an appropriate message (no PTY channel available).

**Acceptance Scenarios**:

1. **Given** a detected copilot-cli session (`launchMode: null`), **When**
   `POST /api/v1/sessions/:id/send` is called with a valid prompt, **Then** the response is
   202 and the body has `status: 'failed'` (prompt delivery requires a PTY launch).

2. **Given** a non-existent session ID, **When** `POST /api/v1/sessions/:id/send` is called,
   **Then** the response is 404 with `error: 'NOT_FOUND'`.

3. **Given** a missing or empty prompt body, **When** `POST /api/v1/sessions/:id/send` is called,
   **Then** the response is 400 with `error: 'MISSING_PROMPT'`.

---

### User Story 3 - Launcher WebSocket Registration with sessionType copilot-cli (Priority: P2)

As a developer testing the Argus integration, I want to verify that the `/launcher` WebSocket
endpoint correctly accepts a `register` message with `sessionType: 'copilot-cli'`, creates a
pending entry in the PtyRegistry, and auto-creates the repository if it does not already exist.

**Why this priority**: Validates the registration contract for the `argus launch copilot` path,
ensuring the WS layer works correctly before any file-based detection happens.

**Independent Test**: Connect a WebSocket to `ws://localhost:7412/launcher`, send a `register`
message with `sessionType: 'copilot-cli'` and a `cwd`, then verify via
`GET /api/v1/repositories` that the repo was auto-created.

**Acceptance Scenarios**:

1. **Given** Argus is running, **When** a WS client sends
   `{ type: 'register', sessionId, sessionType: 'copilot-cli', cwd: TEST_REPO_A, pid: 0 }`,
   **Then** the WS connection stays open without error and `GET /api/v1/repositories` includes
   a repository entry with path `TEST_REPO_A`.

2. **Given** a pending copilot-cli launcher WS (registered but no scan yet), **When** the
   WS disconnects before any session is detected, **Then** no DB session is created and the
   repository entry remains (cleanup does not remove repos on WS close).

---

### User Story 4 - Session Lifecycle: Active to Ended on Lock File Removal (Priority: P2)

As a developer testing the Argus integration, I want to verify that when a copilot-cli session's
lock file is removed (indicating the process ended), the next scan marks the session as `ended`.

**Why this priority**: Validates session termination detection for copilot-cli, which has no
hook mechanism. This is the only way Argus knows a copilot session has stopped.

**Independent Test**: Create a workspace.yaml + lock file, trigger scan (session active),
remove the lock file, trigger another scan, then verify
`GET /api/v1/sessions/:id` returns `status: 'ended'`.

**Acceptance Scenarios**:

1. **Given** an active copilot-cli session with a lock file pointing to a PID that is not
   running, **When** the scan runs again, **Then** `GET /api/v1/sessions/:id` returns
   `status: 'ended'`.

2. **Given** an ended copilot-cli session, **When** `POST /api/v1/sessions/:id/send` is called
   with a prompt, **Then** the response is 409 with `error: 'CONFLICT'`.

---

### Edge Cases

- What happens when `workspace.yaml` is malformed YAML? Session should not be created (parse
  error logged, no crash).
- What happens when `workspace.yaml` has no `cwd` field? Session should not be created (no
  repo lookup possible).
- What happens when the copilot session-state directory does not exist? Scan returns empty list
  with no error.
- What happens when two `workspace.yaml` files have the same `id`? Upsert is idempotent, the
  session is updated in place.
- What happens when `POST /sessions/:id/send` is called with a prompt containing newlines
  or special characters? The request should be accepted (validation is prompt-length only, not
  content-restricted).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The test suite MUST verify that `CopilotCliDetector.scan()` creates a `copilot-cli`
  session in the DB when a valid `workspace.yaml` + lock file exists for a registered repo.
- **FR-002**: The test suite MUST verify `GET /api/v1/sessions/:id` returns correct fields
  (`type`, `launchMode`, `repositoryId`, `status`) for detected copilot-cli sessions.
- **FR-003**: The test suite MUST verify that `POST /api/v1/sessions/:id/send` returns 202
  with `status: 'failed'` for detected copilot-cli sessions (no PTY channel available).
- **FR-004**: The test suite MUST verify the `/launcher` WS accepts `sessionType: 'copilot-cli'`
  register messages without error and auto-creates the repo entry.
- **FR-005**: The test suite MUST verify the error contract (400, 404, 409) for the send-prompt
  endpoint with copilot-cli sessions.
- **FR-006**: The test suite MUST exercise the session lifecycle: lock file present + PID
  not running = `ended`; no lock file at all = no active session.
- **FR-007**: Tests MUST use the existing real-server infrastructure (port 7412, isolated SQLite DB,
  helpers from `test-config.ts`) and follow patterns in `sc-020-real-send-prompt.spec.ts`.
- **FR-008**: Tests MUST NOT require a real `gh copilot` binary. All sessions MUST be simulated
  by writing `workspace.yaml` + lock files to a temp directory passed to the test backend.

### Key Entities

- **CopilotCliSession**: A session with `type: 'copilot-cli'`, `launchMode: null`, detected
  from `workspace.yaml` in the copilot session-state dir. Key fields: `id`, `repositoryId`,
  `type`, `launchMode`, `pid`, `pidSource`, `status`, `startedAt`, `endedAt`.
- **WorkspaceYaml**: YAML file at `{sessionStateDir}/{uuid}/workspace.yaml` with fields:
  `id`, `cwd`, `summary`, `created_at`, `updated_at`.
- **LockFile**: `inuse.{PID}.lock` file in the session dir, indicating an active process.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `GET /api/v1/sessions` includes a copilot-cli session within 500ms after
  `CopilotCliDetector.scan()` is triggered with a valid workspace.yaml + lock file.
- **SC-002**: `POST /api/v1/sessions/:id/send` returns 202 with `status: 'failed'` for all
  detected copilot-cli sessions (`launchMode: null`) — confirmed by at least 1 test.
- **SC-003**: The `/launcher` WS `register` message with `sessionType: 'copilot-cli'` completes
  without error and creates the repository entry if missing.
- **SC-004**: All new tests pass in `npm run test:e2e:real` with 0 failures and the suite
  completes in under 120 seconds.
- **SC-005**: Session lifecycle test confirms a session transitions from `active` to `ended`
  when its lock file is removed and a new scan is triggered.

## Assumptions

- No real `gh copilot` binary is required. All sessions are simulated via filesystem fixtures.
- Tests control the copilot session-state directory by injecting a custom path into the backend.
  The real-server test setup needs a way to point `CopilotCliDetector` at the test dir, either
  via an env variable (`COPILOT_SESSION_STATE_DIR`) or a dedicated test-only endpoint.
- `TEST_REPO_A` (set up by `global-setup.ts`) has a `.git` directory and can be registered
  via `POST /api/v1/repositories` as in existing real-server tests.
- §VI security exception applies: this is a local developer tool bound to 127.0.0.1.
- §VIII performance exception applies: single-user localhost tool; concurrency target is
  10+ concurrent sessions.
