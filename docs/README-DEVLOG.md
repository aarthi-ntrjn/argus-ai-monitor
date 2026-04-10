# Argus: Development Log

A day-by-day account of what was built, fixed, and decided from the first commit to today. The secondary purpose of this document is a retrospective on how AI-assisted development evolved across the project — not just the code, but the practice of working with AI tools.

---

## Retrospective: How AI Tool Usage Evolved

### The bigger arc: from desk to infrastructure

Before looking at what changed day to day inside this project, the more important story is what changed in the months before it. Argus was not built because it sounded like a fun project. It was built because it became a necessary piece of infrastructure for a way of working that had already evolved past what was possible without it.

**Stage 1: Tethered to a desktop, one project.**
AI coding started the way most people start: sitting at the machine, one conversation open, watching every step. The AI was a tool you operated in the moment. You could not stray far and you could not run more than one thing at once.

**Stage 2: Letting it run for hours.**
The first real shift was trusting the AI to work independently on a task for an extended period without supervision. This is harder than it sounds. A long-running AI session will hit ambiguities, make wrong turns, or stall. The answer was structure: Speckit gave the AI a contract — spec, plan, tasks — that it could execute against without needing to check in at every decision. With a well-formed tasks.md, an AI session could run for a few hours and produce coherent, reviewable output. You could start a session and walk away.

**Stage 3: Multiple enlistments, running in parallel.**
Once the pattern of "structured task list + supervised execution" was established, the natural next step was to multiply it. Multiple Claude Code sessions, each in its own repo, each working through its own task list. This is where productivity compounded dramatically. Tasks that would have been serialized across days started running in parallel across hours. The constraint was no longer AI capability — it was the human's ability to context-switch and review.

**Stage 4: Argus as the monitoring layer.**
Running multiple long sessions in parallel on one machine created a new problem: visibility. Which session was active, which had stalled, what was each one doing right now. Opening four terminals and tracking each manually did not scale. Argus was built to solve exactly this problem — a single dashboard showing every session's status, last output, and control interface. The tool was built to support the practice that had already evolved.

**Stage 5: Going mobile with Claude Remote.**
The next evolution was untethering from the machine entirely. Claude Remote allowed starting and interacting with sessions from a phone or tablet — commute, couch, wherever. The AI development environment was now ambient rather than located at a desk. A task could be started in the morning, checked at lunch, reviewed in the evening.

**Stage 6: The sleep problem.**
Mobile access revealed a new friction: the development machine would go to sleep, killing active sessions mid-run. A session started remotely would time out before it finished, and there was no way to resume it. The work was lost.

**Stage 7: RDP on the phone to keep the machine alive.**
The current solution: RDP into the machine from the phone to keep it awake and sessions running. This works, but it is a workaround for a real problem — the development infrastructure still has a single point of failure, and that failure mode is "the machine goes to sleep." The natural next step is eliminating that dependency entirely: a cloud-hosted development machine, a persistent session manager, or a headless server that keeps running regardless of device state.

---

### What this arc reveals

The progression is from AI as a tool you use at a desk to AI as infrastructure you maintain. Each stage solved the constraint of the previous one:

| Stage | Constraint solved | New constraint exposed |
|-------|------------------|----------------------|
| One session, supervised | Learning the tool | Cannot multitask |
| Structured long runs (Speckit) | Cannot walk away | Cannot run in parallel |
| Multiple enlistments | One thing at a time | Cannot monitor all sessions |
| Argus dashboard | Blind to what is running | Tethered to one machine |
| Claude Remote | Must be at desk | Machine sleeps, sessions die |
| RDP to keep machine alive | Sessions survive sleep | Still depends on one physical machine |
| (Next: persistent cloud machine) | Single-machine dependency | TBD |

The pattern is infrastructure thinking applied to AI development. Not "how do I get the AI to do this one thing" but "what does the environment need to look like so that AI sessions can run productively without me babysitting them."

---

### Week 1 in summary (Argus specifically)

Within this larger arc, Argus itself went from an empty repository to a working multi-feature product with security hardening, CI, a test suite, and onboarding in six days of active work.

### Day 1: AI as executor inside a rigid scaffold

The first day established the pattern that made everything else possible: Speckit. Before a single line of application code was written, the spec was written, clarified, planned, and tasked. The AI was operating inside a strict pipeline with defined outputs at each stage (spec.md, plan.md, tasks.md), and the implementation was driven by a numbered task list.

The outcome was impressive on the surface — a full-stack application in one day — but it also showed the limits of that approach. The session detection logic had bugs that only surfaced with real data, the UI needed significant rework after first use, and the architecture had gaps that needed subsequent features to fill. The AI was fast, but it was building to the spec, not to experience.

**Key dynamic:** AI as a fast implementer executing human-designed tasks. The value of Speckit was that it forced upfront thinking that a pure "just build it" prompt would have skipped.

### Day 2: Real usage reveals what AI missed

The second day was largely about fixing what real usage exposed. Bugs in Copilot CLI detection (js-yaml date coercion, Windows path handling), a null-PID check that silently broke session liveness, sessions that never ended when their process stopped. None of these were spec failures — they were things that only appear when you run the tool against real sessions on a real machine.

The more significant shift: encoding workflows into reusable AI skills. The `/bug` and `/merge` skills were created on day 2. This was the first sign of a new pattern — using the AI not just to write code but to formalise how the AI itself should approach recurring tasks.

**Key dynamic:** Moving from "AI does what I ask" to "AI follows a process I've defined for this class of work." The skills are standing instructions that constrain and guide future AI behaviour.

### Day 3: Trusting the AI with judgment calls

Day 3 saw a wave of UI polish — page backgrounds, font sizes, metadata layout — that went through many iterations in quick succession. The commits show: `fix: change page background from gray-50 to slate-200`, then `to zinc-200`, then `to bg-sky-100`, then `to bg-sky-50`, then `to bg-slate-50`. This is a human using the AI as a fast feedback loop for visual decisions, not a human specifying outcomes and having the AI execute.

This was also the day the security spec was written. Committing to systematic security work on day 3 — before the product had any users — reflects a deliberate choice to treat AI-assisted development as capable of professional-grade output, not just a prototype.

**Key dynamic:** The AI as a collaborator in an iterative design loop, not just a code generator. And growing trust that a rigorous feature (security hardening) could be handled through the same speckit pipeline as a UI component.

### Day 4: Systematic over ad-hoc

Day 4 is the most striking day in the log. Supply chain hardening (exact version pinning, SHA-pinned CI actions, lifecycle script allowlist, dependency advisory blocking), security hardening (21 tasks), real E2E tests, and a full 6-phase user onboarding feature — all in one day, all through the speckit pipeline.

This only worked because of the trust established in the previous three days. Evidence had accumulated that the AI could handle security-sensitive work, systematic test writing, and multi-phase features. Day 4 used that trust to stack ambitious work.

The `/e2e` skill was also added on day 4. The pattern of "encode the process into a skill once, reuse it repeatedly" was now an established habit.

**Key dynamic:** Compounding returns. Earlier investment in process (speckit pipeline, committed skills, constitution) meant day 4 could move faster and more safely than day 1 despite being more ambitious.

### Day 5–6: Docs and GTM as first-class outputs

The final days show another shift: the AI being used not just to write application code but to produce artifacts that require judgment — architecture documentation, a CLI comparison spec, a go-to-market analysis. The GTM document required the AI to research an external product (OpenClaw), synthesise findings, and produce a reasoned recommendation across four decisions. That is a different kind of task than implementing T047.

This reflects a mature working relationship with AI tools: comfort delegating research and synthesis, not just implementation.

**Key dynamic:** AI as a thinking partner on strategic questions, not just a coding tool. The retrospective you are reading now is the endpoint of that evolution.

---

### How security was added in

Security on Argus was not an afterthought bolted on before launch. It was done in a deliberate two-phase sequence, both phases going through the full Speckit pipeline, and both completed before the product had any users.

**Why it happened when it did**

The trigger was straightforward: by day 3, Argus could stop AI processes, inject hooks into Claude's settings file, read all session output, and execute filesystem operations based on user-supplied paths. These are significant capabilities. Running with no security model would have meant building on a foundation that needed to be torn up later. Scoping security work as a named feature (009) on day 3 was a deliberate choice to treat it as first-class work rather than a cleanup item.

**Feature 009 — Application security hardening (Day 3, merged Day 4)**

Spec written, planned, and tasked on day 3. Implemented and merged on day 4. 21 tasks across five areas:

- **Process control:** Stop and interrupt routes now validate PID ownership in two stages. First, the session must have a PID on record. Second, the OS process at that PID must match the AI tool allowlist (Claude/Copilot executables). Requests that fail either check are rejected with 422 or 403. This prevents the stop/interrupt endpoints from being used as a general-purpose process killer.
- **Shell injection:** All `taskkill` calls on Windows replaced with `spawnSync` using an explicit args array. No shell string interpolation anywhere in process control.
- **Hook endpoint hardening:** `POST /hooks/claude` now enforces a 64 KB body limit, validates `session_id` as UUID v4, rejects `cwd` values not in the registered repository list, and returns 409 if a payload tries to overwrite an active session's PID.
- **Filesystem sandboxing:** Browse, scan, and scan-folder endpoints resolve all user-supplied paths and validate them against `homedir()` and registered repository paths. Anything outside that boundary returns 403. Recursive scans skip symlinks to prevent traversal loops.
- **HTTP headers:** `X-Content-Type-Options: nosniff` and `X-Frame-Options: DENY` added to all responses.

The implementation produced 164 passing tests across 18 test files, including new contract tests for the security headers, hook endpoint validation, path sandboxing, PID validation, and session controller.

**Feature 010 — Supply chain hardening (Day 4)**

Immediately after the application security feature merged, supply chain protection was scoped as a separate feature. This addresses a different threat model: not "what can a user do to the system" but "what can a malicious dependency do during install or CI."

- `npm ci --ignore-scripts` in CI: suppresses all `postinstall`/`prepare` scripts. Only packages on an explicit allowlist (`.github/supply-chain/lifecycle-allowlist.yml`) are rebuilt via `npm rebuild`.
- Action SHA pinning: every `uses:` directive in every workflow file must reference a 40-character commit SHA. A validation script (`validate-action-pins.sh`) runs on every CI build and fails if any reference is unpinned.
- Exact dependency versions: all entries in `package.json` use exact versions (no `^` or `~`). Combined with lockfile enforcement, this eliminates version drift.
- Dependency advisory check (`supply-chain.yml`): PRs to master that add a dependency with a critical advisory or malicious flag are blocked before merge.
- Critical CVE audit: `npm audit --audit-level=critical` runs on every build.

**Feature 011 — Dependency CVE patches (Day 4)**

Ran immediately after 010. Patched 7 known CVEs in existing dependencies and pinned exact versions across the board. Merged the same day.

---

### How GitHub Actions and CI evolved

The CI pipeline grew incrementally, each addition driven by a specific gap that was discovered in practice.

**Before CI existed (Days 1–2)**

There was no CI. Tests ran locally before merge via the `/merge` skill's gate check. This was sufficient while the project was one person on one machine, but it meant the test suite was only ever run on Windows. Linux-specific failures and cross-platform path handling bugs would only surface if someone else tried to run the project — or if CI ran on a Linux runner.

**Day 4: First CI pipeline (`ci.yml`)**

The first GitHub Actions workflow was created as part of supply chain hardening (feature 010). It ran on every push and PR:

- `npm ci --ignore-scripts` (lockfile enforcement + no lifecycle scripts)
- Selective `npm rebuild better-sqlite3` (native module, allowlisted)
- Backend Vitest tests
- Frontend Vite build
- `npm audit --audit-level=critical`
- Action SHA pin validation script

The second workflow (`supply-chain.yml`) ran only on PRs to master and used `actions/dependency-review-action` to check new dependencies for known advisories.

The same day, frontend unit tests were added to the pipeline in a separate commit — they had been missing from the initial CI setup because the frontend test infrastructure was added mid-feature.

**Day 4: First cross-platform failure discovered**

Running on GitHub's Linux runners immediately exposed path-handling bugs that had not appeared on Windows. The filesystem sandbox tests used Windows-style backslash paths in their fixtures, which failed on Linux. Fixed the same day with a cross-platform path normalisation pass.

**Day 5: Pipeline hardening**

Three additions:

- Backend build step: TypeScript compilation now runs in CI before tests. Previously, a type error that only appeared after `tsc` (not caught by Vitest's ts-node transform) could pass CI. Adding `tsc --noEmit` as a CI gate caught this class of failure.
- Playwright mock E2E suite: the mocked E2E tier (which runs against a Vite-served frontend with MSW mocks, no live backend) was added to CI. The real-server E2E tier still runs locally only, as it requires a live database and session fixtures.
- Scope narrowing: CI was restricted to master pushes and PRs targeting master. Feature branch pushes no longer trigger the full pipeline, reducing noise and runner cost.

**Day 5: Intentional CI failure to verify the pipeline**

A deliberate type error was committed (`test: intentional type error to trigger CI failure`) to verify that the new TypeScript build step actually blocked merges. It did. The commit was immediately reverted. This is the correct way to validate a new CI gate — trust but verify.

**Day 6: CI monitoring integrated into /merge**

The `/merge` skill was updated to watch the GitHub Actions run after pushing the merge commit. Previously, "pushed to remote" was treated as "done." With the update, the skill polls the CI run status and only declares the merge complete when the workflow passes. Branch deletion was also moved to after CI passes — preventing a state where the branch is gone but the master build is red.

The poll timeout was extended from 3 to 5 minutes after it clipped the longer-running E2E and TypeScript build steps on a slow runner.

---

### How the skills evolved

Skills are reusable instructions committed to the repository that tell the AI how to handle a class of work. The first ones were created because doing the same thing twice by hand, with the AI, produces inconsistent results. Each skill encodes the lessons of previous sessions so they do not have to be re-learned.

**Day 2: /bug**

Created after the first wave of real-usage bugs. Before this skill existed, a bug fix was ad-hoc: describe the bug, get a fix, maybe write a test. After it, every bug fix follows the same path: add a bug task to tasks.md, investigate root cause before touching code, implement the fix, add a regression test, add an entry to README-LEARNINGS.md. The skill was immediately enhanced on the same day to require both the regression test and the learnings entry — two things that were easy to skip under pressure.

**Why it matters:** Bugs are the main source of drift in a long-running AI project. A bug fixed without a regression test will come back. A bug fixed without a learnings entry means the same root cause (e.g., null-PID falsy check, js-yaml Date coercion) can bite again in a different form. The skill turns every bug into a durable improvement to the codebase and to the AI's context for future sessions.

**Day 2: /merge**

Created on the same day, after 001-session-dashboard was ready to merge. The initial version ran a constitution gate check — the AI would verify the branch did not violate any of the constitution's principles before merging. The insight was that merging is the highest-risk moment in the Speckit workflow: it is the point where work becomes permanent and visible on master. Adding a gate here is cheap and catches problems that are easy to miss when you are close to the work.

**Day 4 enhancements:** The /merge skill was extended to run all test suites (unit, integration, contract, mock E2E, real-server E2E) before merging. This was added after the real E2E test infrastructure was in place — there was no point gating on tests that did not yet exist. Branch auto-delete was also added on day 4: the feature branch is deleted locally and remotely after a successful merge, keeping the repo clean.

**Day 6 enhancements:** Two more additions. First, the CI workflow is now monitored after the merge push — the skill waits for GitHub Actions to pass before declaring the merge complete, rather than treating "pushed to remote" as "done." This caught cases where a merge that looked clean locally failed CI. Second, the branch deletion was moved to after CI passes rather than after push, preventing a half-merged state where the branch is gone but CI is red. The poll timeout was also extended to 5 minutes after it was clipping long test runs.

**Day 4: /e2e**

Created after the real-server E2E test tier was established. Writing Playwright tests by hand for each new success criterion was slow and inconsistent between features. The skill encodes the codebase conventions — which test tier to use, how to set up fixtures, how to handle the real-server vs mock distinction — so that any new feature gets E2E coverage that matches existing patterns.

**Enhanced on day 4:** Updated to require both tiers (mocked and real-server) rather than just one. The mocked suite runs in CI without a live backend; the real-server suite validates the full request path. Both are necessary for different failure modes, and the skill enforces that neither is skipped.

**Day 6: /pull**

A simple addition: pull latest changes from master into the current feature branch. Added because merging long-running feature branches was creating conflicts, and the manual process of pulling was easy to forget before starting a new session. The skill handles the fetch, merge, and conflict resolution in one step.

**Day 6: /speckit.run**

Created to chain the entire Speckit pipeline — specify, clarify, plan, tasks, analyze, implement — into a single command. Before this, starting a new feature required running each step manually and waiting between them. /speckit.run pauses only for the interactive clarification Q&A and for critical analysis findings; everything else runs automatically. The clarification question limit was also removed (it had been capped at 5) after it was truncating useful questions on complex features.

---

### Patterns that emerged

| Practice | When it appeared | What it unlocked |
|----------|-----------------|------------------|
| Speckit pipeline (spec → clarify → plan → tasks → implement) | Day 1 | Structured runs the AI can execute without constant supervision |
| /bug skill | Day 2 | Every fix gets a regression test and a learnings entry; no drift |
| /merge skill | Day 2 | Constitution gate + test suite gate before every merge |
| /merge: full test run | Day 4 | No merge without all test tiers passing |
| /merge: CI gate + branch cleanup | Day 4 / Day 6 | Branch lifecycle managed automatically; CI failure blocks completion |
| /e2e skill | Day 4 | Consistent Playwright coverage on every new feature |
| /pull skill | Day 6 | Clean branch sync before each session |
| /speckit.run | Day 6 | Full pipeline in one command; no manual chaining |
| Constitution | Day 1 | Non-negotiable principles enforced at merge time |
| Research and synthesis delegation | Day 6 | Strategic documents produced alongside code |

---

## Day 7 — April 7, 2026

**PTY prompt delivery — send prompts actually work.**

Feature 020 shipped. The core problem: the prompt bar had always accepted text and called `POST /sessions/:id/send`, but no mechanism existed to actually deliver the text to the running process. The `SessionController.sendPrompt()` created a ControlAction with `status: 'sent'` and stopped there.

**Root cause investigation**
Stdin injection was the first candidate and was ruled out fast. macOS removed `TIOCSTI` in 2022 (kernel security patch); it was never reliably available for non-spawned processes on Windows either. The file-based hook injection Claude Code uses only carries structured JSON payloads, not raw text. There was no channel from Argus to the running process's stdin.

**PTY launcher solution**
The solution: instead of detecting existing processes and trying to inject into them, Argus now optionally owns the process lifecycle. `argus launch claude` (or `copilot`) spawns the tool inside a PTY using `node-pty` (the same library VS Code uses: Windows ConPTY on Windows, POSIX PTY on Mac/Linux). The Argus process holds the PTY master handle and can write to it at will.

The launch process connects back to the backend over a WebSocket at `/launcher`. The backend registers the connection in a `PtyRegistry` singleton keyed by session ID. When `POST /sessions/:id/send` arrives, `SessionController` looks up the registry, sends a `send_prompt` message to the launcher, and waits (up to 10 seconds) for a `prompt_delivered` or `prompt_failed` ack. The ControlAction status is updated asynchronously.

**Frontend changes**
Sessions now carry a `launchMode` field (`'pty'` or `'detected'`). The session card shows a green "live" badge for PTY sessions and a grey "read-only" badge for detected ones. The prompt bar disables its input and button for read-only sessions, and the container tooltip explains how to enable injection.

**Windows build issue**
`node-pty` requires native compilation. The pre-built packages (`node-pty-prebuilt-multiarch`, `@homebridge/node-pty-prebuilt-multiarch`) had no Windows binaries. Building from source with `npm install node-pty --msvs_version=2022` succeeded once VS 2022 build tools were confirmed installed.

**Tests**
Backend: 7 new test files covering PtyRegistry, ArgusLaunchClient, launch-command-resolver, and the `/launcher` WebSocket route. Unit test mocking used `vi.hoisted()` for the WebSocket mock factory. Frontend: 7 new unit tests for SessionCard PTY badges and SessionPromptBar read-only state. E2E: full mocked suite (sc-020) and real-server suite (sc-020-real) added.

**Key dynamic:** The shift from "detect what is running" to "own the process lifecycle when control is needed." Detection remains available for visibility; ownership is opt-in via `argus launch`. This keeps the monitoring experience unchanged while unlocking prompt delivery without platform-specific hacks.

---

## Day 1 — March 31, 2026

**Enlistment and full first feature shipped end-to-end.**

The repository was created and immediately bootstrapped with the full Speckit SDD infrastructure: CLAUDE.md, Copilot instructions, Specify/Speckit setup, and the constitution ratification workflow. The Argus constitution was ratified at v1.0.0, restructured to v1.0.1 for readability, then amended to v1.1.0 to add exception clauses.

From there, feature 001 (Session Dashboard) went through the full speckit pipeline in one day: specify, clarify, plan, tasks, analyze (resolving all 15 findings), and implement. By end of day every task from T001 to T052 was complete:

- Monorepo structure (npm workspaces, backend + frontend)
- Backend: SQLite schema, database helpers, ArgusConfig loader, TypeScript models, Fastify server with WebSocket event dispatcher, Copilot CLI detector, Claude Code detector with hook injection, session monitor orchestrator, output store, repository and session REST routes, hooks endpoint
- Frontend: Vite + React + Tailwind setup, TanStack Query, WebSocket client with exponential backoff, Dashboard page with repository cards and session counts, SessionCard component with type and status badges, SessionPage with live output stream, ControlPanel with stop and send-prompt

The core architecture — file-system detection, SQLite storage, WebSocket push, React SPA — was fully established on day one.

---

## Day 2 — April 1, 2026

**First merge, four features, substantial bug fixing, and tooling additions.**

Feature 001 merged into master. The rest of the day stacked four more features on top:

**Feature 005 — Dashboard Settings**
Added show/hide controls for ended sessions, and a separate setting to hide repos with no active sessions. Settings are persisted in localStorage.

**Feature 006 — Session Detail UX Redesign**
Rewrote the session detail view in response to real usage feedback: unified dark output stream, a unified prompt bar across session types, official Claude/Copilot brand icons, inactive session detection, and removal of the stop button from the detail page.

**Feature 007 — Claude Code Live Output and Model Display**
Claude Code sessions now stream output in real time via the JSONL file watcher. Model name appears as a badge on each session card. Role labels (YOU/AI/TOOL/RESULT) added to output lines. Several active-state bugs fixed.

**Repository management**
Replaced the original folder-browser modal with a native OS folder picker dialog. Added "scan folder" bulk import — pick a parent directory and Argus registers every git repo it finds inside. Added a "don't ask again" checkbox to the remove-repo confirmation dialog.

**Bug fixes (logged)**
- Null-PID falsy check was marking valid sessions as stale
- Windows psList does not include cwd, breaking session matching
- js-yaml was coercing ISO timestamps to Date objects, breaking Copilot CLI session detection
- Sessions were not being marked ended when their process stopped
- Stale active sessions from a previous run were not being reconciled on startup

**Skills added**
- `/bug` — adds a bug task to tasks.md, investigates, fixes, and commits
- `/merge` — runs a constitution-gate check then merges to master

---

## Day 3 — April 2, 2026

**Architecture documentation, output stream polish, a wave of bug fixes, and security planning.**

Added a formal architecture document (README-ARCH.md) with a Mermaid flowchart. Added `tsx --watch` for hot-reload during backend development.

**Output stream improvements**
Two-column layout for output lines (badge column + content column). Markdown rendering for AI response text. Consistent dark preview strip across all session cards. Resting/running status icons for sessions in different states.

**UI polish pass**
Metadata sizing (model name, PID, elapsed time, session ID) standardised to `text-[10px]` font-mono. All metadata coloured uniformly. Page background settled on `bg-slate-50` after several iterations. `Add Repository` button sizing and padding refined.

**Bug fixes (T084–T094)**
- Browser timezone used for timestamps instead of hardcoded PST
- Raw JSON was leaking into tool event content (Copilot CLI parser cleanup)
- Copilot CLI sessions never showed a model name (model now extracted from `data.model` on tool completion events)
- Copilot CLI nested `data` object format was not being parsed (flat and nested formats now both handled)
- Claude Code session ID was derived from hook payload instead of JSONL filename, causing phantom sessions
- `Stop` hook was setting status to `ended` instead of `idle`
- Claude Code sessions were not ending when the process exited (periodic PID liveness check added)
- Stale null-PID Claude Code sessions now cleaned up using JSONL file freshness (30-minute threshold)

**Feature 009 scoped**
Security hardening specification, plan, and task list created for the next day's work.

---

## Day 4 — April 3, 2026

**Security hardening, supply chain protection, real E2E tests, user onboarding, and CI expansion.**

Four features merged into master.

**Feature 004 — Real-Server E2E Tests**
A second Playwright tier that runs against a live backend with an isolated database. Tests cover the full request/response cycle including session detection and WebSocket events.

**Features 009 and 010 — Security Hardening and Supply Chain**
All 21 security tasks complete:
- Process control: stop/interrupt validate PID ownership in two stages (session record + OS process allowlist check)
- Shell injection: all `taskkill` calls use `spawnSync` with an explicit args array
- Hook endpoint: UUID v4 validation, 64 KB body limit, cwd allowlist, PID-overwrite rejection with 409
- Filesystem routes: all user-supplied paths validated against homedir and registered repos, symlink traversal blocked
- HTTP headers: `X-Content-Type-Options` and `X-Frame-Options` on all responses

Supply chain hardening (feature 010):
- `npm ci --ignore-scripts` in CI; lifecycle allowlist for packages that need to rebuild
- All GitHub Action `uses:` directives pinned to 40-character commit SHAs
- Exact dependency versions (no `^` or `~`) in all package.json files
- Lockfile integrity enforced in CI
- Dependency advisory check on PRs to master
- 7 known CVEs patched; pinned version validation script added to CI

**Feature 012 — User Onboarding**
Full 6-step interactive tour using React Joyride. Auto-launches on first dashboard load. Settings panel exposes restart and reset controls. Three dismissible hint badges on the session detail page. 30 tasks across 7 phases, all complete.

**Frontend unit tests**
68 unit tests added across 6 components and hooks, integrated into the CI pipeline.

**Tooling**
- `/e2e` skill added for writing Playwright tests following codebase conventions
- Branch auto-delete after successful merge
- Duplicate agent/prompt files removed (CLAUDE.md is the single source of truth)
- ARGUS_PORT environment variable honoured by config loader

---

## Day 5 — April 5, 2026

*(No commits on April 4.)*

**CI hardening, todo list feature, onboarding polish.**

**CI pipeline expansion**
- Backend build step added so TypeScript compilation errors block merge
- Playwright mock E2E suite added to CI
- Pinned-version validation runs on every build
- CI scope narrowed to master pushes and PRs targeting master

**Feature 014 — Engineer Todo List ("To Tackle")**
A persistent task panel on the right side of the dashboard. Items are stored in SQLite. Full backend (REST CRUD) and frontend (React panel with add, check off, delete). Complete test coverage: unit tests, mocked E2E, real-server E2E.

**Onboarding polish**
Tour tooltip restyled to match the app theme. Tour copy rewritten with friendlier messaging. All E2E onboarding tests passing against both mock and real-server tiers. Tour suppressed in E2E test runs to prevent overlay blocking click targets.

---

## Day 6 — April 6, 2026

**Todo panel UX overhaul, docs restructure, and GTM planning.**

**Todo panel UX (feature 014 extension)**
After the initial implementation, the panel received a full UX redesign:
- Inline editing (click any item to edit in place, no separate edit mode)
- Hover delete button overlaid on the timestamp
- Relative timestamps on each item, toggleable
- Toggle to show/hide completed items
- Newest items appear at the top
- Textarea replaces input for multiline content
- Output pane and todo panel share a right column, stacked

**Merged feature 014** into master after all tests passing.

**Feature 015 — Docs Cleanup (in progress)**
- Created `docs/` folder and moved all `README-*.md` files into it
- Renamed `BUG-LEARNINGS.md` to `README-LEARNINGS.md` and `MANUAL-TESTS.md` to `README-MANUAL-TESTS.md`
- Removed all em dashes from documentation (style rule: use comma, colon, or parentheses instead)
- Restructured `README.md` as a user-facing document; moved contributor content to `README-CONTRIBUTORS.md`
- Added `README-CLI-COMPARISON.md` comparing Claude Code and Copilot CLI stream formats, parsers, state models, and data availability — with example JSONL messages for each event type
- Added `README-GTM.md` exploring go-to-market decisions (public vs private, desktop vs web, login vs no login) using OpenClaw as the primary reference, with a side-by-side comparison table

**New skills**
- `/pull` — fetches latest from master and merges into the current branch
- `/speckit.run` — runs the full Speckit pipeline end-to-end from a single feature description
- Merge skill updated: waits for CI to pass before deleting the feature branch
