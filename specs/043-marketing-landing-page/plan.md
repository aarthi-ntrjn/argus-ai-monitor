# Implementation Plan: Argus Marketing Landing Page

**Branch**: `043-marketing-landing-page` | **Date**: 2026-04-18 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/043-marketing-landing-page/spec.md`

## Summary

Build a standalone static marketing/product landing page for Argus, hosted on GitHub Pages, developed in the private `argus-private` repo under `/landing` and deployed from the public `argus` repo via GitHub Actions. The page communicates Argus's value proposition to developers in the style of openclaw.ai and authentive.ai: hero section with install CTA, feature showcase with product screenshots, How It Works walkthrough, social proof badges, and full OG meta support. No framework, no build step — pure HTML5 + CSS3 + minimal vanilla JavaScript.

## Technical Context

**Language/Version**: HTML5, CSS3, JavaScript ES2020 (vanilla, no framework)
**Primary Dependencies**: None (zero npm dependencies); shields.io CDN for dynamic badges
**Storage**: N/A (static files only)
**Testing**: Playwright e2e (test-first for critical flows); HTML validation via W3C validator; Lighthouse CI for performance/accessibility scores
**Target Platform**: GitHub Pages (CDN-served), Browsers: Chrome, Firefox, Safari — desktop and mobile
**Project Type**: Static website (single-page marketing site)
**Performance Goals**: Lighthouse performance score ≥ 90 on desktop; hero section visible in < 2s on broadband
**Constraints**: No build pipeline; JavaScript enhancements must degrade gracefully when JS is disabled; page must render correct static content without JS
**Scale/Scope**: Single HTML page, ~6 sections, ~6 product screenshots, 2 badge elements

## Constitution Check

*GATE: Must pass before Phase 0 research.*

| Principle | Status | Notes |
|-----------|--------|-------|
| §I Engineering — reliable, simple, testable, reversible | PASS | Static HTML is maximally simple; Playwright tests cover critical flows; files are version-controlled |
| §II Architecture — versioned API boundaries, no cross-DB access | EXCEPTION | No services or APIs. Static site is not a service architecture; principle does not apply |
| §III Code Standards — readable, functions < 50 lines, structured logging | PASS | HTML/CSS/JS kept readable; JS is minimal (clipboard copy only); no production logging needed |
| §IV Test-First — tests written before implementation | PASS | Playwright tests written before HTML; tests describe expected DOM structure and CTA behavior |
| §V Testing — unit, integration, e2e | PASS | E2e tests cover hero visibility, CTA function, OG tags, mobile layout; HTML validation covers structure |
| §VI Security — auth on all endpoints, no secrets in source | EXCEPTION | Public read-only static page; no auth required. CNAME and badge URLs are public. No secrets. No audit log needed for a public read-only page. Exception declared per §VI local-tool clause. |
| §VII Observability — structured logs, metrics, health check | EXCEPTION | Static CDN page has no server to instrument. GitHub Pages traffic insights (page views, referrers) provides baseline observability without any instrumentation code. |
| §VIII Performance — 500ms p95 API response, 10k concurrent users | EXCEPTION | No API endpoints. Lighthouse ≥ 90 replaces latency target. CDN-served static page is inherently horizontally scaled; concurrent user target does not apply per §VIII single-user exception. |
| §IX AI Usage — AI may generate code, not architecture | PASS | AI generates HTML/CSS; architecture decisions made by human in this plan |
| §X Definition of Done — code, tests, docs, README, metrics, security | PASS | All criteria addressed: Playwright tests, README update task, Lighthouse audit, no secrets |
| §XI Documentation — README.md updated in same PR | PASS | Task included to update root README.md with landing page URL |
| §XII Error Handling — structured errors, human-friendly UX messages | PASS | Only client-side: badge load failures degrade gracefully (hide on error); clipboard failure shows fallback text |

## Project Structure

### Documentation (this feature)

```text
specs/043-marketing-landing-page/
├── plan.md              # This file
├── research.md          # Phase 0 decisions
├── tasks.md             # Phase 2 output (speckit.tasks)
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
landing/
├── index.html                  # Single-page marketing site
├── assets/
│   ├── css/
│   │   └── styles.css          # All styles (CSS custom properties, responsive layout)
│   ├── js/
│   │   └── main.js             # Clipboard copy, badge error handling
│   └── images/
│       ├── argus.png           # Dashboard overview (hero)
│       ├── argus-sessions.png  # Session cards feature block
│       ├── argus-session-stream.png  # Session output feature block
│       ├── argus-connected.png # Control / prompt injection feature block
│       ├── argus-mobile.png    # Mobile support feature block
│       └── argus-stream-focused.png  # Focused mode feature block
├── CNAME                       # Custom domain placeholder (empty until domain chosen)
└── .nojekyll                   # Prevents GitHub Pages Jekyll processing

tests/
└── landing/
    └── landing.spec.ts         # Playwright e2e tests (test-first)
```

**GitHub Actions** (public `argus` repo — added when milestone sync happens):

```text
.github/workflows/
└── deploy-landing.yml          # Trigger: push to master, paths: landing/**
```

**Structure Decision**: Single static site under `/landing` at repo root of `argus-private`. Deployed as a subfolder to GitHub Pages. No separate repo, no build pipeline. Test suite placed in `tests/landing/` alongside existing Playwright tests to reuse the existing Playwright config.

## Implementation Phases

### Phase 1 — Setup

Goal: Scaffolding, image assets, GitHub Actions workflow, Playwright config extension.

### Phase 2 — Foundation

Goal: HTML skeleton, CSS custom properties (color tokens matching Argus app `slate-50` palette), base typography, responsive grid. Blocking prerequisite for all content phases.

### Phase 3 — Hero & CTA (US1 — P1)

Goal: Hero section with headline, subheadline, install command display, clipboard copy CTA, GitHub CTA button. Above-the-fold on desktop (1280px+) and mobile (390px+).

### Phase 4 — Feature Showcase & How It Works (US2 — P1)

Goal: Three feature blocks (Monitor, Control, Multi-session) each with screenshot and descriptive text. How It Works 3-step section.

### Phase 5 — Social Proof (US3 — P2)

Goal: GitHub stars badge and npm weekly downloads badge via shields.io. Graceful hide on badge load failure.

### Phase 6 — OG Meta, Footer & Sharing (US4 — P3)

Goal: Open Graph and Twitter Card meta tags in `<head>`. Footer with GitHub and npm links.

### Phase 7 — Polish & Validation

Goal: Lighthouse audit (≥90 performance, ≥90 accessibility), cross-browser check, README.md update with landing page URL.

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: [e.g., Python 3.11, Swift 5.9, Rust 1.75 or NEEDS CLARIFICATION]  
**Primary Dependencies**: [e.g., FastAPI, UIKit, LLVM or NEEDS CLARIFICATION]  
**Storage**: [if applicable, e.g., PostgreSQL, CoreData, files or N/A]  
**Testing**: [e.g., pytest, XCTest, cargo test or NEEDS CLARIFICATION]  
**Target Platform**: [e.g., Linux server, iOS 15+, WASM or NEEDS CLARIFICATION]
**Project Type**: [e.g., library/cli/web-service/mobile-app/compiler/desktop-app or NEEDS CLARIFICATION]  
**Performance Goals**: [domain-specific, e.g., 1000 req/s, 10k lines/sec, 60 fps or NEEDS CLARIFICATION]  
**Constraints**: [domain-specific, e.g., <200ms p95, <100MB memory, offline-capable or NEEDS CLARIFICATION]  
**Scale/Scope**: [domain-specific, e.g., 10k users, 1M LOC, 50 screens or NEEDS CLARIFICATION]

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

[Gates determined based on constitution file]

> **§XI Documentation**: README.md MUST be updated in the same PR as any user-facing or
> architectural change. Include a README update task in the task list.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
# [REMOVE IF UNUSED] Option 1: Single project (DEFAULT)
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/

# [REMOVE IF UNUSED] Option 2: Web application (when "frontend" + "backend" detected)
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/

# [REMOVE IF UNUSED] Option 3: Mobile + API (when "iOS/Android" detected)
api/
└── [same as backend above]

ios/ or android/
└── [platform-specific structure: feature modules, UI flows, platform tests]
```

**Structure Decision**: [Document the selected structure and reference the real
directories captured above]

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
