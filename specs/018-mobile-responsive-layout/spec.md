# Feature Specification: Mobile-Responsive Layout

**Feature Branch**: `018-mobile-responsive-layout`
**Created**: 2026-04-06
**Status**: Clarified
**Input**: User description: "the ux is not laying out properly when opening on narrow devices like phones. i need to provide a different layout structure for mobile vs desktop"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Dashboard usable on a phone (Priority: P1)

A user opens the Argus dashboard on a phone or narrow screen (width under 768px). Currently the dashboard renders a fixed two-column layout (session list on the left, TodoPanel and OutputPane on the right) which overflows horizontally and is unusable on small screens.

On mobile the layout switches to a single-column stack. A persistent bottom tab bar provides two tabs: "Sessions" and "Tasks". The Sessions tab shows the full-width session cards. The Tasks tab shows the TodoPanel. Tapping a session card navigates to the full session detail page (`/sessions/:id`) rather than opening the inline OutputPane.

**Why this priority**: The dashboard is the primary screen. Nothing else is useful if the main view is broken on mobile.

**Independent Test**: Open the dashboard on a device or browser window 390px wide. All content must be visible and scrollable without horizontal overflow.

**Acceptance Scenarios**:

1. **Given** a viewport width below 768px, **When** the dashboard loads, **Then** session cards render full-width in a single column with no horizontal scroll bar, and a bottom tab bar shows "Sessions" and "Tasks" tabs.
2. **Given** a narrow viewport and multiple repositories, **When** the user scrolls down in the Sessions tab, **Then** all repository sections and their session cards are accessible.
3. **Given** a narrow viewport, **When** the user taps a session card, **Then** the browser navigates to the session detail page (`/sessions/:id`).
4. **Given** a narrow viewport, **When** the user taps the "Tasks" tab, **Then** the TodoPanel is shown full-width, replacing the session list.
5. **Given** a viewport 768px wide or wider, **When** the dashboard loads, **Then** the existing two-column desktop layout is preserved unchanged, with no bottom tab bar visible.

---

### User Story 2 - TodoPanel accessible on mobile (Priority: P2)

On mobile the TodoPanel is shown when the user taps the "Tasks" tab in the bottom tab bar. It renders full-width. Adding, editing, and deleting todo tasks work identically to the desktop version.

**Why this priority**: The TodoPanel is a secondary utility. Session monitoring comes first. The bottom tab bar makes it immediately discoverable without obscuring session content.

**Independent Test**: On a 390px-wide viewport, tap the "Tasks" tab, add a task, check it off, and delete it without any horizontal overflow.

**Acceptance Scenarios**:

1. **Given** a narrow viewport, **When** the dashboard loads, **Then** a bottom tab bar with "Sessions" and "Tasks" tabs is visible.
2. **Given** the user is on the Tasks tab on mobile, **When** the user interacts with tasks (add, edit, toggle, delete), **Then** all interactions work identically to the desktop version.
3. **Given** the user is on the Tasks tab on mobile, **When** the user taps the "Sessions" tab, **Then** the session list is shown and the TodoPanel is hidden.

---

### User Story 3 - Session detail page usable on mobile (Priority: P2)

The full-page session detail view renders in a single-column layout on narrow screens. The output log, session metadata, and prompt bar are each full-width and scrollable.

**Why this priority**: Secondary to the dashboard but important for users who navigate directly to a session URL on mobile.

**Independent Test**: Open `/sessions/:id` on a 390px-wide viewport. The output log, session metadata, and prompt bar must all be visible and scrollable without horizontal overflow.

**Acceptance Scenarios**:

1. **Given** a narrow viewport, **When** the user opens a session detail page, **Then** the output log fills the full available width with no horizontal overflow.
2. **Given** a narrow viewport, **When** the user types a prompt in the prompt bar, **Then** the input and send button are fully visible and tappable without zooming.

---

### Edge Cases

- What happens when the viewport is resized from desktop to mobile (or vice versa) while the app is open? The layout must reflow correctly without requiring a page reload.
- What happens on mid-range tablet widths (768px to 1024px)? The desktop layout applies at 768px and above; no separate tablet-specific structure is required.
- What happens when a session is selected on mobile and the user rotates the device? The selected session view must remain open and correct after rotation.
- What happens when there are no sessions or no repos? Empty-state messages must be readable at narrow widths.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: On viewports narrower than 768px, the dashboard MUST display in a single-column layout with session cards and repository sections stacked vertically at full width.
- **FR-002**: On viewports narrower than 768px, the side-by-side desktop layout (session list alongside a right panel) MUST NOT be used.
- **FR-003**: On viewports narrower than 768px, tapping a session card MUST navigate to the full session detail page (`/sessions/:id`) rather than opening the inline OutputPane.
- **FR-004**: On viewports narrower than 768px, the dashboard MUST show a bottom tab bar with a "Sessions" tab and a "Tasks" tab. The bottom tab bar MUST NOT be visible at 768px and wider.
- **FR-005**: All touch targets (buttons, cards, checkboxes, icon controls) MUST meet a minimum tappable size of 44x44 CSS pixels on mobile viewports.
- **FR-006**: The session detail page MUST render in a single-column layout on viewports narrower than 768px, with no horizontal scrollbar.
- **FR-007**: The prompt input bar MUST remain fully visible and usable at narrow widths on both the dashboard and the session detail page.
- **FR-008**: The existing desktop layout at 768px and wider MUST remain visually and functionally unchanged.
- **FR-009**: The layout MUST reflow correctly when the viewport is resized across the 768px breakpoint without requiring a page reload.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On a 390px-wide viewport, the dashboard loads with zero horizontal overflow (no horizontal scrollbar visible).
- **SC-002**: All interactive controls on the dashboard and session detail page are reachable and usable on a touch device without requiring the user to zoom in.
- **SC-003**: A user on mobile can view session output, send a prompt, and manage todos within a single browsing session without switching to a desktop device.
- **SC-004**: The desktop layout at 1280px wide is visually identical before and after this change (no regression).
- **SC-005**: The layout reflows correctly when the browser window is resized across the 768px breakpoint in either direction.

## Clarifications

### Session 2026-04-06

- **Mobile navigation pattern**: Bottom tab bar with "Sessions" and "Tasks" tabs (Option A). The tab bar is only visible on mobile (below 768px).
- **Session card tap on mobile**: Navigates to the full session detail page (`/sessions/:id`). The inline OutputPane is desktop-only; it is not shown on mobile.

## Assumptions

- The 768px breakpoint is the boundary between mobile and desktop layouts; no separate tablet-specific layout structure is required.
- The app is primarily a desktop monitoring tool; mobile is a convenience improvement, not a ground-up redesign.
- Native app packaging (iOS or Android) is out of scope; this is a browser-based responsive improvement only.
- Touch-specific gestures (swipe to dismiss, pull to refresh) are out of scope for this iteration; tap interactions suffice.
- The existing responsive utility system (Tailwind CSS breakpoint classes) is used to implement the breakpoints; no new CSS framework or dependency is required.
- Session list pagination or virtualization is not introduced as part of this feature.
