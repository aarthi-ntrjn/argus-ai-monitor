# Research: Mobile-Responsive Layout

## Decision 1: Breakpoint value

**Decision**: 768px (`md:` in Tailwind CSS default config)
**Rationale**: Tailwind's built-in `md:` breakpoint is 768px and maps cleanly to the iPad mini landscape width — the natural boundary between phone/narrow and tablet/desktop. No custom breakpoint config needed.
**Alternatives considered**: 640px (`sm:`) — rejected as too narrow; some large phones (e.g. iPhone Pro Max in landscape) would get the mobile layout unnecessarily.

## Decision 2: Mobile navigation pattern

**Decision**: Bottom tab bar with "Sessions" and "Tasks" tabs, rendered as a fixed element at the bottom of the viewport on mobile only (`md:hidden`).
**Rationale**: Standard mobile pattern for two peer views. Makes both views immediately discoverable. Selected by user in clarification (Option A).
**Alternatives considered**: Floating action button — rejected because FABs imply "create new item" semantics, which would be confusing here. Always-visible stacked layout — rejected because the TodoPanel would be buried below a long session list.

## Decision 3: Session card tap behaviour on mobile

**Decision**: On mobile, `onSelect` is replaced by a `navigate('/sessions/:id')` call. The DashboardPage passes a mobile-aware handler when `useIsMobile()` returns true.
**Rationale**: The inline OutputPane is a desktop convenience that requires the two-column layout. On mobile, the full session detail page provides equivalent functionality. Clarified by user: "no need for output pane on mobile, just open the session details pane".
**Alternatives considered**: Rendering the OutputPane in a modal on mobile — rejected as over-engineered; the existing SessionPage already provides the full view.

## Decision 4: Detecting mobile in React

**Decision**: `useIsMobile` hook using `window.matchMedia('(max-width: 767px)')` with a `resize` listener to update reactively.
**Rationale**: Pure CSS breakpoints alone cannot change React component behavior (e.g., which `onSelect` handler is passed). A lightweight hook that reads the same breakpoint as Tailwind avoids duplicating layout logic in JS.
**Alternatives considered**: CSS-only approach with pointer-events tricks — rejected as fragile. A third-party library like `react-responsive` — rejected to avoid adding a dependency for a simple matchMedia wrapper.

## Decision 5: Bottom padding on mobile to avoid tab bar overlap

**Decision**: Add `pb-16 md:pb-0` to the main scrollable content area so the last session card is never hidden behind the fixed 64px tab bar.
**Rationale**: Fixed bottom nav bars overlap content at the bottom of the page without explicit padding compensation.
