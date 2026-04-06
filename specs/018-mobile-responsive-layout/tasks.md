# Tasks: Mobile-Responsive Layout

**Branch**: `018-mobile-responsive-layout`
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

---

## Phase 1 — Setup

Goal: Add the `useIsMobile` hook. No visual changes yet.

- [x] T001 [P1] [US1] Write failing tests for `useIsMobile` hook — verify it returns `true` when matchMedia matches `(max-width: 767px)` and `false` otherwise (`frontend/src/hooks/useIsMobile.test.ts`)
- [x] T002 [P1] [US1] Implement `useIsMobile` hook using `window.matchMedia('(max-width: 767px)')` with event listener cleanup (`frontend/src/hooks/useIsMobile.ts`)

---

## Phase 2 — Foundational: MobileNav component (CRITICAL GATE)

Goal: Build and test the bottom tab bar component in isolation before wiring it into pages.

- [x] T003 [P2] [US1] Write failing tests for `MobileNav` — renders "Sessions" and "Tasks" tabs, highlights active tab, calls `onTabChange` on tap (`frontend/src/components/MobileNav/MobileNav.test.tsx`)
- [x] T004 [P2] [US1] Implement `MobileNav` component — fixed bottom bar, two tabs with icons, `md:hidden`, accessible labels (`frontend/src/components/MobileNav/MobileNav.tsx`)

---

## Phase 3 — US1: Dashboard mobile layout

Goal: DashboardPage shows single-column sessions on mobile, with MobileNav, and session cards navigate to detail page on mobile.

- [x] T005 [P3] [US1] Write failing tests for DashboardPage mobile layout — at 390px viewport, sessions tab shows session list, tasks tab shows TodoPanel, no OutputPane rendered, session card click navigates to `/sessions/:id` (`frontend/src/__tests__/DashboardPage.mobile.test.tsx`)
- [x] T006 [P3] [US1] Add `activeMobileTab` state and `useIsMobile` to `DashboardPage`; on mobile pass `onSelect={id => navigate('/sessions/' + id)}` to SessionCards and hide the inline OutputPane (`frontend/src/pages/DashboardPage.tsx`)
- [x] T007 [P3] [US1] Add `MobileNav` to DashboardPage bottom; add `pb-16 md:pb-0` to main scrollable content area to prevent overlap with fixed tab bar (`frontend/src/pages/DashboardPage.tsx`)
- [x] T008 [P] [US1] Add `md:hidden` guard so right-panel (OutputPane + TodoPanel desktop column) is hidden below 768px (`frontend/src/pages/DashboardPage.tsx`)
- [x] T009 [P] [US2] Render `<TodoPanel />` in the Tasks tab content area on mobile (below the session list, shown only when `activeMobileTab === 'tasks'`) (`frontend/src/pages/DashboardPage.tsx`)

---

## Phase 4 — US3: Session detail page mobile layout

Goal: SessionPage renders comfortably on narrow screens.

- [ ] T010 [P4] [US3] Write failing test for SessionPage mobile layout — at 390px viewport, output stream and prompt bar render without horizontal overflow (`frontend/src/__tests__/SessionPage.mobile.test.tsx`)
- [ ] T011 [P4] [US3] Add responsive padding to SessionPage: `p-4 md:p-8`; increase back button touch target to `py-2`; ensure `max-w-4xl` container is full-width on mobile (`frontend/src/pages/SessionPage.tsx`)

---

## Phase 5 — Polish and cross-cutting

- [ ] T012 [P5] Run full test suite and fix any regressions: `cd frontend && npx vitest run`
- [ ] T013 [P5] Run frontend build: `npm run build --workspace=frontend`
- [ ] T014 [P5] Update `README.md` to note mobile browser support under the Features section
- [ ] T015 [P5] Manual smoke test at 390px and 1280px viewport widths — confirm no horizontal overflow at 390px and no visual change at 1280px

---

## Requirement Coverage

| Requirement | Tasks |
|-------------|-------|
| FR-001 single-column on mobile | T006, T007 |
| FR-002 no side-by-side on mobile | T008 |
| FR-003 session tap navigates to detail | T006 |
| FR-004 bottom tab bar Sessions/Tasks | T004, T007 |
| FR-005 44px touch targets | T004, T011 |
| FR-006 session detail single-column | T011 |
| FR-007 prompt bar visible on mobile | T011 |
| FR-008 desktop layout unchanged | T008, T012 |
| FR-009 reflow on resize | T002, T006 |
