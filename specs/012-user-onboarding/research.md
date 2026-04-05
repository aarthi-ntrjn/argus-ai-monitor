# Phase 0 Research: User Onboarding Journey

**Branch**: `012-user-onboarding` | **Date**: 2026-04-04

## Library Selection

### Decision: `react-joyride` (v3.x)

**Rationale**: Best overall fit for the Argus frontend stack (React 18, TypeScript, TailwindCSS, Vite, React Router v6). Only candidate meeting all mandatory requirements simultaneously.

**Mandatory requirements met**:
- ✅ MIT license — no commercial licensing concern
- ✅ WCAG 2.1 AA — focus trapping, keyboard navigation, ARIA attributes, screen-reader support
- ✅ React 18 — explicit fixes for concurrent rendering (March 2026 patch)
- ✅ TypeScript-first — full `.d.cts` type exports, written in TypeScript
- ✅ React Router v6 / SPA — component-based, no page reload dependency
- ✅ TailwindCSS — CSS modules approach, no CSS-in-JS conflicts
- ✅ Rich event hooks — `callback` prop covers all FR-013 hook points (tour started, completed, skipped, step advanced, etc.)
- ✅ Actively maintained — April 2026 release (v3.0.2)

**Package**: `react-joyride` | **Bundle**: ~30KB min+gz | **Stars**: ~7,700

### Alternatives Considered

| Library | Score | Why Rejected |
|---------|-------|--------------|
| Driver.js | 7.5/10 | No ARIA/WCAG support; accessibility is non-negotiable (FR-012) |
| Shepherd.js | 6.5/10 | AGPL-3.0 license; CSS-in-JS conflicts TailwindCSS |
| Reactour | 6/10 | Limited event hooks; weaker accessibility; fewer active maintainers |
| Intro.js | 3/10 | AGPL-3.0 license; vanilla JS (no React hooks); SPA routing workarounds required |

---

## LocalStorage Schema Design

### Decision: Versioned schema under a single namespace key

**Rationale**: A versioned wrapper allows forward-compatible migration to a per-account backend storage model without breaking existing client data. All onboarding state is stored under one key to minimise read operations and enable atomic state updates.

**Storage key**: `argus:onboarding`

**Schema (v1)**:
```json
{
  "schemaVersion": 1,
  "userId": null,
  "dashboardTour": {
    "status": "not_started | completed | skipped",
    "completedAt": "ISO8601 | null",
    "skippedAt": "ISO8601 | null"
  },
  "sessionHints": {
    "dismissed": ["hint-id-1", "hint-id-2"]
  }
}
```

**Migration path (v2, future)**: When per-account storage is introduced, a migration reads the `v1` localStorage blob and POSTs it to a user profile API on first authenticated load. The `userId` field (currently `null`) will carry the account ID once auth is added, enabling the migration service to detect first-time migration.

---

## Tour Step Targeting Strategy

### Decision: CSS class selectors with `data-tour-id` attributes on target elements

**Rationale**: Stable, semantic selectors decouple tour step configuration from component implementation details. Using `data-tour-id` attributes (e.g., `data-tour-id="dashboard-add-repo"`) avoids fragile class-name coupling and is invisible to end users.

**Alternative rejected**: Dynamic ref-based targeting — requires plumbing refs through many component layers; adds complexity for no additional benefit.

---

## Analytics Hook Points

### Decision: Named callback constants in `onboardingEvents.ts`

**Rationale**: Centralising event name constants makes future analytics wiring a one-file change. The `react-joyride` `callback` prop receives a `CallBackProps` object with `type` and `status` fields that map cleanly onto the required hook points.

**Hook points to expose (FR-013)**:
| Hook Event | Joyride Trigger |
|-----------|----------------|
| `tour:started` | `type === EVENTS.TOUR_START` |
| `tour:completed` | `type === EVENTS.TOUR_END && status === STATUS.FINISHED` |
| `tour:skipped` | `type === EVENTS.TOUR_END && status === STATUS.SKIPPED` |
| `step:advanced` | `type === EVENTS.STEP_AFTER && action === ACTIONS.NEXT` |
| `hint:viewed` | Custom: badge hover/tap interaction |
| `hint:dismissed` | Custom: dismiss button click |

---

## Contextual Hint Implementation

### Decision: Custom React component (not a second tour library)

**Rationale**: Contextual hints on the session page are simpler than a guided tour — they are static, independently dismissible badges. Implementing them as a lightweight custom component (`OnboardingHints.tsx`) avoids pulling in a second library and keeps the bundle lean. Each hint is a small `?` badge rendered adjacent to its target element; the tooltip uses a CSS/Tailwind-only implementation (no Floating UI dependency needed at this scale).

---

## WCAG 2.1 AA Implementation Notes

- `react-joyride` natively handles focus trapping within the tooltip and returns focus to the trigger element on tour end/skip.
- All `data-tour-id` target elements must already be keyboard-accessible (they are — existing buttons and interactive elements).
- Custom `OnboardingHints` badge components must use `role="tooltip"`, `aria-label`, and keyboard-dismissible pattern (`Escape` key or `Enter`/`Space` on close button).
- Tour skip/close controls must have visible focus indicators (enforced via Tailwind `focus:ring` utilities).
