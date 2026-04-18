# Research: Argus Marketing Landing Page

**Feature**: 043-marketing-landing-page
**Phase**: 0 — Research & Decisions

## Decision 1: Static HTML vs Site Framework

**Decision**: Vanilla HTML5 + CSS3 + minimal vanilla JavaScript. No framework, no build step.

**Rationale**: A single-page marketing site does not benefit from a component framework. GitHub Pages serves static files natively. Zero npm dependencies means zero supply chain risk, zero build failures, and instant local preview by opening `index.html` in a browser. The entire page is a single scroll, so there is no routing requirement.

**Alternatives Considered**:

| Alternative | Why Rejected |
|---|---|
| Astro | Adds a build pipeline and Node.js dependency. Unnecessary for a single static page. |
| React + Vite | Overkill for static marketing content. Requires build step before every GitHub Pages deploy. |
| Next.js | Server-side features not needed. Adds significant complexity. |
| Jekyll (GitHub Pages default) | Limited flexibility; `.nojekyll` disables it intentionally for full HTML control. |

## Decision 2: CSS Approach

**Decision**: Vanilla CSS with CSS Custom Properties (variables) for color tokens and spacing. No utility framework.

**Rationale**: Keeps the stylesheet small, readable, and zero-dependency. CSS custom properties allow the Argus `slate-50` color palette to be defined once and reused consistently. No CDN call for a CSS framework means faster load times and no third-party dependency.

**Alternatives Considered**:

| Alternative | Why Rejected |
|---|---|
| Tailwind CSS via CDN | Delivers 100KB+ of unoptimized utility classes. Requires PurgeCSS in a build step to trim. |
| Bootstrap CDN | Visual language diverges from the Argus app's clean card aesthetic. Adds ~30KB. |
| Tailwind with PostCSS build | Re-introduces a build step we explicitly decided to avoid. |

## Decision 3: Badge Source for Social Proof

**Decision**: shields.io dynamic badges for GitHub star count and npm weekly downloads.

**Rationale**: shields.io is the de-facto standard for open source project badges. Badges are rendered as SVG images via a CDN URL — no JavaScript required, no CORS issues. They degrade gracefully (the `<img>` simply fails to load) so no broken UI if shields.io is unavailable.

**Badge URLs**:
- GitHub stars: `https://img.shields.io/github/stars/aarthi-ntrjn/argus?style=flat&label=GitHub%20Stars`
- npm downloads: `https://img.shields.io/npm/dw/argus?style=flat&label=Weekly%20Downloads`

**Alternatives Considered**:

| Alternative | Why Rejected |
|---|---|
| GitHub API direct fetch | Requires a CORS proxy or server-side fetch. Not available in a static page. |
| Hardcoded numbers | Stale immediately. Violates FR-006 (badge must reflect recent value). |
| Badgen.net | Less established, smaller CDN reliability track record than shields.io. |

## Decision 4: Image Assets

**Decision**: Use existing screenshots from `docs/images/` copied into `landing/assets/images/`. No new screenshots for v1.

**Rationale**: The spec explicitly assumes existing screenshots are sufficient for v1 (Assumptions section). The current screenshots are adequate quality for a v1 launch. New dedicated high-resolution annotated screenshots can be produced for v2.

**Images mapped to sections**:

| Section | Image |
|---|---|
| Hero | `argus.png` (full dashboard overview) |
| Monitor feature block | `argus-sessions.png` (session cards) |
| Session output feature block | `argus-session-stream.png` |
| Control feature block | `argus-connected.png` (prompt injection) |
| Mobile support feature block | `argus-mobile.png` |
| Focused mode feature block | `argus-stream-focused.png` |

## Decision 5: Testing Strategy

**Decision**: Playwright e2e tests placed in `tests/landing/landing.spec.ts`, reusing the existing Playwright configuration in the repo root.

**Rationale**: The repo already has Playwright configured (`playwright.config.ts`). Adding a `tests/landing/` subdirectory reuses the existing setup without a new config file. Tests are written first (§IV test-first), describing expected DOM structure and behavior before the HTML is written. Lighthouse audit is run manually as a one-time validation step rather than a CI gate (avoids flaky score variation in CI).

**Test coverage**:
- Hero section visible above the fold (no scroll required)
- Install command text is present
- Clipboard CTA button exists and triggers copy feedback
- Feature section headings are present (Monitor, Control, How It Works)
- OG meta tags present with correct content
- Page renders without JS errors
- Mobile viewport (390px): hero section fully visible, no horizontal scroll
