# Implementation Plan: Dashboard Settings

**Branch**: `005-dashboard-settings` | **Date**: 2026-04-01 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/005-dashboard-settings/spec.md`

## Summary

Add a settings panel to the Argus dashboard. The first setting is a "Show ended sessions" toggle (default: on). When toggled off, sessions with status `completed` or `ended` are hidden from all repository cards. The preference is persisted to `localStorage` and restored on page load. The panel is accessible via a gear icon in the dashboard header and is designed to accommodate future settings. This is a **frontend-only change**  no backend modifications required.

## Technical Context

**Language/Version**: TypeScript 5.5 / React 18.3
**Primary Dependencies**: React, TanStack React Query 5, Tailwind CSS 3, React Router 6
**Storage**: `localStorage` (client-side only, no backend)
**Testing**: Playwright (E2E), vitest + supertest (backend unit/contract  not touched)
**Target Platform**: Desktop/tablet browser (localhost)
**Project Type**: Web application (frontend + backend monorepo)
**Performance Goals**: Toggle takes effect instantly (< 16ms, single re-render)
**Constraints**: No new npm dependencies; use existing Tailwind + React patterns
**Scale/Scope**: Single-user localhost tool; 1 settings panel, initially 1 setting

## Constitution Check

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I Engineering |  | Pure filter + localStorage; simple, reversible |
| II Architecture |  N/A | No inter-service communication |
| III Code Standards |  | Settings hook < 50 lines; self-documenting |
| IV Test-First |  | E2E test written before implementation |
| V Testing |  | E2E test covers primary flows |
| VI Security |  | VI exception applies (localhost single-user) |
| VII Observability |  N/A | No new API endpoints; no tracing required |
| VIII Performance |  | Instant client-side filter; no API call |
| IX AI Usage |  | Human reviews all AI output |
| X Definition of Done |  | Tests, docs, README all planned |
| XI Documentation |  | README update task included |
| XII Error Handling |  | localStorage fallback to default; no API calls to fail |

> **VI Exception**: Settings are stored client-side on a single-user localhost tool. No auth required.

**Gate result: PASS   no violations.**

## Project Structure

### Documentation (this feature)

```text
specs/005-dashboard-settings/
 plan.md              # This file
 research.md          # Phase 0 (no unknowns  inline below)
 data-model.md        # Phase 1 output
 quickstart.md        # Phase 1 output
 tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code

```text
frontend/
 src/
    components/
       SettingsPanel/
           SettingsPanel.tsx       # NEW  settings popover/panel component
           index.ts                # NEW  barrel export
    hooks/
       useSettings.ts             # NEW  settings state + localStorage persistence
    pages/
       DashboardPage.tsx          # MODIFIED  wire settings hook + filter sessions
    types.ts                       # MODIFIED  add DashboardSettings type
frontend/
 tests/
     e2e/
         sc-005-settings-filter.spec.ts  # NEW  E2E test for show/hide ended sessions

README.md                               # MODIFIED  document settings feature
```

## Research Notes (Phase 0)

No unknowns found  all resolved from existing codebase:

| Question | Answer |
|----------|--------|
| Which statuses count as "ended"? | `'completed'` and `'ended'` (from `SessionStatus` in `types.ts`) |
| Existing localStorage key pattern | `argus:skipRemoveConfirm`  new key will be `argus:showEndedSessions` |
| Existing settings infrastructure | None  will create `useSettings` hook as the foundation |
| Settings panel pattern | No existing pattern  use Tailwind-styled popover anchored to gear icon |
| No new npm dependencies needed | Confirmed  Tailwind + React cover all UI needs |

## Complexity Tracking

No constitution violations  no entries required.
