# Implementation Plan: Session Detail UX Redesign

**Branch**: `006-session-detail-ux` | **Date**: 2026-04-02 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/006-session-detail-ux/spec.md`

## Summary

Redesign the session interaction UX from a separate full-page navigation model to an inline two-pane dashboard. Session cards gain quick-command buttons (Esc, Exit, Merge, Pull latest), an inline prompt input, and a last-output preview. Selecting a card opens a streaming output pane to the right of the card list. A new backend `interrupt` endpoint is added for the Esc command. The `ClaudeCodeDetector` is updated to capture the OS PID of the running Claude process and store it on the session record. The existing drill-in page (`/sessions/:id`) is retained and linked from each card.

## Technical Context

**Language/Version**: TypeScript 5.x (frontend React + Vite; backend Fastify + Node.js)
**Primary Dependencies**: React, TanStack Query, Tailwind CSS (frontend); Fastify, better-sqlite3, ps-list (backend)
**Storage**: SQLite via better-sqlite3 (sessions, output, control_actions tables)
**Testing**: Vitest + supertest (backend unit/contract); Playwright (frontend E2E)
**Target Platform**: Local developer tool — single user, localhost-only
**Project Type**: Web application (frontend + backend monorepo)
**Performance Goals**: Dashboard re-render < 100ms on session select; output pane streams updates in real time via polling
**Constraints**: ≥10 concurrent sessions supported; 500ms p95 API response (§VIII)
**Scale/Scope**: Single user, typically 2–10 active sessions simultaneously

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| §I Engineering — reliable, observable, debuggable | ✅ PASS | New interrupt endpoint + PID capture improve observability |
| §II Architecture — versioned API boundaries | ✅ PASS | New endpoint follows existing `/api/v1/sessions/:id/*` pattern |
| §III Code Standards — < 50 lines per function | ✅ PASS | New components will be broken into focused sub-components |
| §IV Test-First | ✅ PASS | Tests written before implementation (enforced in tasks) |
| §V Testing — unit + contract + E2E | ✅ PASS | All three tiers required in task plan |
| §VI Security — localhost exception applies | ✅ PASS | Single local user, localhost-only (declared in spec) |
| §VII Observability — requestId in errors | ✅ PASS | New endpoint follows existing error contract |
| §VIII Performance — 500ms p95 | ✅ PASS | New interrupt endpoint is lightweight; output pane uses existing output API |
| §XI Documentation — README updated same PR | ✅ PASS | README update task included |
| §XII Error Handling — structured errors, human-friendly UX | ✅ PASS | Frontend shows `message` field only; no raw blobs |

> **§XII**: Quick command errors on cards must display plain-language messages, not HTTP status codes or error codes.

## Project Structure

### Documentation (this feature)

```text
specs/006-session-detail-ux/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (speckit.tasks)
```

### Source Code (affected files)

```text
backend/
├── src/
│   ├── api/routes/sessions.ts         # ADD: POST /api/v1/sessions/:id/interrupt
│   ├── models/index.ts                # ADD: 'interrupt' to ControlActionType
│   └── services/
│       ├── claude-code-detector.ts    # FIX: capture OS PID, store on session
│       └── session-controller.ts     # ADD: interruptSession() method
└── tests/
    ├── contract/sessions.test.ts      # ADD: interrupt endpoint contract tests
    └── unit/claude-pid.test.ts        # ADD: PID capture unit tests

frontend/
├── src/
│   ├── components/
│   │   ├── SessionCard/
│   │   │   └── SessionCard.tsx        # REWRITE: quick commands, prompt input, last output preview
│   │   ├── QuickCommands/
│   │   │   └── QuickCommands.tsx      # NEW: Esc/Exit/Merge/Pull buttons
│   │   ├── InlinePrompt/
│   │   │   └── InlinePrompt.tsx       # NEW: compact prompt input on card
│   │   └── OutputPane/
│   │       └── OutputPane.tsx         # NEW: right-pane streaming output viewer
│   ├── pages/
│   │   └── DashboardPage.tsx          # MODIFY: two-pane layout, selectedSessionId state
│   └── services/api.ts               # ADD: interruptSession(), getLastOutput() helpers
└── tests/e2e/
    └── sc-006-session-ux.spec.ts      # NEW: E2E tests for new UX flows
```

## Complexity Tracking

No constitution violations found. No complexity justification required.
