# Research: GitHub Feedback Links

## Decision 1: URL construction approach

**Decision**: Pre-fill GitHub issue URL via query parameters (`?title=`, `?body=`, `?labels=`).

**Rationale**: GitHub's `issues/new` endpoint natively supports URL-encoded query params for pre-filling the new issue form. No GitHub API token, OAuth flow, or backend proxy is needed. The user lands on a normal GitHub new-issue page they can edit before submitting.

**Alternatives considered**:
- GitHub Issues API (POST /repos/{owner}/{repo}/issues): Requires OAuth authentication. Rejected — adds unnecessary complexity and requires the user to be logged in via OAuth.
- Linking to a blank issue form: Too low friction; user has to fill in everything manually. Rejected.

## Decision 2: Component pattern

**Decision**: Follow the `LaunchDropdown` component pattern (same file, same structure).

**Rationale**: `LaunchDropdown` already implements the exact UX needed: a Button trigger, an absolute-positioned panel, outside-click and Escape handlers. Reusing this pattern ensures visual and behavioral consistency with zero new infrastructure.

**Alternatives considered**:
- Inline the dropdown in each page: No reuse across DashboardPage and SessionPage. Rejected.
- Use a generic `Dropdown` base component: Over-engineering for two static items. Rejected.

## Decision 3: Constant location

**Decision**: Store `ARGUS_GITHUB_REPO_URL` and URL builder functions in `frontend/src/config/feedback.ts`.

**Rationale**: The GitHub repo URL is used in two places (bug report link + feature request link). Centralizing it as a named constant satisfies the "no magic strings" code quality rule and makes future repo rename or URL changes a single-file edit.

**Alternatives considered**:
- Inline the URL in FeedbackDropdown.tsx: Would duplicate the string if the component ever gains a third link type. Rejected on "no magic strings" rule.

## Decision 4: Placement on SessionPage

**Decision**: Add FeedbackDropdown to SessionPage header alongside the back button row.

**Rationale**: The spec requires both links to be visible on all pages. SessionPage has a minimal header (just a back button and session meta). Adding a small FeedbackDropdown to that header is the least-intrusive placement.

**Alternatives considered**:
- Only add to DashboardPage: Violates FR-001/FR-002 (visible on all pages). Rejected.
- Shared layout/wrapper component: Over-engineering for a 2-page app. Rejected.
