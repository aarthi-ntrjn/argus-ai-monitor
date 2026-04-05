# Quickstart: User Onboarding Journey

**Branch**: `012-user-onboarding` | **Date**: 2026-04-04

## What This Feature Adds

- **Guided Dashboard Tour**: A step-by-step overlay tour that auto-launches for first-time users, highlighting six key UI areas with anchored tooltips.
- **Session Page Contextual Hints**: Three dismissible hint badges on the Session detail page, explaining status indicators, the prompt/control bar, and the output stream.
- **Replay Tour**: A "Restart Tour" option accessible from the Settings panel allows any user to replay the tour.
- **Reset Onboarding**: A "Reset Onboarding" option in Settings clears all onboarding state, restoring the first-time experience.

## Developer Setup

Install the new dependency:

```bash
npm install react-joyride --workspace=frontend
```

## Key Files

| File | Purpose |
|------|---------|
| `frontend/src/hooks/useOnboarding.ts` | Central hook — reads/writes state, exposes tour controls |
| `frontend/src/services/onboardingStorage.ts` | localStorage read/write with schema versioning |
| `frontend/src/services/onboardingEvents.ts` | Analytics hook point stubs (FR-013) |
| `frontend/src/components/Onboarding/OnboardingTour.tsx` | `react-joyride` wrapper for the Dashboard tour |
| `frontend/src/components/Onboarding/OnboardingHints.tsx` | Custom hint badge component for Session page |
| `frontend/src/config/dashboardTourSteps.ts` | Static step definitions for Dashboard tour |
| `frontend/src/config/sessionHints.ts` | Static hint definitions for Session page |

## Adding Tour Target Attributes

Each Dashboard element highlighted in the tour needs a `data-tour-id` attribute:

```tsx
// DashboardPage.tsx — header
<h1 data-tour-id="dashboard-header" className="text-3xl font-semibold text-gray-900">
  Argus Dashboard
</h1>

// Add Repository button
<button data-tour-id="dashboard-add-repo" onClick={handleAddRepo} ...>
  Add Repository
</button>
```

## How Onboarding State Is Read

```typescript
import { useOnboarding } from '../hooks/useOnboarding';

const { tourStatus, dismissedHints, startTour, skipTour, completeTour, dismissHint, resetOnboarding } = useOnboarding();
```

## Resetting Onboarding State (Manual / Testing)

Via Settings UI: Settings → "Reset Onboarding" button.

Via browser console (dev):
```javascript
localStorage.removeItem('argus:onboarding');
location.reload();
```

## Running Tests

```bash
# Unit tests
npm run test --workspace=frontend

# E2E tests (onboarding flow)
npx playwright test tests/e2e/onboarding.spec.ts
```

## Architecture Decisions

See [research.md](./research.md) for library selection rationale.  
See [data-model.md](./data-model.md) for the OnboardingState schema.  
See [contracts/](./contracts/) for localStorage and event hook contracts.
