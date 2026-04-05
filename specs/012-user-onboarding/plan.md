# Implementation Plan: User Onboarding Journey

**Branch**: `012-user-onboarding` | **Date**: 2026-04-04 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/012-user-onboarding/spec.md`

## Summary

Add a guided onboarding tour and contextual hint system to the Argus frontend. First-time users receive an auto-launched step-by-step tour of the Dashboard (highlighting the Settings button, Add Repository button, repository cards, session cards, and output pane). A contextual hint system overlays key controls on the Session detail page (status badges, SessionPromptBar, output stream). All onboarding state is persisted to localStorage with a forward-compatible schema. The tour library is selected in Phase 0 research. All interactions must meet WCAG 2.1 AA. Analytics hook points are exposed but not wired in v1.

## Technical Context

**Language/Version**: TypeScript 5.9 / React 18.3  
**Primary Dependencies**: React Router DOM v6, TanStack Query v5, TailwindCSS 3.4, Vite 8, lucide-react, **react-joyride 3.x** (guided tour — MIT, WCAG 2.1 AA, React 18 optimised)  
**Storage**: Browser localStorage (client-side only; no backend changes)  
**Testing**: Vitest 3 (unit), Playwright 1.59 (e2e)  
**Target Platform**: Desktop and tablet browsers (Chrome, Firefox, Safari, Edge); mobile out of scope for v1  
**Project Type**: Web application (frontend-only change)  
**Performance Goals**: Tour overlay render < 100ms; no perceptible layout shift on step transition  
**Constraints**: WCAG 2.1 AA required; no new backend endpoints; localStorage schema must be forward-compatible with per-account storage migration  
**Scale/Scope**: 2 pages (Dashboard, Session detail); ~6 tour steps on Dashboard; ~3 contextual hints on Session page

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| §I Engineering — testable in isolation | ✅ PASS | Onboarding state is a pure client-side module; tour logic isolated in `useOnboarding` hook |
| §I Engineering — reversible | ✅ PASS | Onboarding is fully opt-out; skipping/dismissing leaves app fully functional |
| §II Architecture — clear API boundaries | ✅ PASS | No new service boundaries; all client-side |
| §III Code Standards — functions < 50 lines | ✅ PASS | Hook + step config pattern keeps units small |
| §IV Test-First | ✅ PASS | Tests must be written before implementation (tracked in tasks.md) |
| §V Testing — unit + e2e | ✅ PASS | Unit tests for hook logic; Playwright e2e for tour flow |
| §VI Security — auth/audit | ✅ PASS | No auth surface; localStorage stores no sensitive data |
| §VII Observability | ✅ PASS | FR-013 hook points enable future metrics; no structured server logs needed (frontend-only) |
| §VIII Performance | ✅ PASS | Single-user desktop tool; 10k concurrent user target exempt per §VIII exception |
| §X Definition of Done | ⚠️ REQUIRED | Tests, docs, and README update must be included in same PR |
| §XI Documentation | ⚠️ REQUIRED | README.md must be updated in same PR — include README task |
| §XII Error Handling | ✅ PASS | localStorage errors handled gracefully; tour degrades silently (FR stated) |

> **§XI Documentation**: README.md MUST be updated in the same PR. A README update task is included in tasks.md.

## Project Structure

### Documentation (this feature)

```text
specs/012-user-onboarding/
├── plan.md              # This file
├── research.md          # Phase 0 output — library selection
├── data-model.md        # Phase 1 output — OnboardingState schema
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output — localStorage contract, event hooks contract
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
frontend/
├── src/
│   ├── components/
│   │   └── Onboarding/
│   │       ├── OnboardingTour.tsx          # Tour wrapper (renders library provider + steps)
│   │       ├── OnboardingHints.tsx         # Contextual hint badges for session page
│   │       └── index.ts
│   ├── hooks/
│   │   └── useOnboarding.ts               # State + event hook points + localStorage I/O
│   ├── services/
│   │   └── onboardingStorage.ts           # localStorage read/write with schema versioning
│   ├── config/
│   │   ├── dashboardTourSteps.ts          # Step definitions for Dashboard tour
│   │   └── sessionHints.ts                # Hint definitions for Session page
│   ├── pages/
│   │   ├── DashboardPage.tsx              # Modified: mount OnboardingTour
│   │   └── SessionPage.tsx                # Modified: mount OnboardingHints
│   └── types.ts                           # Extended: OnboardingState, TourStep, ContextualHint
├── tests/
│   ├── unit/
│   │   ├── useOnboarding.test.ts
│   │   └── onboardingStorage.test.ts
│   └── e2e/
│       └── onboarding.spec.ts             # Playwright: first-time tour, skip, replay, hints
└── README.md                              # Updated: onboarding feature section
```

**Structure Decision**: Frontend-only change. New `Onboarding/` component directory follows existing component folder convention (e.g., `SessionCard/`, `OutputPane/`). Hook follows existing `useSettings` pattern. Storage service mirrors localStorage usage already present in the codebase (`SKIP_REMOVE_CONFIRM_KEY` pattern in DashboardPage).

## Complexity Tracking

> No constitution violations requiring justification.
