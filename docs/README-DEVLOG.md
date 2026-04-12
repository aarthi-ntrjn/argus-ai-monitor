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

## Feature Timeline

| Feature | Branch | Shipped | Description |
|---------|--------|---------|-------------|
| 001 | session-dashboard | Apr 1, Day 1 | Full-stack dashboard: SQLite, WebSocket push, React SPA, Claude Code and Copilot CLI session detection |
| 003 | remove-repository | Apr 1, Day 2 | Remove individual repos; scan a parent folder to bulk-import all git repos inside it |
| 005 | dashboard-settings | Apr 1, Day 2 | Show/hide ended sessions and repos with no active sessions, persisted in localStorage |
| 006 | session-detail-ux | Apr 1, Day 2 | Unified dark output stream, brand icons, inactive session detection, unified prompt bar |
| 007 | session-stream-model-fixes | Apr 2, Day 3 | Real-time JSONL streaming, model badge, role labels (YOU / AI / TOOL / RESULT) |
| 009 | security-review | Apr 3, Day 4 | PID ownership validation, shell injection hardening, path sandboxing, HTTP security headers |
| 010 | supply-chain-hardening | Apr 3, Day 4 | SHA-pinned CI actions, exact dependency versions, lifecycle allowlist, advisory block on PRs |
| 011 | security-dependency-updates | Apr 3, Day 4 | 7 CVEs patched; all packages pinned to exact versions |
| 012 | user-onboarding | Apr 5, Day 5 | Interactive Joyride tour, restart/reset controls in settings, dismissible contextual hints |
| 014 | engineer-todo-list | Apr 6, Day 6 | Persistent task panel: SQLite, inline edit, hover delete, relative timestamps |
| 015 | docs-cleanup | Apr 6, Day 6 | docs/ folder, renamed files, em dash removal, README restructure, CLI comparison, GTM analysis |
| 017 | repo-folder-picker | Apr 6, Day 6 | Text input for add-repo, replacing native OS folder picker |
| 018 | mobile-responsive-layout | Apr 6, Day 6 | Bottom tab bar navigation and mobile-optimised SessionPage layout |
| 019 | fix-output-rendering | Apr 7, Day 7 | Blank row fix for Copilot output, content-block array support, session summary from last user prompt |
| 020 | fix-send-prompts | Apr 7-8, Day 7-8 | PTY launcher via node-pty: PtyRegistry, ArgusLaunchClient WebSocket, live/read-only badges, prompt delivery |
| 021 | session-pid-mapping | Apr 10, Day 9-10 | Exact Claude PID mapping via ~/.claude/sessions/ registry, replacing psList heuristics |
| 022 | test-ghcp-launch | Apr 10, Day 10 | Manual test scaffold and debugging infrastructure for Copilot CLI PTY launch |
| 023 | stream-attention | Apr 10, Day 10 | Focused/verbose output mode, collapsible tool groups, ID-based tool call/result pairing |
| 024 | short-name-ghcp | Apr 11, Day 11 | Win32 keystroke encoding for Copilot PTY; process tree DFS rewrite with spawn-time filtering |
| 025 | yolo-mode | Apr 11, Day 11 | Per-session yolo mode detection, warning dialog, flag injection in commands and PTY launches |
| 026 | configurable-resting | Apr 12, Day 12 | Resting threshold configurable (1-60 min, default 20) in SettingsPanel |

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

## Day 8 — April 8, 2026

**Test documentation restructure, onboarding overhaul, and PTY stabilisation.**

**Manual test documentation restructure**

The single `README-MANUAL-TESTS.md` file was split into 10+ focused files, each covering one area: startup, repository management, view mode, session detail (read-only and live), settings, lifecycle, output stream, mobile layout, onboarding, todo panel, and control tests. Files were renamed to the `README-TESTS-<Foo>.md` convention. Test IDs were renumbered with standalone prefixes (S-, G-, L-, O-, T-) to avoid collisions between files.

The split was driven by file size making it hard to find and update individual tests, and by the need to audit individual areas independently.

**`/review-tests` skill**

A new skill for auditing manual test MD files against the actual source code. Reads each test file, compares steps and expected results against the component code, and reports stale tests, missing coverage, and AI slop. Created because the test files were accumulating inaccurate steps.

**Onboarding tour overhaul**

The Joyride tour was made adaptive:
- Tour now skips repository and session steps when the dashboard has no sessions yet. A catch-up mini-tour fires when the user adds a repo mid-tour.
- New step: "To Do or Not To Do" for the todo panel.
- New step: "Launch with Argus" explaining command mode vs view mode.
- Tour rewritten from 6 steps to 7; "commander and army" language removed; Customize step removed.

**PTY and session fixes**

T111: PTY sessions were staying running after `/exit` because `process.exit()` was called before the WebSocket flush completed. Fixed with an explicit flush await before exit. The kill button on session cards was redesigned as a kill modal that distinguishes live (PTY) from read-only behaviour.

Escape key in the prompt bar now sends an interrupt to the CLI session.

**Infrastructure**

`reset-db.ps1` added to delete the SQLite database for a clean start (sends files to Recycle Bin). `README-DB.md` added documenting the database schema and sqlite-utils inspection workflow. Argus logo and favicon updated.

**Key dynamic:** The retrospective on Day 12 identified Day 8 as the heaviest day for user corrections on the 020 branch: three sessions with AI assumptions about read-only session input, the PTY session lifecycle, and kill button targeting. Restructuring the test docs into focused files was the direct response.

---

## Day 9 — April 9, 2026

**Feature 021 built end-to-end in a single day.**

**Feature 021 — Session PID Mapping**

The full speckit pipeline (spec, clarify, plan, tasks, implement, polish) for feature 021 completed in one day. The core change: Claude Code session detection switches from `psList` process scanning to reading `~/.claude/sessions/`, a registry file that Claude Code maintains with session ID to PID mappings. This makes PID resolution exact and eliminates the class of false positives from process-name matching heuristics.

7 phases, 26 tasks. Key work: DB schema migration adding a `pidSource` column, a new `ClaudeSessionRegistry` class, updated poll cycle integration, Copilot session hardening, and documentation. 239 tests passing at end of day.

**Session lifecycle fixes**

A cluster of edge cases addressed alongside 021:
- PTY registry normalised to case-insensitive path matching on Windows.
- `Stop` hook handling reverted and re-applied to detect `/exit` typed in-session.
- 60-second grace period added for new sessions before JSONL reconciliation starts.
- JSONL watcher closed when a session is re-created after a repo re-add.
- PTY sessions excluded from JSONL/PID reconciliation to prevent premature session ending.

**UI fixes**

Todo panel max height constrained to viewport to prevent scrollbar overflow when the output pane is open. Session card output preview set to a fixed 2-line minimum height for visual consistency.

**Key dynamic:** Feature 021 is an example of the speckit pipeline working at full speed on a complex infrastructure task. The entire replacement of a heuristic-based detection mechanism with a registry-based one, across backend, database, and two detector classes, was done in one continuous session.

---

## Day 10 — April 10, 2026

**Four features merged and a major session lifecycle refactor.**

**Feature 021 — Session PID Mapping (merged)**

021 merged into master, followed immediately by 021-fix-test-documentation (a small branch fixing documentation and test assertions after the main merge).

**Feature 022 — Test GHCP Launch**

Spec and manual test infrastructure for verifying that Copilot CLI sessions launched via `argus launch copilot` are correctly detected and tracked. The feature established a structured debugging workflow for the Copilot PTY delivery problem, which had been intermittently failing. Also triggered removal of the Kill Session button from session cards (limited value, complicated the session state model).

**Feature 023 — Stream Attention (focused/verbose output mode)**

The output stream now has two display modes: focused (default) and verbose. In focused mode, consecutive tool calls collapse into a single expandable group. Tool names appear in the content column rather than the badge column. The mode toggle persists globally via localStorage. Tool call and result pairing now uses tool call IDs (with a positional fallback for legacy database rows without IDs).

**Session lifecycle refactors**

Several foundational changes merged:
- `SessionEnd` hook triggers instant Claude session termination rather than waiting for the next poll cycle.
- `hostPid` (the shell wrapper process) and `pid` (the AI tool process) are now tracked separately.
- 3-way startup reconciliation: on server start, active sessions are matched against DB records and the PTY registry simultaneously.
- Copilot sessions claimed via a `workspace_id` WebSocket message rather than by `repoPath` string matching.
- Ended sessions no longer retry PTY claims on every scan cycle.

**Copilot PTY delivery (ongoing)**

PTY write delivery to Copilot CLI was still failing intermittently. Debugging continued: workspace watcher logic, `stdin.push` vs `pty.write`, focus-in/focus-out events, `Enter` sequencing. The root cause was not yet resolved on Day 10 but the diagnostic infrastructure (temp-file logging, PTY write feedback via WebSocket) was in place.

**Key dynamic:** Days 10 and 11 show rapid iteration when a problem has been isolated but not yet solved. The Copilot PTY delivery bug drove 30+ commits across two days before the Win32 keystroke encoding solution was found.

---

## Day 11 — April 11, 2026

**Three features shipped, the `/retrospective` skill created, and 35+ UI polish commits.**

**Feature 024 — Copilot PTY delivery (short-name-ghcp, merged)**

The Copilot PTY input delivery problem was resolved. Two root causes were fixed:
- Windows PTY processes do not accept raw UTF-8 writes. Each keystroke must be encoded as a Win32 input sequence (key-down + key-up pair). The fix encodes prompt text as Win32 input records before writing to the PTY.
- The PID resolver had been finding a hallucinated PID from stale WMI query results. Rewritten to use a single process snapshot with a DFS walk, filtered by spawn time to disambiguate duplicate process names.

**Feature 025 — Yolo mode (merged)**

Argus now detects and displays yolo mode status per session (from the `settings.json` `bypassPermissionsMode` field). Three-state model: `null` (not yet scanned), `true`, `false`. The yolo badge appears on session cards. The yolo flag is injected into commands generated by the "Copy command" button and into PTY-launched sessions via `ArgusConfig`. A warning dialog appears before launching in yolo mode.

**Feature 026 — Configurable resting threshold (built and complete)**

The 20-minute resting threshold (when the session badge changes from "running" to "resting") was hardcoded. Feature 026 moved it to a configurable field in SettingsPanel with a numeric input (1-60 minutes, default 20), persisted in `DashboardSettings` and propagated to the `isInactive` utility. Full speckit pipeline and all tasks completed within the same day.

**`/retrospective` skill**

Created a new skill for scanning Claude Code and Copilot JSONL session histories for user-specified behavioral patterns (cycles, corrections, decision reversals, failed tool loops). The skill went through six iterations across the day: correcting the Copilot session location, fixing large-file handling by skipping tool payloads, adding thinking-block analysis, writing output to `docs/RETROSPECTIVE-<SLUG>.md`, marking the constraints section as CRITICAL, and updating the description.

**`/coding-styles` skill**

A new skill documenting the project's writing and code style rules, starting with the em dash rule.

**UI polish**

35+ `chore(ui):` commits: badge renaming (live badge became "connected"), yolo mode badge styling, session header layout (session ID moved into output pane header), back button style, prompt bar padding, todo panel title font, output pane border. The `OutputPane` component was extracted as a shared component used on both the dashboard and SessionPage. `SessionMetaRow` was extracted as a shared component used in `SessionCard` and `SessionPage`.

**Key dynamic:** Day 11 is the densest single day in the project. Three features shipped, a new skill category (retrospective analysis) introduced, and the UI had its most thorough polish pass. The Copilot PTY delivery fix was the hardest problem in the project to date, taking parts of Days 8-11 to solve.

---

## Day 12 — April 12, 2026

**Feature 026 merged, retrospective analysis run, and skill hardening.**

Feature 026 merged after three post-merge fixes: the resting threshold maximum was capped at 60 minutes (the input had no upper bound), the save trigger was changed from blur to every-valid-change so closing the dropdown never discarded an in-flight edit, and the text Reset button was replaced with a `RotateCcw` icon to match the settings UI style.

**Retrospective analysis**

The `/retrospective` skill was run twice across the full `argus*` project set (argus, argus2, argus3, argus4):
- 80 sessions scanned for user corrections: 8 sessions matched. Corrections clustered on `024-short-name-ghcp` (PTY process ID hallucination) and `020-fix-send-prompts` (three sessions with incorrect assumptions about read-only session input and session state). One correction on `025-yolo-mode` involved three escalating corrections on the same session before the user demanded a revert.
- 65 sessions scanned for AI cycles: 2 sessions matched. The clearest cycle was a tsx binary search loop on `004-real-e2e-tests` (same `ls` commands repeated twice within 2 minutes before running `npm install`).

Reports written to `docs/RETROSPECTIVE-USER-CORRECTIONS.md` and `docs/RETROSPECTIVE-CYCLES.md`.

**Skill update**

The `/retrospective` skill was updated to require the repo path pattern as a mandatory argument. Running the skill without specifying paths now stops immediately and asks, rather than defaulting to the current directory.

**Key dynamic:** Running a retrospective on the project's own AI sessions while the project is still active creates a tight feedback loop. The corrections report identified specific branches and problem domains (PTY process trees, read-only session state) where the AI was consistently unreliable. Those become areas to verify before trusting AI output rather than after.

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
