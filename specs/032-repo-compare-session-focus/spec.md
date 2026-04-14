# Feature Specification: Repository Compare Link and Session Focus Button

**Feature Branch**: `032-repo-compare-session-focus`
**Created**: 2026-04-13
**Status**: Clarified
**Input**: User description: "Add GitHub compare link to repository card and focus CLI process button to session card"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - GitHub Compare Link on Repository Card (Priority: P1)

A developer monitoring multiple repositories in Argus wants to quickly see what changes exist on the current branch relative to master/main. The repository card now shows a clickable link icon that opens the GitHub compare view (e.g., `https://github.com/owner/repo/compare/master...feature-branch`) directly in the browser.

**Why this priority**: This is the primary navigation shortcut requested. It requires fetching and persisting the remote URL, which is foundational to any compare-link feature.

**Independent Test**: Can be fully tested by adding a GitHub-backed repo with a non-default branch and verifying the compare link appears in the header and opens the correct GitHub URL.

**Acceptance Scenarios**:

1. **Given** a repository with a GitHub remote URL and a non-default branch is registered, **When** the user views the repository card, **Then** a compare link icon appears next to the branch badge that opens `https://github.com/<owner>/<repo>/compare/<default>...<current>` in a new tab.
2. **Given** a repository whose remote URL is not a GitHub URL (e.g., GitLab, local), **When** the user views the repository card, **Then** no compare link is shown.
3. **Given** a repository with no remote URL or no branch, **When** the user views the repository card, **Then** no compare link is shown.
4. **Given** a repository on the default branch (master or main), **When** the user views the repository card, **Then** a compare link is shown pointing to the GitHub repository's default compare page (`https://github.com/<owner>/<repo>/compare`).

---

### User Story 2 - Focus CLI Process Button on Session Card (Priority: P1)

A developer has a Claude Code or Copilot CLI session running in a terminal window behind other windows. From the Argus session card, they click a "Focus" button that brings the originating terminal window to the foreground on their OS.

**Why this priority**: Both features were requested at the same time and the focus feature has equal value. It has the same priority as the compare link.

**Independent Test**: Can be fully tested by launching a session via PTY or detecting a running session, clicking the Focus button on the session card, and verifying the terminal window comes to the foreground.

**Acceptance Scenarios**:

1. **Given** an active session with a known PID, **When** the user clicks the Focus button, **Then** the OS brings the terminal window hosting that process to the foreground.
2. **Given** an ended or completed session, **When** the user views the session card, **Then** no Focus button is shown (no process to focus).
3. **Given** an active session where the process window cannot be located (e.g., headless server), **When** the user clicks Focus, **Then** the button shows a brief error state and the user is not left with a broken UI.
4. **Given** a session with no PID yet (just started), **When** the user views the session card, **Then** the Focus button is shown but disabled/greyed out.

---

### Edge Cases

- Repository has no `origin` remote: no remote URL is fetched, no compare link shown.
- Repository remote URL uses SSH format (`git@github.com:owner/repo.git`): parse correctly to construct HTTPS compare URL.
- Repository remote URL is HTTPS with `.git` suffix: strip suffix when building compare URL.
- Session PID is valid but process has no visible window (e.g., headless/daemon): backend returns `WINDOW_NOT_FOUND` and frontend shows a non-blocking toast or brief error indicator.
- Multiple PIDs available (`pid` and `hostPid`): focus the `hostPid` first (the terminal host), fall back to `pid`.
- Focus is called on a session with `null` PID: backend returns `PID_NOT_SET` 422.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST store the remote origin URL for each repository when it is registered or scanned.
- **FR-002**: The system MUST detect GitHub remote URLs (both HTTPS and SSH formats) and construct a compare URL of the form `https://github.com/<owner>/<repo>/compare/<base>...<head>`.
- **FR-003**: The repository card MUST display a compare link icon when: the repository has a GitHub remote URL and the current branch is known. When the current branch is a non-default branch (not master/main), the link points to `https://github.com/<owner>/<repo>/compare/<default>...<current>`. When on the default branch, the link points to `https://github.com/<owner>/<repo>/compare`.
- **FR-004**: The compare link MUST open in a new browser tab and MUST NOT navigate the Argus dashboard.
- **FR-005**: The system MUST expose a `POST /api/v1/sessions/:id/focus` endpoint that attempts to bring the process's terminal window to the foreground.
- **FR-006**: The focus endpoint MUST use OS-appropriate mechanisms: PowerShell on Windows, AppleScript on macOS, wmctrl/xdotool on Linux.
- **FR-007**: The session card MUST display a Focus button for sessions that are not in `ended` or `completed` status. The button MUST be disabled (greyed out) when the session has no known PID.
- **FR-008**: The focus endpoint MUST return structured errors using the `{ error, message, requestId }` contract.
- **FR-009**: The remote URL MUST be persisted in the database so it survives backend restarts.
- **FR-010**: The remote URL MUST be refreshed whenever the repository branch is refreshed.

### Key Entities

- **Repository**: Extended with `remoteUrl: string | null` representing the `origin` remote URL as fetched by `git remote get-url origin`.
- **Session**: Existing entity; the `pid` and `hostPid` fields are used by the focus feature to identify which process to bring to focus.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A GitHub-backed repository on a feature branch shows a compare link icon within 1 second of the dashboard loading.
- **SC-002**: Clicking the compare link opens the correct GitHub compare URL in a new tab with zero additional user interaction.
- **SC-003**: The Focus button is visible on every active session card and absent on ended/completed session cards.
- **SC-004**: Clicking Focus on an active session with a resolvable PID brings the terminal window to front within 2 seconds on Windows, macOS, and Linux.
- **SC-005**: Repositories without a GitHub remote (GitLab, local bare repos, no remote) show no compare link.
- **SC-006**: The focus endpoint responds within 500ms (p95) per §VIII of the constitution.
- **SC-007**: All new API endpoints have integration tests. All new frontend components have unit tests.

## Clarifications

### Session 2026-04-13

- **Compare link on default branch**: When the current branch is the default branch (master/main), the compare link is still shown but points to `https://github.com/<owner>/<repo>/compare` (the GitHub default compare page) rather than a branch-specific compare URL.
- **Focus button visibility**: The Focus button is shown on all non-ended/non-completed sessions. It is disabled (greyed out) when no PID is known. When a PID becomes available (session detects a process), the button becomes enabled automatically.



- The Argus backend runs on the same machine as the developer's terminal, making OS-level window focus feasible.
- The primary use case is GitHub-hosted repositories; GitLab and Bitbucket compare links are out of scope for v1.
- The default base branch for comparison is detected as `master` or `main` (checked in that order from the remote).
- "Focus" means bringing the terminal window to the foreground; it does not scroll the terminal or send input.
- The feature targets single-user local developer tool usage, so §VI and §VIII exceptions apply (localhost binding, single-user concurrency).
- The remote URL is stored as fetched (`origin`) and is not validated against live GitHub API.
- This feature runs entirely on the local machine; no GitHub API calls are made.
