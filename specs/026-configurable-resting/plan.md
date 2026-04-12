# Implementation Plan: Configurable Resting Duration

**Branch**: `026-configurable-resting` | **Date**: 2026-04-11 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/026-configurable-resting/spec.md`

## Summary

Add a user-configurable "resting threshold" (minutes) to the existing `DashboardSettings` store. The threshold controls when a session is classified as inactive/resting. The current hardcoded 20-minute constant becomes the default for a localStorage-persisted setting. The control is a number input inside the existing `SettingsPanel` dropdown, next to the "Hide inactive sessions" checkbox. No backend changes are needed.

## Technical Context

**Language/Version**: TypeScript 5.x, React 18
**Primary Dependencies**: React, Tailwind CSS, Vitest, Playwright
**Storage**: `localStorage` via the existing `useSettings` hook (`argus:settings` key)
**Testing**: Vitest (unit), Playwright (e2e)
**Target Platform**: Browser (Electron + web)
**Project Type**: Frontend-only change (no backend, no API changes)
**Performance Goals**: Setting reads are synchronous localStorage; no meaningful perf impact
**Constraints**: Must not break existing `isInactive` callers; default must remain 20 minutes
**Scale/Scope**: Single-user local tool; no concurrency concerns

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| §I Engineering (reliable, testable, reversible) | PASS | Pure frontend; default preserved; easily removed |
| §II Architecture (versioned API boundaries) | N/A | No new services or APIs |
| §III Code Standards (<50 lines, self-documenting) | PASS | All new functions are small |
| §IV Test-First | MUST FOLLOW | Tests written before implementation in each phase |
| §V Testing (unit + e2e) | PASS | Unit tests for hook/utils/component; e2e for settings interaction |
| §VI Security | EXCEPTION | Local developer tool bound to localhost |
| §VII Observability | N/A | UI-only preference; no new server-side observability needed |
| §VIII Performance | EXCEPTION | Single-user localhost tool |
| §IX AI Usage | PASS | Human review on all AI-generated code |
| §X Definition of Done | TRACKED | All DoD items in tasks |
| §XI Documentation | MUST UPDATE | README.md must document new setting |
| §XII Error Handling | PASS | Inline validation; human-friendly error messages |

## Project Structure

### Documentation (this feature)

```text
specs/026-configurable-resting/
├── plan.md              (this file)
├── research.md
├── data-model.md
├── contracts/
│   └── settings-contract.md
└── tasks.md
```

### Source Code (changes only)

```text
frontend/src/
├── types.ts                                  # Add restingThresholdMinutes to DashboardSettings
├── utils/
│   └── sessionUtils.ts                       # isInactive accepts optional thresholdMs param
├── components/
│   ├── SettingsPanel/
│   │   └── SettingsPanel.tsx                 # Add threshold number input + reset button
│   ├── SessionCard/
│   │   └── SessionCard.tsx                   # Pass threshold from useSettings to isInactive
│   └── SessionMetaRow/
│       └── SessionMetaRow.tsx                # Pass threshold from useSettings to isInactive
└── pages/
    └── DashboardPage.tsx                     # Pass threshold when filtering sessions

frontend/src/__tests__/
├── sessionUtils.test.ts                      # Update + extend threshold tests
├── SettingsPanel.test.tsx                    # Add threshold input/validation/reset tests
└── useSettings.test.ts                       # Add restingThresholdMinutes default test

frontend/tests/e2e/
└── sc-026-resting-threshold.spec.ts          # New e2e: change threshold, verify session state

README.md                                     # Document restingThresholdMinutes setting
```

**Structure Decision**: Web application (frontend only). No backend directories involved.
