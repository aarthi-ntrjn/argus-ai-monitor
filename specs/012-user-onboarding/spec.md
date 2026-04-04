# Feature Specification: User Onboarding Journey

**Feature Branch**: `012-user-onboarding`  
**Created**: 2026-04-04  
**Status**: Clarified  
**Input**: User description: "i want to add helpful onboarding user journey as they navigate the argus application. i think there might be some good open source user journey onboarding typescript modules research and find options"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - First-Time Dashboard Orientation (Priority: P1)

A brand-new Argus user opens the application for the first time and has no idea where to start. A guided onboarding tour launches automatically, walking them step by step through the Dashboard — explaining what sessions are, how the monitoring panel works, and what actions they can take. The tour is short (under 2 minutes), skippable at any point, and stays visually anchored to the relevant UI element at each step.

**Why this priority**: Without orientation, a first-time user faces a blank dashboard and abandons the tool. This is the highest-value onboarding moment and directly reduces drop-off.

**Independent Test**: Open the application as a first-time user (no previous onboarding state). The guided tour should start automatically. Complete all steps and verify the user lands on the Dashboard having been introduced to every major panel. This can be demonstrated end-to-end with a fresh user state, independently of any other story.

**Acceptance Scenarios**:

1. **Given** a user opens Argus for the first time, **When** the Dashboard loads, **Then** a welcome overlay appears with an introduction and a "Start Tour" button, and also a "Skip" option.
2. **Given** the tour is active, **When** the user advances through each step, **Then** each step highlights the relevant UI area with an explanatory tooltip anchored to that element.
3. **Given** the tour is active, **When** the user clicks "Skip", **Then** the tour dismisses immediately and the application remains fully usable.
4. **Given** the user completes all tour steps, **When** the final step is acknowledged, **Then** the tour marks itself complete and does not re-launch on subsequent visits.

---

### User Story 2 - Session Detail Page Contextual Hints (Priority: P2)

A user navigates to an individual session detail page for the first time. Contextual hint tooltips appear on key controls (e.g., remote control panel, status indicators, log viewer) explaining what each one does. Hints are non-blocking and can be dismissed individually.

**Why this priority**: The session detail page contains the core power of Argus (monitoring and control). Contextual hints at this level dramatically improve discoverability of features without overwhelming the dashboard tour.

**Independent Test**: Navigate to a session detail page with onboarding hints enabled. All key controls should display dismissible hint badges or tooltips on first visit. Dismissing hints persists — they do not re-appear on the next visit to the same page.

**Acceptance Scenarios**:

1. **Given** a user visits a session detail page for the first time, **When** the page renders, **Then** contextual hint badges appear on the remote control panel, status indicator, and log viewer.
2. **Given** a hint badge is visible, **When** the user hovers or taps the badge, **Then** an explanatory tooltip appears describing that control's purpose.
3. **Given** the user dismisses a hint, **When** they revisit the session detail page, **Then** the dismissed hint does not reappear.
4. **Given** the user has dismissed all hints on the session page, **When** they visit a different session detail page, **Then** the hints also do not appear (hints are dismissed globally, not per-session).

---

### User Story 3 - Replay Onboarding Tour On Demand (Priority: P2)

A returning user wants to revisit the onboarding tour — perhaps because they forgot where a feature is, or because they skipped it originally. They can access a "Restart Tour" option from a help menu or settings area, which replays the full Dashboard tour from the beginning.

**Why this priority**: Users who skipped or rushed through the tour should not be locked out of it. This also supports onboarding after new features are added in future releases.

**Independent Test**: As a returning user (onboarding previously completed or skipped), locate and trigger the "Restart Tour" option. The full Dashboard tour should replay identically to the first-time experience.

**Acceptance Scenarios**:

1. **Given** a user has previously completed or skipped the onboarding tour, **When** they locate the "Restart Tour" option in the help or settings area, **Then** the option is visible and accessible.
2. **Given** the user triggers "Restart Tour", **When** the tour begins, **Then** the full Dashboard tour replays from step 1, exactly as it would for a first-time user.
3. **Given** the user completes the replayed tour, **When** the final step is acknowledged, **Then** the completion state is preserved and the tour does not auto-launch again on next visit.

---

### User Story 4 - Onboarding Progress Reset for Testing and Support (Priority: P3)

A developer or support team member — or any user — wants to reset their onboarding state so that the tour triggers again from scratch. This action is available to all users via the help menu or settings panel, allowing anyone to re-experience the full onboarding tour.

**Why this priority**: Nice-to-have for developer experience and support workflows. Does not affect end users directly.

**Independent Test**: Any user (not just admin/developer) can locate the onboarding reset option in the help menu or settings panel and trigger it. Reload the Dashboard — the welcome overlay should appear and the tour should start automatically.

**Acceptance Scenarios**:

1. **Given** any user accesses the onboarding reset option in the help menu or settings panel, **When** they trigger the reset, **Then** all onboarding completion state is cleared.
2. **Given** the reset has been applied, **When** the user navigates to the Dashboard, **Then** the first-time onboarding tour launches as if the user is brand new.

---

### Edge Cases

- What happens when the user resizes the browser window mid-tour? Tooltips and highlights should reposition to remain anchored to their target elements.
- What happens if the target element for a tour step is not yet rendered (e.g., loading state)? The tour step should wait or gracefully skip to the next step.
- What happens if the user navigates away mid-tour (e.g., clicks a sidebar link)? The tour gracefully dismisses silently. The user can restart via "Restart Tour" at any time.
- What happens if onboarding state cannot be persisted (e.g., storage unavailable)? The tour should still function within the session, and the user is not blocked from using the app.
- What happens on very small screens (tablet/mobile)? Tour tooltips must remain readable and not obscure critical UI; scrolling into view should be handled automatically.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST automatically launch the guided Dashboard tour for users who have not previously completed or skipped it.
- **FR-002**: Users MUST be able to skip the tour at any step without losing access to any application feature.
- **FR-003**: System MUST visually highlight the UI element relevant to each tour step, with a tooltip anchored to that element.
- **FR-004**: System MUST persist onboarding completion state so the tour does not re-launch on subsequent visits.
- **FR-005**: System MUST display contextual hint badges on key controls of the session detail page on a user's first visit to that page.
- **FR-006**: Users MUST be able to dismiss individual contextual hints, with that dismissal persisted across sessions.
- **FR-007**: Users MUST be able to replay the full Dashboard tour on demand via a help or settings area.
- **FR-008**: System MUST allow any user to reset their own onboarding state via the help menu or settings panel, relaunching the tour as if they are brand new.
- **FR-009**: Tour tooltips MUST reposition correctly when the browser window is resized during the tour.
- **FR-010**: The tour MUST handle gracefully the case where a target UI element is not yet rendered (skip or wait).
- **FR-011**: If the user navigates away from the Dashboard mid-tour, the tour MUST gracefully dismiss silently without blocking navigation; the user may restart via "Restart Tour".
- **FR-012**: The onboarding tour and all contextual hints MUST comply with WCAG 2.1 AA, including full keyboard navigation, screen-reader compatibility, proper focus management, and ARIA labels on all interactive elements.
- **FR-013**: The system MUST expose named hook points for key onboarding events (tour started, tour completed, tour skipped, step advanced, hint viewed, hint dismissed) to enable future integration with an analytics system.

### Key Entities

- **Onboarding State**: Tracks per-user whether the Dashboard tour has been completed or skipped, and which contextual hints have been dismissed. Persisted across sessions.
- **Tour Step**: An ordered unit of the guided tour, composed of a target element selector, explanatory content, and navigation controls (next/previous/skip).
- **Contextual Hint**: A non-blocking, dismissible annotation attached to a specific UI control on a specific page, indicating its purpose to a first-time visitor.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time user can complete the full Dashboard onboarding tour in under 2 minutes.
- **SC-002**: 80% or more of first-time users who start the tour complete it without skipping. *(Requires future analytics wiring via FR-013 hook points.)*
- **SC-003**: Users who complete the onboarding tour successfully perform their first core action (monitoring a session) within 5 minutes of completing the tour.
- **SC-004**: Contextual hints on the session detail page are viewed by at least 70% of first-time session page visitors. *(Requires future analytics wiring via FR-013 hook points.)*
- **SC-005**: The tour tooltip remains correctly positioned and readable across all supported screen sizes (desktop, tablet).
- **SC-006**: Onboarding state persists correctly — the tour does not re-launch unexpectedly on subsequent visits for 100% of users who completed or skipped it.

## Assumptions

- Users are developers or technical operators who are generally comfortable with web UIs; the tour content can use light technical language but must still be clear.
- The onboarding experience targets desktop and tablet screen sizes; mobile is out of scope for v1.
- Onboarding state will be stored client-side (browser localStorage) for v1. The storage schema MUST be designed to be forward-compatible with a per-authenticated-user model, enabling a future migration without data loss.
- The tour covers the Dashboard page and session detail page only; no other pages require onboarding steps in v1.
- An open-source TypeScript-compatible tour/onboarding library will be evaluated and selected during the planning phase. The library MUST support full WCAG 2.1 AA accessibility. Candidates include Shepherd.js, Driver.js, Intro.js, and Reactour. The choice will be based on active maintenance, TypeScript support, accessibility, and integration fit with the existing frontend.
- The "Restart Tour" entry point and onboarding state reset action will both be accessible to all users via the help menu or settings panel; no role-based access control is needed.
- Analytics event tracking is deferred to a future feature. This feature will expose named hook points (FR-013) to make future wiring straightforward.
- No new backend infrastructure is required for v1; all persistence is handled client-side.
