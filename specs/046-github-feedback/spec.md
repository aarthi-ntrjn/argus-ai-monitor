# Feature Specification: GitHub Feedback Links

**Feature Branch**: `046-github-feedback`  
**Created**: 2026-04-19  
**Status**: Draft  
**Input**: User description: "add feedback and bug report that takes the user to the github page"

## Clarifications

### Session 2026-04-19

- Q: How should the feedback options appear in the nav bar? → A: A single "Feedback" dropdown button in the nav bar, expanding to show "Report a Bug" and "Request a Feature" as dropdown items.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Report a Bug (Priority: P1)

A user encounters unexpected behavior in the Argus dashboard and wants to report it. They click "Report a Bug" in the navigation bar, which opens a pre-filled GitHub new issue form in a new browser tab. The form includes a template with fields for describing the bug, steps to reproduce, and expected vs actual behavior.

**Why this priority**: Bug reporting is the most common and urgent feedback type. Users need a frictionless way to report problems without leaving the app or hunting for the GitHub repo URL.

**Independent Test**: Can be tested by clicking "Report a Bug" in the nav bar and verifying the correct GitHub issue creation URL opens in a new tab with the bug report template pre-applied.

**Acceptance Scenarios**:

1. **Given** the user is on any page of the Argus dashboard, **When** they click "Report a Bug" in the navigation bar, **Then** a new browser tab opens to the GitHub new issue URL for the Argus public repo with the bug report label and body template pre-filled.
2. **Given** the GitHub new issue URL is constructed, **When** the user lands on GitHub, **Then** the issue title field is pre-filled with a placeholder like "Bug: " and the body contains a structured bug report template (description, steps to reproduce, expected behavior, actual behavior).

---

### User Story 2 - Request a Feature (Priority: P2)

A user has an idea for a new capability in Argus and wants to suggest it. They click "Request a Feature" in the navigation bar, which opens a pre-filled GitHub new issue form in a new browser tab with a feature request template.

**Why this priority**: Feature requests help guide product direction. Secondary to bug reports in urgency but equally important for long-term health.

**Independent Test**: Can be tested by clicking "Request a Feature" in the nav bar and verifying the GitHub feature request issue URL opens with the correct template.

**Acceptance Scenarios**:

1. **Given** the user is on any page of the Argus dashboard, **When** they click "Request a Feature" in the navigation bar, **Then** a new browser tab opens to the GitHub new issue URL with the feature request label and body template pre-filled.
2. **Given** the GitHub new issue URL is constructed, **When** the user lands on GitHub, **Then** the issue body contains a feature request template (problem statement, proposed solution, alternatives considered).

---

### Edge Cases

- What happens when the user has no internet connection? The link still opens a new tab; the browser shows its own offline error. No special handling needed.
- What if the GitHub repo is private or unavailable? The user lands on a GitHub 404 or login page. This is acceptable, as the public repo URL is hardcoded and stable.
- What if the pre-filled URL exceeds browser URL length limits? Templates are kept concise to avoid this. Standard GitHub issue templates stay well within limits.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The navigation bar MUST contain a "Feedback" dropdown button that is visible on all pages.
- **FR-002**: The "Feedback" dropdown MUST contain two items: "Report a Bug" and "Request a Feature".
- **FR-003**: Clicking "Report a Bug" MUST open the GitHub new issue URL for the Argus public repo in a new browser tab, with the `bug` label and a bug report body template pre-applied via URL query parameters.
- **FR-004**: Clicking "Request a Feature" MUST open the GitHub new issue URL for the Argus public repo in a new browser tab, with the `enhancement` label and a feature request body template pre-applied via URL query parameters.
- **FR-005**: The bug report body template MUST include placeholder sections for: description of the bug, steps to reproduce, expected behavior, and actual behavior.
- **FR-006**: The feature request body template MUST include placeholder sections for: problem statement, proposed solution, and alternatives considered.
- **FR-007**: Both links MUST open in a new browser tab, leaving the Argus dashboard undisturbed.
- **FR-008**: No backend call, authentication, or user account is required to use either feedback link.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Both "Report a Bug" and "Request a Feature" actions are reachable from every page of the application in 2 clicks (1 click to open the "Feedback" dropdown, 1 click to select the action).
- **SC-002**: Clicking either link takes the user to a pre-filled GitHub issue form within normal browser navigation time (no loading state or spinner in the app).
- **SC-003**: The GitHub issue form opened by each link has the correct label and a non-empty body template, verified by inspecting the constructed URL.
- **SC-004**: No additional infrastructure (backend endpoint, database entry, authentication flow) is introduced by this feature.

## Assumptions

- The Argus public GitHub repository URL is known and stable; it will be stored as a named constant in the frontend code.
- Users have a browser capable of opening new tabs and accessing the internet.
- GitHub's `issues/new` URL supports `?title=`, `?body=`, and `?labels=` query parameters for pre-filling (standard GitHub behavior).
- The navigation bar is the canonical location for persistent app-level actions; no floating button or footer link is needed.
- Mobile layout is out of scope for v1; the nav bar links behave the same on any screen size.
