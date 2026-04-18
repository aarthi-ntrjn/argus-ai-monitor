# Feature Specification: Argus Marketing Landing Page

**Feature Branch**: `043-marketing-landing-page`
**Created**: 2026-04-18
**Status**: Clarified
**Input**: User description: "i want to build page for users to learn more about argus - something like https://openclaw.ai/ or https://authentive.ai/ build a proposal"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - First-Time Discovery (Priority: P1)

A developer hears about Argus (via social media, a blog post, or word of mouth) and lands on the page with no prior knowledge. Within 30 seconds they understand what Argus does, who it is for, and how to get started. They copy the install command and try it immediately.

**Why this priority**: This is the core purpose of a marketing page. If a visitor cannot grasp the product value and act on it quickly, everything else is irrelevant.

**Independent Test**: Can be fully tested by opening the page as a first-time visitor and measuring whether the headline, subheadline, and install command are visible above the fold, and whether a tester can describe what Argus does after reading only those three elements.

**Acceptance Scenarios**:

1. **Given** a developer lands on the page for the first time, **When** they look at the hero section, **Then** they see a one-sentence headline describing what Argus does, a supporting subheadline naming supported tools (Claude Code and GitHub Copilot CLI), and a one-line install command.
2. **Given** a developer reads the hero section, **When** they click the primary CTA, **Then** the install command is copied to their clipboard or they are taken to the GitHub repository.
3. **Given** a developer is on a mobile device, **When** they open the page, **Then** the hero section, install command, and primary CTA are fully visible without horizontal scrolling.

---

### User Story 2 - Feature Evaluation (Priority: P1)

A developer who has heard of Argus wants to understand its capabilities in depth before installing it. They scroll through the page to see screenshots, feature highlights, and a clear explanation of what they can monitor and control.

**Why this priority**: Alongside discovery, this is the page's primary job. Developers evaluating tools need enough detail to make a decision without leaving the page.

**Independent Test**: Can be fully tested by presenting the page to a developer unfamiliar with Argus and asking them to list 5 things Argus can do after scrolling the page, without opening any external links.

**Acceptance Scenarios**:

1. **Given** a developer scrolls past the hero, **When** they reach the features section, **Then** they see distinct sections for Monitor (live session view), Control (send prompts, kill sessions, focus terminal), and multi-session visibility, each with a screenshot or illustrative image.
2. **Given** a developer reads the features section, **When** they examine a feature block, **Then** each block has a short title, a 1-3 sentence description, and a screenshot or graphic.
3. **Given** a developer wants to know how it works, **When** they scroll to the How It Works section, **Then** they see a 3-step summary: install, open browser, watch and control.

---

### User Story 3 - Social Proof and Credibility (Priority: P2)

A developer who is almost convinced wants to see evidence that Argus is actively maintained, trusted by others, or has been covered in external sources before committing to installing it.

**Why this priority**: Social proof increases install conversion. Without it, cautious developers may leave to search for reviews before returning (or not returning).

**Independent Test**: Can be fully tested by checking whether the page displays at least one of: GitHub star count, npm download count, a quote from a user, or a media mention.

**Acceptance Scenarios**:

1. **Given** a developer looks for credibility signals, **When** they view the page, **Then** they see at least one of: a live GitHub star count badge, an npm weekly downloads badge, or a user quote.
2. **Given** the GitHub star count badge is shown, **When** the page loads, **Then** the badge reflects a recent value (not a hardcoded placeholder).

---

### User Story 4 - Easy Sharing (Priority: P3)

A developer who uses Argus wants to share it with teammates. They need a clean, professional URL they can paste into Slack or a PR comment that communicates the tool's value at a glance.

**Why this priority**: Organic sharing is a growth multiplier but is not required for the page's core purpose.

**Independent Test**: Can be fully tested by sharing the page URL and confirming the Open Graph title, description, and image display correctly in Slack/Discord unfurls and social previews.

**Acceptance Scenarios**:

1. **Given** a developer pastes the landing page URL into Slack, **When** Slack unfurls it, **Then** the preview shows the Argus name, a one-sentence description, and a representative screenshot or logo image.
2. **Given** a developer shares the URL on social media, **When** the social platform renders the preview, **Then** the correct Open Graph title, description, and image are shown.

---

### Edge Cases

- What happens when the visitor has JavaScript disabled? The page must still render all static content (hero, features, screenshots) without JavaScript.
- What happens on a very slow connection? Images must use lazy loading so the hero and text are visible before large screenshots finish loading.
- What happens on extra-wide screens (2560px+)? Content must be constrained to a maximum readable width and remain centered.
- What happens if a GitHub or npm badge fails to load? Badges must fail gracefully (hide or show a fallback) rather than showing broken image icons.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The page MUST display a hero section with a headline, subheadline, and install command (`npx argus-ai-hub`) visible without scrolling on desktop (1280px+) and mobile (390px+) viewports.
- **FR-002**: The page MUST include a primary call-to-action button that links to the GitHub repository.
- **FR-003**: The page MUST include a secondary call-to-action that copies the install command to the clipboard with a visual confirmation (e.g., "Copied!").
- **FR-004**: The page MUST display a features section with separate visual blocks for Monitor, Control, and multi-agent visibility, each including a product screenshot and descriptive text.
- **FR-005**: The page MUST include a "How It Works" section with a numbered 3-step guide (install, open browser, watch and control).
- **FR-006**: The page MUST include at least one social proof element: a GitHub star count badge, an npm download badge, or a user testimonial.
- **FR-007**: The page MUST include a footer with links to the GitHub repository and the npm package page.
- **FR-008**: The page MUST include Open Graph meta tags (title, description, image) and a Twitter Card meta tag so link previews render correctly in social platforms and messaging tools.
- **FR-009**: All images MUST use lazy loading except for the hero image or any above-the-fold asset.
- **FR-010**: The page MUST be fully usable with CSS only (no JavaScript required) for all static content; JavaScript-only enhancements (e.g., clipboard copy, badge counters) MUST degrade gracefully.
- **FR-011**: The page MUST be responsive and render correctly on viewports from 390px to 2560px wide.
- **FR-012**: The page MUST achieve a Lighthouse performance score of 90 or above on desktop.
- **FR-013**: The GitHub Actions deployment workflow MUST trigger automatically on push to `master` only when files under `/landing/**` change, and MUST deploy the `/landing` folder to GitHub Pages.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time visitor can identify what Argus does, which AI tools it supports, and how to install it within 30 seconds of page load without scrolling.
- **SC-002**: The page loads and displays the hero section in under 2 seconds on a standard broadband connection.
- **SC-003**: The install command is no more than 2 taps/clicks away from copying on both desktop and mobile.
- **SC-004**: The page renders correctly (no layout breaks, no missing content) on Chrome, Firefox, and Safari on both desktop and mobile viewports.
- **SC-005**: Social link preview (Open Graph / Twitter Card) displays the correct title, description, and image in at least two major platforms (Slack and Twitter/X).
- **SC-006**: The page achieves a Lighthouse accessibility score of 90 or above.
- **SC-007**: 80% of testers in a 5-person usability check can list at least 3 features of Argus after viewing the page for 60 seconds.

## Clarifications

### Session 2026-04-18

- Q: Where does the landing page source code live? → A: `/landing` subfolder in the private `argus-private` repo (developed alongside the app). When pushed to the public `argus-ai-hub` repo at milestone, GitHub Actions on the public repo deploys `/landing` to GitHub Pages.
- Q: What analytics tool will be used? → A: GitHub Pages built-in traffic insights only (no script, no cookie banner). Richer analytics deferred to v2.
- Q: What color theme should the landing page use? → A: Light theme only, visually consistent with the Argus app (`slate-50` background, clean card UI). No dark mode for v1.
- Q: When does the GitHub Actions deployment trigger? → A: Auto-deploy on push to `master` when any file under `/landing/**` changes.

## Assumptions

- The landing page will be a standalone static site, separate from the running Argus app (similar in style to openclaw.ai and authentive.ai). The source code lives in a `/landing` subfolder of the private `argus-private` repository, developed alongside the app. When changes are pushed to the public `argus-ai-hub` repo at a milestone, a GitHub Actions workflow on the public repo deploys the `/landing` folder to GitHub Pages. A custom domain will be configured once chosen; the site will fall back to `aarthi-ntrjn.github.io/argus` until then.
- Existing product screenshots from `docs/images/` will be used as assets; no new screenshot production is required for v1.
- The primary audience is software developers who work with Claude Code or GitHub Copilot CLI.
- There is no backend required; all badge counts and social proof elements are fetched client-side or embedded as static shield.io badges.
- Mobile responsiveness is in scope from the start (not deferred to v2), consistent with Argus's existing mobile support.
- No analytics script is added to the page for v1. Traffic visibility comes from GitHub Pages built-in insights (page views, referrers, 14-day window) readable by repo admins in the GitHub UI. No cookie banner or privacy notice is required.
- The Argus brand colors and visual style should match the existing app UI: light theme (`slate-50` background, clean card style). Dark mode is out of scope for v1.
