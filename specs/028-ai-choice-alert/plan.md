# Implementation Plan: AI Choice Alert

**Branch**: `028-ai-choice-alert` | **Date**: 2026-04-12 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/028-ai-choice-alert/spec.md`

## Summary

Add an ATTENTION NEEDED indicator to `SessionCard` when the AI is waiting for the user to make a choice. Detection is purely frontend: examine the last N session output items for a `tool_use` entry with `toolName` of `"ask_user"` (Copilot) or `"AskUserQuestion"` (Claude Code) that has no subsequent `tool_result`. When detected, replace the session summary line with bold red "ATTENTION NEEDED" text followed by the question and labelled choices. No backend changes needed.

## Technical Context

**Language/Version**: TypeScript 5.x, React 18
**Primary Dependencies**: React, Tailwind CSS, Vitest, Playwright
**Storage**: N/A (reads from existing session output query cache; no new persistence)
**Testing**: Vitest (unit), Playwright (e2e with mocked API)
**Target Platform**: Browser (Electron shell + web)
**Project Type**: Frontend-only change
**Performance Goals**: Detection is O(N) on last N output items — negligible
**Constraints**: Must not break existing SessionCard layout or summary behaviour; no backend changes
**Scale/Scope**: Single-user local tool; supports concurrent monitoring of all active sessions simultaneously

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| §I Engineering (reliable, testable, reversible) | PASS | Pure frontend; no new abstraction layers; easily reverted |
| §II Architecture (versioned API boundaries) | N/A | No new services or APIs |
| §III Code Standards (<50 lines, self-documenting) | PASS | `detectPendingChoice` will be <30 lines |
| §IV Test-First | MUST FOLLOW | Tests written before implementation in each phase |
| §V Testing (unit + e2e) | PASS | Unit tests for utility; component tests for rendering; e2e for full flow |
| §VI Security | EXCEPTION | Local developer tool bound to localhost |
| §VII Observability | N/A | UI display change only; no new server-side paths |
| §VIII Performance | EXCEPTION | Single-user localhost tool; no concurrency target beyond active sessions |
| §IX AI Usage | PASS | Human review on all AI-generated code |
| §X Definition of Done | TRACKED | All DoD items in tasks |
| §XI Documentation | MUST UPDATE | README.md must document the new alert behaviour |
| §XII Error Handling | PASS | Malformed tool input degrades gracefully (shows ATTENTION NEEDED without choices) |

## Project Structure

### Documentation (this feature)

```text
specs/028-ai-choice-alert/
├── plan.md              (this file)
├── research.md
├── data-model.md
└── tasks.md
```

### Source Code (changes only)

```text
frontend/src/
├── utils/
│   └── sessionUtils.ts                           # Add detectPendingChoice()
└── components/
    └── SessionCard/
        └── SessionCard.tsx                       # Consume detectPendingChoice; replace summary line

frontend/src/__tests__/
├── sessionUtils.test.ts                          # Add detectPendingChoice unit tests
└── SessionCard.test.tsx                          # Add attention-needed rendering tests

frontend/tests/e2e/
└── sc-028-ai-choice-alert.spec.ts                # e2e: alert renders; clears after answer

README.md                                         # Document ATTENTION NEEDED alert
```
