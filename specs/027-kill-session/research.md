# Research: Kill Session Button

**Feature**: 027-kill-session
**Date**: 2026-04-12

## Phase 0 Decisions

### R-001: Confirmation Dialog Pattern

**Decision**: Create a standalone `KillSessionDialog` component following the same pattern as the existing `YoloWarningDialog`.

**Rationale**: The `YoloWarningDialog` already establishes the project's dialog conventions: a modal overlay with `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, a title, description, Cancel button, and a destructive-action confirm button. Reusing this pattern ensures UI consistency and avoids introducing a dialog library.

**Alternatives considered**:
- Generic reusable `ConfirmDialog` component: Adds abstraction for only two dialogs in the app. Not worth the complexity.
- Browser `window.confirm()`: No custom styling, no ability to show session details, poor accessibility.
- Inline confirmation (toggle button text to "Are you sure?"): Saves space but provides no context about which session will be killed.

### R-002: Kill Button Placement

**Decision**: Add the kill button to `SessionMetaRow` (next to the existing "View Details" link icon), controlled by an `onKill` callback prop. When `onKill` is provided, the kill icon button renders. The same component is used on both the dashboard card and the session detail page.

**Rationale**: `SessionMetaRow` already renders the action area (the `showLink` prop controls the View Details link). Adding the kill button here means both the card and detail page get it automatically through the same component. The `onKill` prop keeps the component stateless regarding the kill operation.

**Alternatives considered**:
- Adding kill button directly to `SessionCard`: Would not cover the session detail page. Duplicates logic.
- Creating a separate `SessionActions` component: Over-engineering for one additional button.
- Adding to `SessionPromptBar`: Only shows for PTY sessions, not all sessions with PIDs.

### R-003: State Management for Kill Operation

**Decision**: Create a `useKillSession` custom hook that wraps `useMutation` from TanStack React Query. The hook manages loading, success, and error states, and calls `stopSession()` from the API service. The hook also handles React Query cache invalidation to refresh session status after a successful kill.

**Rationale**: TanStack React Query's `useMutation` provides built-in `isPending`, `isError`, `error`, and `reset()` capabilities, which map directly to the spec requirements for loading states (FR-008), error display (FR-009), and retry (edge case). The existing codebase already uses React Query extensively.

**Alternatives considered**:
- Manual `useState` for loading/error: More code, loses React Query's built-in retry and cache invalidation.
- Global state (context/store): Overkill for a per-session transient operation.

### R-004: Button Visibility Logic

**Decision**: The kill button renders only when all conditions are met: (1) session status is not `ended` or `completed`, (2) session has a non-null `pid`, and (3) an `onKill` callback is provided. The button is disabled (not hidden) while the kill request is in progress.

**Rationale**: Hiding the button for non-killable sessions avoids confusion. Disabling (rather than hiding) during the loading state prevents layout shift and communicates that the action is in progress. This aligns with FR-003, FR-008, FR-011, and FR-012.

**Alternatives considered**:
- Always showing the button but disabled for non-killable sessions: Could confuse users about why it's disabled without tooltips.
- Hiding during loading: Causes layout shift in the header row.
