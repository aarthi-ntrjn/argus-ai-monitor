# Implementation Plan: Session Stream Legibility, Model Display & Claude Code Fixes

**Branch**: `007-session-stream-model-fixes` | **Date**: 2026-04-02 | **Spec**: [spec.md](spec.md)

## Summary

Four linked improvements spanning the full stack:
1. **Claude Code output pipeline** — read Claude Code's on-disk JSONL conversation files and stream them through the existing output store, fixing the empty output pane for Claude Code sessions.
2. **Claude Code active state detection** — replace the fragile process-scan-based re-activation with JSONL file modification time checks, eliminating false-active sessions on Windows.
3. **Output stream legibility** — add role differentiation (user vs assistant), fix `break-all` word wrapping, and improve tool call presentation in `SessionDetail.tsx` and the events parser.
4. **Model display** — extract the model name from Claude Code conversation files and display it on session cards and the detail page.

## Technical Context

**Language/Version**: TypeScript — Node.js 22 (backend), React 19 (frontend)  
**Primary Dependencies**: Fastify (HTTP), better-sqlite3 (DB), chokidar (file watching), psList (process list), TanStack Query (frontend data fetching), Tailwind CSS (styles)  
**Storage**: SQLite via better-sqlite3; file-watching pipeline writes to `session_output` table  
**Testing**: Vitest (backend unit + integration), Playwright (E2E frontend)  
**Target Platform**: Windows desktop (single-user localhost developer tool)  
**Project Type**: Web application — React SPA + Fastify backend  
**Performance Goals**: Output pane updates within 5 seconds of new Claude Code activity (SC-002)  
**Constraints**: All reads are local-only (`~/.claude/projects/`, `~/.copilot/session-state/`); no network calls  
**Scale/Scope**: ≥10 concurrent sessions (per §VIII local tool exception)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| §I Engineering — testable in isolation | ✅ PASS | New parser follows same pattern as `events-parser.ts` which has unit tests |
| §III Code Standards — functions < 50 lines | ✅ PASS | Parser functions will be decomposed by concern |
| §IV Test-First | ✅ REQUIRED | Tests for JSONL parser, scan fix, and model extraction must be written first |
| §V Testing — unit + integration + E2E | ✅ REQUIRED | Unit: parser; Integration: detector + output flow; E2E: dashboard session card |
| §X DoD — README updated | ✅ REQUIRED | Claude Code output and model display are user-facing changes |
| §XI Documentation | ✅ REQUIRED | README must reflect Claude Code output streaming and model badge |
| §XII Error Handling | ✅ REQUIRED | Malformed/partial JSONL lines must be skipped gracefully; model field absent = render without error |

> **§XI Documentation**: README.md MUST be updated in the same PR.

## Project Structure

### Documentation (this feature)

```text
specs/007-session-stream-model-fixes/
├── plan.md              # This file
├── research.md          # Claude Code JSONL schema, active-state detection strategy
├── data-model.md        # Session + SessionOutput schema changes
├── quickstart.md        # Dev setup and manual testing guide
├── contracts/
│   └── session-output.md  # Updated output item contract
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── models/
│   │   └── index.ts              # Add model?: string|null to Session; role?: string|null to SessionOutput
│   ├── services/
│   │   ├── claude-code-detector.ts     # Fix scanExistingSessions() + add JSONL file watching
│   │   ├── claude-code-jsonl-parser.ts # NEW: parse ~/.claude/projects/**/*.jsonl → SessionOutput[]
│   │   └── events-parser.ts            # Add role field to output (user.message → role:'user', etc.)
│   ├── db/
│   │   └── database.ts           # DB migration: add model + role columns
│   └── api/
│       └── routes/sessions.ts    # No new endpoints; model field flows through existing GET /sessions
└── tests/
    ├── unit/
    │   ├── claude-code-jsonl-parser.test.ts  # NEW
    │   └── events-parser.test.ts             # Extended with role assertions
    └── integration/
        └── claude-code-detector.test.ts      # Extended with JSONL file watching tests

frontend/
├── src/
│   ├── types.ts                  # Add model? to Session; role? to SessionOutput
│   ├── components/
│   │   ├── SessionDetail/
│   │   │   └── SessionDetail.tsx  # Role-aware labels, whitespace-pre-wrap, improved tool display
│   │   └── SessionCard/
│   │       └── SessionCard.tsx    # Add model badge
│   └── pages/
│       └── SessionPage.tsx        # Add model in detail header
└── tests/
    └── e2e/
        └── sc-007-stream-model.spec.ts  # NEW
```

## Complexity Tracking

No constitution violations requiring justification.
