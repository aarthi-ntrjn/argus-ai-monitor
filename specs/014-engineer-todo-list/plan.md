# Implementation Plan: Engineer Todo List on Dashboard

**Branch**: `014-engineer-todo-list` | **Date**: 2026-04-04 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/014-engineer-todo-list/spec.md`

## Summary

Add a persistent engineer todo list as a fixed sidebar panel on the Argus main dashboard. Engineers can add, complete/uncomplete, and delete reminder items. Items are stored via the existing Fastify/SQLite backend and retrieved via a new `/api/todos` REST endpoint. The feature includes a `user_id` field from day one to support future multi-user scenarios without a data migration.

## Technical Context

**Language/Version**: TypeScript 5.9 (frontend + backend)
**Primary Dependencies**: Fastify 5.x (backend), React 18 + TailwindCSS 3 + React Query (frontend), better-sqlite3 (storage), pino (logging), vitest + Playwright (testing)
**Storage**: SQLite via better-sqlite3 at `~/.argus/argus.db` — new `todos` table via runtime migration pattern
**Testing**: vitest (backend unit/contract), vitest + Testing Library (frontend unit), Playwright (E2E)
**Target Platform**: Localhost developer tool (single machine, single user)
**Project Type**: Web application — fullstack monorepo (backend/ + frontend/)
**Performance Goals**: API responses < 500ms p95 (easily met for local SQLite reads)
**Constraints**: Single-user localhost tool; §VIII scale exception applies — explicit concurrency target: ≥1 concurrent user
**Scale/Scope**: Single user, ≤1000 todo items per user (no enforced limit but UI scrolls)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| §I Engineering — reliable, observable, testable, reversible | ✅ PASS | Runtime migration is reversible; todos table is independently testable; structured logs on all mutations |
| §II Architecture — versioned API boundaries, no cross-DB access | ✅ PASS | Frontend uses `/api/todos` REST endpoint; no direct DB access from frontend |
| §III Code Standards — readable, functions < 50 lines, structured logs | ✅ PASS | Enforced in implementation; pino structured logging for all mutations |
| §IV Test-First — tests BEFORE implementation | ✅ PASS | Tasks ordered: write tests first, then implementation |
| §V Testing — unit + integration + E2E | ✅ PASS | Contract tests for API, component tests for UI, Playwright E2E for critical flows |
| §VI Security — auth/authz OR localhost exception | ✅ PASS (exception) | Service is localhost-only, single-user. §VI exception declared: no auth for v1. Audit trail via pino structured logs |
| §VII Observability — structured logs, metrics, health check | ✅ PASS | All CRUD mutations logged via pino with structured fields |
| §VIII Performance — p95 < 500ms; scale | ✅ PASS (exception) | §VIII exception: single-user localhost. Explicit target: ≥1 concurrent user |
| §IX AI Usage — no AI in architecture/security decisions | ✅ PASS | Architecture is human-defined in this plan |
| §X Definition of Done — code + tests + docs + README + metrics + security | ✅ PASS | All included in task list |
| §XI Documentation — README updated in same PR | ✅ PASS | README task included |
| §XII Error Handling — structured `{ error, message, requestId }` contract | ✅ PASS | Backend returns structured errors; frontend displays only `message` field |

> **§VI Exception declared**: This feature runs exclusively on `127.0.0.1` and serves a single local user. Network isolation is used in lieu of auth/authz for v1. This is valid per the §VI exception clause.

> **§VIII Exception declared**: This is a single-user localhost developer tool. Explicit concurrency target: ≥1 concurrent user (single session). The 10,000 concurrent user target does not apply.

## Project Structure

### Documentation (this feature)

```text
specs/014-engineer-todo-list/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── contracts/
│   └── todos-api.md     # Phase 1 output — REST API contract
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── db/
│   │   ├── schema.ts          # ADD: todos table definition
│   │   ├── database.ts        # ADD: todo CRUD functions
│   │   └── migrations/
│   │       └── 002-todos.sql  # NEW: migration reference file
│   ├── models/
│   │   └── index.ts           # ADD: TodoItem type
│   └── api/routes/
│       └── todos.ts           # NEW: Fastify route handlers
└── tests/
    └── contract/
        └── todos.test.ts      # NEW: contract tests (test-first)

frontend/
├── src/
│   ├── components/
│   │   └── TodoPanel/
│   │       ├── TodoPanel.tsx        # NEW: sidebar todo panel component
│   │       └── TodoPanel.test.tsx   # NEW: component tests (test-first)
│   ├── hooks/
│   │   └── useTodos.ts             # NEW: React Query hook for todos
│   └── services/
│       └── api.ts                  # ADD: todo API call functions
└── tests/
    └── e2e/
        └── todo-panel.spec.ts      # NEW: Playwright E2E tests
```

## Complexity Tracking

No constitution violations requiring justification. All exceptions declared above are explicitly covered by constitution §VI and §VIII exception clauses.
