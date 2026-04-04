# Tasks: User Onboarding Journey

**Input**: Design documents from `/specs/012-user-onboarding/`
**Prerequisites**: plan.md ✅ · spec.md ✅ · research.md ✅ · data-model.md ✅ · contracts/ ✅

**Library**: `react-joyride` v3 (MIT, WCAG 2.1 AA, React 18 optimised — see research.md)  
**Constitution §IV**: Tests MUST be written before implementation. No exceptions.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story label: [US1], [US2], [US3], [US4]

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install dependency and create scaffolding that all phases need.

- [X] T001 Install `react-joyride` npm dependency in `frontend/` workspace (`npm install react-joyride --workspace=frontend`)
- [X] T002 [P] Extend `frontend/src/types.ts` — add `OnboardingState`, `DashboardTourState`, `SessionHintsState`, `TourStep`, and `ContextualHint` interfaces per `data-model.md`
- [X] T003 [P] Create directory `frontend/src/components/Onboarding/` with empty barrel `frontend/src/components/Onboarding/index.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core storage service and hook that every user story depends on. No story work begins until this phase is complete.

**⚠️ CRITICAL**: All phases 3–6 depend on T007 being complete.

- [X] T004 [P] Write failing unit tests for `onboardingStorage` — cover: default state init, valid read, corrupt JSON fallback, unknown schemaVersion fallback, write, reset — in `frontend/tests/unit/onboardingStorage.test.ts`
- [X] T005 Implement `frontend/src/services/onboardingStorage.ts` — versioned localStorage read/write/reset per `contracts/onboarding-storage.md`; `argus:onboarding` key; silent fallback on `SecurityError`/`QuotaExceededError` (depends on T004)
- [X] T006 [P] Write failing unit tests for `useOnboarding` hook — cover: auto-launch flag, `startTour`, `skipTour`, `completeTour`, `dismissHint`, `resetOnboarding`, state persistence — in `frontend/tests/unit/useOnboarding.test.ts`
- [X] T007 Implement `frontend/src/hooks/useOnboarding.ts` — exposes `{ tourStatus, dismissedHints, startTour, skipTour, completeTour, dismissHint, resetOnboarding }`; reads/writes via `onboardingStorage`; calls event hooks from `onboardingEvents` (depends on T005, T006)
- [X] T008 [P] Create `frontend/src/services/onboardingEvents.ts` — export six named no-op stubs per `contracts/onboarding-events.md`: `onTourStarted`, `onTourCompleted`, `onTourSkipped`, `onStepAdvanced`, `onHintViewed`, `onHintDismissed`

**Checkpoint**: Run `npm run test --workspace=frontend` — all unit tests for storage and hook must pass before proceeding.

---

## Phase 3: User Story 1 — First-Time Dashboard Orientation (Priority: P1) 🎯 MVP

**Goal**: A brand-new user who opens Argus sees the guided tour auto-launch on the Dashboard, can advance through all 6 steps or skip at any point, and the completion/skip state is persisted so the tour does not re-launch.

**Independent Test**: Clear `argus:onboarding` from localStorage, reload Dashboard — welcome step appears. Advance all steps — tour completes and does not reappear on next reload. Repeat with Skip — same persistence behaviour.

- [X] T009 Write failing Playwright e2e test: first-time user sees tour auto-launch on Dashboard; advance all steps; verify tour marks complete and does not re-launch — in `frontend/tests/e2e/onboarding.spec.ts`
- [X] T010 Write failing Playwright e2e test: tour active, user clicks Skip — tour dismisses silently; app remains fully functional; tour does not re-launch on reload — in `frontend/tests/e2e/onboarding.spec.ts`
- [X] T011 [P] Create `frontend/src/config/dashboardTourSteps.ts` — export `DASHBOARD_TOUR_STEPS` array of 6 `TourStep` configs with `target` (`[data-tour-id="..."]`), `title`, `content`, `placement` per `data-model.md` step table
- [X] T012 Add `data-tour-id` attributes to 5 target elements in `frontend/src/pages/DashboardPage.tsx`: `dashboard-header` (h1), `dashboard-settings` (settings button), `dashboard-add-repo` (Add Repository button), `dashboard-repo-card` (first repo card wrapper), `dashboard-session-card` (first session card wrapper)
- [X] T013 Create `frontend/src/components/Onboarding/OnboardingTour.tsx` — wraps `react-joyride` `<Joyride />` with: WCAG 2.1 AA `locale` labels, `showSkipButton`, `continuous`, `scrollToFirstStep`, `spotlightClicks: false`; maps joyride `callback` to `skipTour`/`completeTour`/`onStepAdvanced`/`onTourStarted`/`onTourCompleted`/`onTourSkipped` from `useOnboarding` and `onboardingEvents` (depends on T007, T008, T011)
- [X] T014 Mount `<OnboardingTour />` in `frontend/src/pages/DashboardPage.tsx`; pass `run={tourStatus === 'not_started'}` and `steps={DASHBOARD_TOUR_STEPS}`; call `startTour({ trigger: 'auto' })` on mount when `tourStatus === 'not_started'` (depends on T012, T013)

**Checkpoint**: Run `npx playwright test tests/e2e/onboarding.spec.ts` — T009 and T010 tests must pass.

---

## Phase 4: User Story 2 — Session Detail Page Contextual Hints (Priority: P2)

**Goal**: A user visiting a session detail page for the first time sees 3 dismissible hint badges on key controls. Dismissing a hint persists globally and the hint does not reappear on any session page.

**Independent Test**: Navigate to any session detail page with no dismissed hints — all 3 badges visible. Hover/focus each badge — tooltip appears. Dismiss one — reload page — badge gone. Visit a different session — dismissed badge still absent.

- [X] T015 Write failing Playwright e2e test: first session page visit shows 3 hint badges; hover reveals tooltip; dismiss one badge; reload — badge absent; visit second session — badge still absent — in `frontend/tests/e2e/onboarding.spec.ts`
- [X] T016 [P] Create `frontend/src/config/sessionHints.ts` — export `SESSION_HINTS` array of 3 `ContextualHint` configs: `session-status`, `session-prompt-bar`, `session-output-stream` with `label`, `ariaLabel`, `placement` per `data-model.md`
- [X] T017 Add `data-tour-id` attributes to 3 target elements in `frontend/src/pages/SessionPage.tsx`: `session-status` (status badge span), `session-prompt-bar` (SessionPromptBar wrapper div), `session-output-stream` (Output Stream h2 / panel header)
- [X] T018 Create `frontend/src/components/Onboarding/OnboardingHints.tsx` — renders a `?` badge button (`role="button"`, `aria-label`, `aria-describedby`) adjacent to its target; tooltip shown on hover/focus (`role="tooltip"`); close button dismisses (`Escape` key + click); calls `onHintViewed` and `onHintDismissed` from `onboardingEvents`; full keyboard access per WCAG 2.1 AA (depends on T007, T008, T016)
- [X] T019 Mount `<OnboardingHints hints={SESSION_HINTS} />` in `frontend/src/pages/SessionPage.tsx`; pass `dismissedHints` from `useOnboarding` and `dismissHint` callback; skip rendering hints whose ID is in `dismissedHints` (depends on T017, T018)

**Checkpoint**: Run `npx playwright test tests/e2e/onboarding.spec.ts` — T015 test must pass.

---

## Phase 5: User Story 3 — Replay Onboarding Tour On Demand (Priority: P2)

**Goal**: A returning user (tour completed or skipped) can trigger "Restart Tour" from the Settings panel, replaying the full Dashboard tour from step 1.

**Independent Test**: Complete or skip tour so it does not auto-launch. Open Settings panel. Click "Restart Tour". Tour replays from step 1 identically to first-time experience. Complete replayed tour — completion state preserved.

- [X] T020 Write failing Playwright e2e test: after tour completion, open Settings, click "Restart Tour" — tour replays from step 1; completing replayed tour preserves completion state — in `frontend/tests/e2e/onboarding.spec.ts`
- [X] T021 Add `onRestartTour: () => void` prop to `SettingsPanel` interface and render a "Restart Tour" button at the bottom of `frontend/src/components/SettingsPanel/SettingsPanel.tsx`
- [X] T022 Wire `onRestartTour` in `frontend/src/pages/DashboardPage.tsx` — call `startTour({ trigger: 'manual' })` from `useOnboarding` and close settings panel (depends on T021)

**Checkpoint**: Run `npx playwright test tests/e2e/onboarding.spec.ts` — T020 test must pass.

---

## Phase 6: User Story 4 — Onboarding Progress Reset (Priority: P3)

**Goal**: Any user can reset their onboarding state via the Settings panel, making the first-time tour auto-launch again on the next Dashboard load.

**Independent Test**: With tour completed, open Settings, click "Reset Onboarding". Reload Dashboard — first-time welcome step appears. Tour can be completed again.

- [X] T023 Write failing Playwright e2e test: user with completed tour opens Settings, clicks "Reset Onboarding", reloads Dashboard — tour auto-launches from step 1 — in `frontend/tests/e2e/onboarding.spec.ts`
- [X] T024 Add `onResetOnboarding: () => void` prop to `SettingsPanel` interface and render a "Reset Onboarding" button (visually distinct — e.g. secondary/ghost style) in `frontend/src/components/SettingsPanel/SettingsPanel.tsx`
- [X] T025 Wire `onResetOnboarding` in `frontend/src/pages/DashboardPage.tsx` — call `resetOnboarding()` from `useOnboarding` and close settings panel (depends on T024)

**Checkpoint**: Run `npx playwright test tests/e2e/onboarding.spec.ts` — all onboarding e2e tests must pass.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Edge case handling, WCAG audit, barrel exports, and documentation.

- [X] T026 [P] [US1] Handle tour navigate-away edge case in `frontend/src/components/Onboarding/OnboardingTour.tsx` — listen to React Router location changes via `useLocation`; if location changes while tour is running, call `skipTour('navigation')` so tour dismisses silently per FR-011
- [X] T027 [P] [US1] Handle not-yet-rendered tour target (FR-010) in `frontend/src/components/Onboarding/OnboardingTour.tsx` — use joyride's `disableOverlay` + `disableScrollParentFix` safe defaults and verify each `data-tour-id` element exists before calling `run`; skip gracefully if missing
- [X] T028 [P] WCAG 2.1 AA audit pass across all Onboarding components — verify: focus trapped in joyride tooltip (`tabIndex`), `Escape` dismisses hints, all interactive elements have `aria-label`, Tailwind `focus:ring` visible on tour nav buttons, focus returns to triggering element on tour end — update `frontend/src/components/Onboarding/OnboardingTour.tsx` and `OnboardingHints.tsx` as needed
- [X] T029 Update barrel export `frontend/src/components/Onboarding/index.ts` — re-export `OnboardingTour` and `OnboardingHints`
- [X] T030 Update `README.md` — add "Onboarding" section documenting: feature overview, `react-joyride` dependency, `data-tour-id` targeting convention, developer reset instructions (`localStorage.removeItem('argus:onboarding')`), and link to `specs/012-user-onboarding/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup)
    └── Phase 2 (Foundational) — BLOCKS ALL USER STORIES
            ├── Phase 3 (US1 · P1) ← MVP
            ├── Phase 4 (US2 · P2)
            ├── Phase 5 (US3 · P2)
            └── Phase 6 (US4 · P3)
                    └── Phase 7 (Polish)
```

### User Story Dependencies

| Story | Depends On | Can Parallelise With |
|-------|-----------|---------------------|
| US1 (P1) | Phase 2 complete | US2, US3, US4 (after Phase 2) |
| US2 (P2) | Phase 2 complete | US1, US3, US4 (after Phase 2) |
| US3 (P2) | Phase 2 complete; US1 SettingsPanel mount in place | — |
| US4 (P3) | Phase 2 complete; SettingsPanel wired | — |

### Within Each Phase

1. Tests MUST be written first (§IV Constitution) and confirmed failing before implementation
2. Config/types tasks `[P]` may run alongside test writing
3. Component implementation after storage/hook foundation (T007)
4. Mount/integration tasks after component creation

---

## Parallel Example: Phase 2 (Foundational)

```
T004 [write storage tests]  ─┐
T006 [write hook tests]     ─┤  Parallel start
T008 [create events stubs]  ─┘

Then:
T005 [implement storage]    ← after T004 passes
T007 [implement hook]       ← after T005 + T006 pass
```

## Parallel Example: Phase 3 (US1)

```
T009 [e2e test: complete]   ─┐
T010 [e2e test: skip]       ─┤  Parallel start
T011 [tour step configs]    ─┘

Then (all depend on tests + T011):
T012 [add data-tour-id attrs]
T013 [OnboardingTour component]
T014 [mount in DashboardPage]   ← after T012 + T013
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T003)
2. Complete Phase 2: Foundational (T004–T008) ← CRITICAL BLOCKER
3. Complete Phase 3: US1 Dashboard Tour (T009–T014)
4. **STOP and VALIDATE**: Clear localStorage, reload — tour auto-launches and completes ✅
5. Demo-ready: A new user gets the full Dashboard orientation experience

### Incremental Delivery

1. Phases 1–2 → Storage + hook foundation ready
2. Phase 3 (US1) → Dashboard tour working → **MVP demo**
3. Phase 4 (US2) → Session page hints working → richer onboarding
4. Phase 5 (US3) → Restart Tour in settings → returning user support
5. Phase 6 (US4) → Reset in settings → full self-service
6. Phase 7 → Polish, WCAG audit, README → production-ready

### Task Summary

| Phase | Tasks | Parallel Opportunities |
|-------|-------|----------------------|
| Phase 1: Setup | T001–T003 | T002, T003 parallel |
| Phase 2: Foundational | T004–T008 | T004, T006, T008 parallel |
| Phase 3: US1 (P1) 🎯 | T009–T014 | T009, T010, T011 parallel |
| Phase 4: US2 (P2) | T015–T019 | T016 parallel with T015 |
| Phase 5: US3 (P2) | T020–T022 | — |
| Phase 6: US4 (P3) | T023–T025 | — |
| Phase 7: Polish | T026–T030 | T026, T027, T028, T029 parallel |
| **Total** | **30 tasks** | |

---

## Notes

- `[P]` = different files, no incomplete dependencies — safe to parallelise
- `[Story]` label maps task to user story for independent traceability
- Constitution §IV is non-negotiable: every implementation task has a preceding test task
- `argus:onboarding` localStorage key follows established `argus:` namespace convention (`argus:settings`, `argus:skipRemoveConfirm`)
- `data-tour-id` attributes are invisible to end users and decouple tour config from CSS class names
- Commit after each completed checkpoint (Phase 2, end of each US phase)
