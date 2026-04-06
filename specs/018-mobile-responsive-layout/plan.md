# Implementation Plan: Mobile-Responsive Layout

**Branch**: `018-mobile-responsive-layout` | **Date**: 2026-04-06 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/018-mobile-responsive-layout/spec.md`

## Summary

Add a responsive mobile layout to the Argus frontend using Tailwind CSS breakpoint utilities. Below 768px the dashboard switches from a fixed two-column layout to a single-column view with a persistent bottom tab bar ("Sessions" | "Tasks"). Tapping a session card on mobile navigates to the full session detail page (`/sessions/:id`) instead of opening the inline OutputPane. The desktop layout is unchanged. No backend changes required.

## Technical Context

**Language/Version**: TypeScript 5, React 18
**Primary Dependencies**: Tailwind CSS (responsive utilities), React Router v6, existing component library
**Storage**: N/A (pure layout change)
**Testing**: Vitest + React Testing Library
**Target Platform**: Browser (desktop and mobile)
**Project Type**: Single-page web application (frontend only)
**Performance Goals**: Layout reflow under 16ms (one paint frame); no new JS bundle weight beyond a small MobileNav component
**Constraints**: Must not change desktop visual output; 768px is the single breakpoint
**Scale/Scope**: 3 pages affected (DashboardPage, SessionPage, SessionCard); 1 new component (MobileNav)

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| §I User-first | PASS | Directly addresses broken mobile UX |
| §II Quality gates | PASS | Tests written first; build checked before commit |
| §III Code standards | PASS | New component is small; function extractions stay under 50 lines |
| §IV Test-first | PASS | Tests for MobileNav and DashboardPage mobile behaviour written before implementation |
| §V Security | PASS | No auth, no new data flows |
| §VI Performance | PASS | CSS-only breakpoints; no new network requests |
| §VII Observability | PASS | N/A for layout change |
| §VIII Simplicity | PASS | Tailwind responsive classes; no new state management library |
| §IX Iteration | PASS | Builds incrementally on existing Tailwind setup |
| §X Definition of Done | PASS | README update included in tasks |
| §XI Documentation | PASS | README.md updated in same PR |

## Project Structure

### Documentation (this feature)

```text
specs/018-mobile-responsive-layout/
├── plan.md              # This file
├── research.md          # Phase 0 decisions
├── tasks.md             # Task list
└── checklists/
    └── requirements.md
```

### Source Code (affected files)

```text
frontend/src/
├── components/
│   ├── MobileNav/
│   │   ├── MobileNav.tsx          # NEW: bottom tab bar (mobile only)
│   │   └── MobileNav.test.tsx     # NEW: unit tests
│   └── SessionCard/
│       └── SessionCard.tsx        # MODIFIED: accept onSelect override for mobile navigate
├── hooks/
│   └── useIsMobile.ts             # NEW: reactive matchMedia hook (< 768px)
├── pages/
│   ├── DashboardPage.tsx          # MODIFIED: mobile tab state, responsive layout
│   └── SessionPage.tsx            # MODIFIED: responsive padding + back button touch target
└── __tests__/
    └── DashboardPage.mobile.test.tsx  # NEW: mobile layout assertions
```
