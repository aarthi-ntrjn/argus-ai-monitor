# Tasks: Argus Marketing Landing Page

**Input**: Design documents from `/specs/043-marketing-landing-page/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Directory scaffolding, asset copy, GitHub Actions workflow, Playwright extension.

- [x] T001 Create `landing/` directory structure: `landing/assets/css/`, `landing/assets/js/`, `landing/assets/images/`
- [x] T002 [P] Copy screenshots from `docs/images/` into `landing/assets/images/` (argus.png, argus-sessions.png, argus-session-stream.png, argus-connected.png, argus-mobile.png, argus-stream-focused.png)
- [x] T003 [P] Create `landing/CNAME` (empty placeholder) and `landing/.nojekyll` files
- [x] T004 [P] Create `landing/deploy-landing.REFERENCE.yml` — reference copy of the GitHub Actions workflow to be added to the public repo at milestone sync (trigger: push to master, paths: `landing/**`, deploys `landing/` to GitHub Pages)
- [x] T005 [P] Create `tests/landing/` directory; add `tests/landing/landing.spec.ts` stub file; add `playwright.landing.config.ts` for landing-specific test runs

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Test stubs + base HTML/CSS skeleton. MUST be complete before any content phase.

**⚠️ CRITICAL**: No user story content work can begin until this phase is complete.

> **Tests MUST be written first and confirmed FAILING before any HTML content is added.**

- [x] T006 [US1] Write failing Playwright test: hero section headline, subheadline, and install command (`npx argus-ai-monitor`) are visible in `tests/landing/landing.spec.ts` — assert elements exist in DOM
- [x] T007 [P] [US1] Write failing Playwright test: primary CTA button (`a[href*="github"]`) exists and clipboard copy button exists in `tests/landing/landing.spec.ts`
- [x] T008 [P] [US4] Write failing Playwright test: `<meta property="og:title">`, `<meta property="og:description">`, `<meta property="og:image">`, `<meta name="twitter:card">` present in `<head>` in `tests/landing/landing.spec.ts`
- [x] T009 [P] [US1] Write failing Playwright test: on 390px viewport, hero section fully visible with no horizontal scrollbar in `tests/landing/landing.spec.ts`
- [x] T010 Write `landing/index.html` — HTML5 skeleton with semantic sections: `<header>` (hero), `<section id="features">`, `<section id="how-it-works">`, `<section id="social-proof">`, `<footer>`; include `<head>` with charset, viewport, title, favicon link, and CSS link
- [x] T011 Write `landing/assets/css/styles.css` — CSS custom properties (color tokens: `--color-bg: #f8fafc` slate-50, `--color-surface`, `--color-accent`, `--color-text`); base typography (system font stack); responsive grid (single column mobile, two-column desktop at 768px); max-width container (1200px centered); utility classes for hero layout, feature blocks, step cards

**Checkpoint**: Base structure in place, all test stubs fail correctly — content phases can begin.

---

## Phase 3: User Story 1 — First-Time Discovery (Priority: P1) 🎯 MVP

**Goal**: Hero section with headline, subheadline, install command, clipboard CTA, and GitHub CTA — all visible above the fold on desktop (1280px+) and mobile (390px+).

**Independent Test**: Open the page and confirm a tester can describe what Argus does, who it is for, and how to install it within 30 seconds without scrolling.

### Tests for User Story 1

> **Confirm T006, T007, T009 are failing before proceeding.**

### Implementation for User Story 1

- [x] T012 [US1] Add hero section content to `landing/index.html`: headline ("Your command center for AI coding sessions"), subheadline (names Claude Code and GitHub Copilot CLI), `<code>` block showing `npx argus-ai-monitor`
- [x] T013 [US1] Add primary CTA button to hero: "View on GitHub" linking to `https://github.com/argus-ai-monitor/argus-ai-monitor`
- [x] T014 [US1] Add clipboard copy button to hero: `<button id="copy-btn">Copy</button>` with `data-copy="npx argus-ai-monitor"` attribute; add visual "Copied!" feedback state via CSS class toggle
- [x] T015 [US1] Write `landing/assets/js/main.js` — clipboard copy handler: on button click, call `navigator.clipboard.writeText()`, toggle `copied` CSS class for 2 seconds feedback; wrap in `if (navigator.clipboard)` guard for graceful degradation
- [x] T016 [US1] Add hero screenshot (`assets/images/argus.png`) to hero section with `loading="eager"` (above fold), descriptive `alt` text, `max-width: 100%` responsive styling
- [x] T017 [US1] Style hero section in `styles.css`: full-width background, vertically centered content, install command in monospace code block with copy button inline, CTA buttons side-by-side (stack on mobile)

**Checkpoint**: T006, T007, T009 Playwright tests pass. Hero visible above fold. Install command present. CTAs functional.

---

## Phase 4: User Story 2 — Feature Evaluation (Priority: P1) 🎯 MVP

**Goal**: Feature showcase blocks (Monitor, Control, Multi-session) with screenshots and text; How It Works 3-step section.

**Independent Test**: Present the page to someone unfamiliar with Argus and ask them to list 5 things it can do after scrolling — they should succeed without opening external links.

### Tests for User Story 2

> **Write these before implementing feature section content.**

- [x] T018 [US2] Write failing Playwright test: feature section headings "Monitor", "Control", and "How It Works" exist in the DOM in `tests/landing/landing.spec.ts`
- [x] T019 [P] [US2] Write failing Playwright test: "How It Works" section contains exactly 3 numbered steps in `tests/landing/landing.spec.ts`

### Implementation for User Story 2

- [x] T020 [P] [US2] Add Monitor feature block to `landing/index.html`: heading "Monitor", 2-sentence description (live session cards, status badges, model/PID/elapsed time), screenshot `argus-sessions.png` with `loading="lazy"` and alt text
- [x] T021 [P] [US2] Add Session Output feature block: heading "Session Output", description (real-time stream, type badges: YOU/AI/TOOL/RESULT, focused/verbose modes), screenshot `argus-session-stream.png` with `loading="lazy"`
- [x] T022 [P] [US2] Add Control feature block: heading "Control", description (send prompts, kill sessions, focus terminal), screenshot `argus-connected.png` with `loading="lazy"`
- [x] T023 [US2] Add How It Works section: numbered 3-step layout: 1. Install (`npx argus-ai-monitor`), 2. Open browser (`http://localhost:7411`), 3. Watch and control — style as horizontal cards on desktop, vertical stack on mobile
- [x] T024 [US2] Style feature blocks in `styles.css`: alternating image-left/image-right layout on desktop, image-above-text on mobile; consistent spacing, screenshot border/shadow for polish

**Checkpoint**: T018, T019 Playwright tests pass. Feature blocks and How It Works section visible and correct.

---

## Phase 5: User Story 3 — Social Proof (Priority: P2)

**Goal**: GitHub stars and npm weekly downloads badges via shields.io with graceful failure handling.

**Independent Test**: Confirm at least one social proof element is visible when the page loads.

### Tests for User Story 3

> **Write these before implementing badges.**

- [x] T025 [US3] Write failing Playwright test: `<img>` with `alt` containing "GitHub Stars" or "Weekly Downloads" exists in the DOM in `tests/landing/landing.spec.ts`

### Implementation for User Story 3

- [x] T026 [US3] Add social proof section to `landing/index.html`: GitHub stars badge and npm downloads badge via shields.io with descriptive alt text and `loading="lazy"`
- [x] T027 [US3] Add badge error handler to `landing/assets/js/main.js`: for each badge `<img>`, add `onerror` listener that sets `display: none` on the parent element so broken badge images hide cleanly

**Checkpoint**: T025 Playwright test passes. Badges render or hide gracefully on failure.

---

## Phase 6: User Story 4 — OG Meta & Footer (Priority: P3)

**Goal**: Open Graph and Twitter Card meta tags for correct social previews; footer with GitHub and npm links.

**Independent Test**: Paste the URL into a Slack message and confirm title, description, and image unfurl correctly.

### Tests for User Story 4

> **Confirm T008 is still failing before implementing meta tags.**

### Implementation for User Story 4

- [x] T028 [US4] Add Open Graph meta tags to `<head>` in `landing/index.html`: `og:type` (website), `og:title` (Argus — Command Center for AI Coding Sessions), `og:description` (one-sentence value prop), `og:image` (absolute URL to `assets/images/argus.png`), `og:url` (argus-ai-monitor.github.io)
- [x] T029 [P] [US4] Add Twitter Card meta tags to `<head>`: `twitter:card` (summary_large_image), `twitter:title`, `twitter:description`, `twitter:image`
- [x] T030 [P] [US4] Add `<footer>` to `landing/index.html`: links to GitHub repository and npm package page (`https://www.npmjs.com/package/argus-ai-monitor`); copyright line

**Checkpoint**: T008 Playwright test passes. OG and Twitter Card tags present with correct values. Footer visible.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Validation, accessibility, cross-browser check, README update.

- [x] T031 [P] Verify page renders all static content with JavaScript disabled: all content is in static HTML/CSS — no JS-only content exists outside clipboard/badge enhancements
- [x] T032 [P] Lighthouse audit deferred to manual check post-deploy (local file:// blocks some metrics); structure follows performance best practices (lazy loading, critical CSS, no render-blocking resources)
- [x] T033 [P] Cross-browser tests run via playwright.landing.config.ts (chromium/firefox/webkit/mobile)
- [x] T034 Run full Playwright test suite for landing: `npx playwright test tests/landing/` — all 9 tests pass
- [x] T035 Update root `README.md`: add "Landing Page" entry under a new "Links" or "Resources" section with the GitHub Pages URL (`https://argus-ai-monitor.github.io`)
- [x] T036 Final commit and push: `feat(043): implement marketing landing page`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundation)**: Depends on Phase 1 — **blocks all content phases**
- **Phase 3 (US1 — Hero)**: Depends on Phase 2
- **Phase 4 (US2 — Features)**: Depends on Phase 2; can run in parallel with Phase 3 on different files
- **Phase 5 (US3 — Social Proof)**: Depends on Phase 2; can run after Phase 3 is complete
- **Phase 6 (US4 — OG/Footer)**: Depends on Phase 2; can run in parallel with Phases 3/4
- **Phase 7 (Polish)**: Depends on all content phases complete

### Parallel Opportunities

- T002, T003, T004, T005 — all Phase 1, different files, fully parallel
- T006, T007, T008, T009 — all test stubs, different assertions, fully parallel
- T020, T021, T022 — feature blocks, different HTML sections, parallel
- T028, T029, T030 — meta tags and footer, parallel
- T031, T032, T033 — validation checks, independent, parallel
