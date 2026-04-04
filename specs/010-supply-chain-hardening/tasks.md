# Tasks: Supply Chain Attack Protection

**Input**: Design documents from `/specs/010-supply-chain-hardening/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ci-workflows.md ✅

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1–US4)
- Exact file paths included in all descriptions

---

## Phase 1: Setup

**Purpose**: Create the directory structure required by all subsequent phases. No existing `.github/workflows/`, `.github/scripts/`, or `.github/supply-chain/` directories exist — this is a greenfield CI setup.

- [x] T001 Create directories `.github/workflows/`, `.github/scripts/`, and `.github/supply-chain/` at the repository root

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Two shared resources — resolved action SHAs and the lifecycle allowlist — must exist before any workflow file can be written correctly. Both can be created in parallel.

**⚠️ CRITICAL**: US1 (T004–T005) cannot begin until T002 is complete; US3 (T008) cannot begin until T003 is complete.

- [x] T002 [P] Resolve immutable commit SHAs for the three pinned actions by running `git ls-remote https://github.com/actions/checkout refs/tags/v4`, `git ls-remote https://github.com/actions/setup-node refs/tags/v4`, and `git ls-remote https://github.com/github/dependency-review-action refs/tags/v4`; for each, follow the tag object to its commit SHA using `git ls-remote --deref`; record all three SHAs as comments at the top of `.github/supply-chain/action-shas.md` (new file) in the format `actions/checkout@v4 = <40-char-sha>`
- [x] T003 [P] Create `.github/supply-chain/lifecycle-allowlist.yml` (new file) with the schema comment header and a single entry for `better-sqlite3` (`reason: "Compiles native SQLite bindings via node-gyp. Required for the backend database layer."`, `environments: [ci, local]`) per the schema defined in `data-model.md`

**Checkpoint**: Confirm `.github/supply-chain/action-shas.md` contains three 40-char SHAs and `.github/supply-chain/lifecycle-allowlist.yml` is valid YAML before proceeding.

---

## Phase 3: User Story 1 — Dependency Integrity Is Enforced in CI (Priority: P1) 🎯 MVP

**Goal**: Every CI run installs dependencies exclusively from the committed lockfile. A missing or tampered lockfile causes the build to fail immediately. Backend tests and frontend build are also gated here.

**Independent Test**: Push a commit that deletes `package-lock.json` → CI must fail at the install step with a lockfile-absent error. Revert → CI must pass through install, tests, and build.

- [x] T004 [US1] Create `.github/workflows/ci.yml` (new file) with: `on: [push, pull_request]` triggers targeting all branches for push and `master` for PRs; a single job `build-and-test` on `ubuntu-latest`; a checkout step pinned to the SHA recorded for `actions/checkout@v4` in `action-shas.md` (with `# v4` inline comment); a setup-node step pinned to the SHA recorded for `actions/setup-node@v4` (with `node-version: '22'` and `# v4` inline comment); and an `npm ci --ignore-scripts` step (with a comment explaining lockfile enforcement and script suppression)
- [x] T005 [US1] Add three further steps to `.github/workflows/ci.yml` after the install step: (1) `npm test --workspace=backend` to run Vitest; (2) `npm run build --workspace=frontend` to run the TypeScript + Vite build; (3) `npm audit --audit-level=critical` to fail on critical CVEs in the lockfile

**Checkpoint**: Push the workflow and verify the Actions tab shows a green `build-and-test` run that installs deps, runs 164 backend tests, builds the frontend, and passes audit.

---

## Phase 4: User Story 2 — Build Pipeline Actions Are Pinned to Immutable References (Priority: P1)

**Goal**: All third-party action `uses:` references in every workflow file include a full 40-character commit SHA. An automated step in CI catches any future unpinned addition before it can merge.

**Independent Test**: Add a workflow step with `uses: actions/cache@v3` (no SHA) → the validation step must fail and print the offending file and line. Replace with `uses: actions/cache@<sha> # v3` → validation must pass.

- [x] T006 [P] [US2] Create `.github/scripts/validate-action-pins.sh` (new file, executable) — a POSIX shell script that: iterates every `.yml` file under `.github/workflows/`; for each line matching `uses:`, extracts the value after `uses:`; skips values starting with `./` (local actions exempt); checks the remaining values for the pattern `@[0-9a-f]{40}` using `grep -P`; prints `UNPINNED: <file>:<lineno>  <uses-value>` for each violation and increments an error counter; exits with the error count (0 = all pinned, >0 = violations found)
- [x] T007 [US2] Insert a `validate-action-pins.sh` execution step into `.github/workflows/ci.yml` immediately after the checkout step (before the setup-node and install steps) with `run: bash .github/scripts/validate-action-pins.sh` and a `name: Validate action SHA pins` label — positioning it first ensures pin violations are caught before any tool is downloaded

**Same-file sequential constraint**: T007 must follow T004 (ci.yml must exist) and T006 (script must exist).

---

## Phase 5: User Story 3 — Postinstall Scripts Cannot Execute Arbitrary Code During Installation (Priority: P2)

**Goal**: Lifecycle scripts from non-allowlisted packages never execute in CI. Allowlisted packages (currently `better-sqlite3`) are rebuilt via `npm rebuild` after the suppressed install, preserving their native functionality.

**Independent Test**: Inspect the CI run logs for the `npm ci --ignore-scripts` step — confirm `better-sqlite3` postinstall is not listed there. Confirm a subsequent `npm rebuild better-sqlite3` step appears and succeeds. Run the backend tests — confirm they pass (proving the SQLite native module loaded correctly from the rebuild).

- [x] T008 [US3] Add a `Rebuild allowlisted packages` step to `.github/workflows/ci.yml` immediately after the `npm ci --ignore-scripts` step (and before the pin validation step): the step reads `.github/supply-chain/lifecycle-allowlist.yml` using a shell `yq` or Python one-liner to extract package names where `environments` includes `ci`, then runs `npm rebuild <package>` for each; add a `name: Rebuild allowlisted lifecycle packages` label and a comment explaining why this step exists

**Note**: If `yq` is not available on the ubuntu-latest runner, use a Python one-liner: `python3 -c "import yaml,sys; [print(e['package']) for e in yaml.safe_load(sys.stdin)['allowed'] if 'ci' in e['environments']]" < .github/supply-chain/lifecycle-allowlist.yml`

---

## Phase 6: User Story 4 — New Dependencies Are Vetted Before Acceptance (Priority: P2)

**Goal**: Every PR that adds or changes a dependency triggers an automated advisory-database check. PRs introducing packages with critical or malicious advisories are blocked without manual reviewer intervention.

**Independent Test**: Open a PR that adds a package with no advisories → dependency-review step passes and produces no blocking output. Simulate a critical-advisory dependency by temporarily configuring `fail-on-severity: low` → the step fails on any advisory present; revert to `critical`.

- [x] T009 [US4] Create `.github/workflows/supply-chain.yml` (new file) with: `on: pull_request` trigger targeting `master` only; a single job `dependency-review` on `ubuntu-latest`; `permissions: contents: read, pull-requests: write`; a checkout step pinned to the SHA recorded for `actions/checkout@v4`; and a `github/dependency-review-action` step pinned to the SHA recorded for `github/dependency-review-action@v4` (with `# v4` inline comment) configured with `fail-on-severity: critical`

---

## Phase 7: Polish & Cross-Cutting Concerns

- [x] T010 Update `README.md` to add a `## CI & Supply Chain` section (after the existing `## Security Model` section) documenting: (1) the two workflow files and what triggers each; (2) the lockfile enforcement policy and what to do when CI fails on a lockfile mismatch; (3) the action SHA pinning policy and how to pin a new action (using `git ls-remote --deref`); (4) the lifecycle script allowlist location and how to add an exception; (5) the dependency review check and what to do if a PR is blocked by an advisory

---

## Dependencies

```
T001
  ├─ T002 [P]  (resolve SHAs — needed by T004, T009)
  └─ T003 [P]  (lifecycle allowlist — needed by T008)
       └─ T004 [US1]  (ci.yml skeleton with install)
            ├─ T005 [US1]  (ci.yml: test/build/audit steps — same file, sequential)
            └─ T006 [P] [US2]  (validate-action-pins.sh — different file, parallel with T005)
                 └─ T007 [US2]  (integrate pin validation into ci.yml — needs T004 + T006)
                      └─ T008 [US3]  (rebuild step in ci.yml — needs T004 + T003)
       └─ T009 [US4]  (supply-chain.yml — needs T002 for SHA, independent of T004–T008)
            └─ T010  (README — final, needs all workflow files complete)
```

**Same-file sequential constraints** (cannot parallelize):
- `ci.yml`: T004 → T007 → T008 → T005 (all edits to the same file must be sequential; T005 can be written into ci.yml at T004 time for efficiency, or added after)
- Recommended order within ci.yml: T004 (skeleton) → T006 (script, different file, parallel) → T007 (add pin validation step) → T008 (add rebuild step) → T005 (add test/build/audit steps)

---

## Parallel Execution Examples

**After T001 completes (immediate parallel start)**:
```
T002 ∥ T003   (SHA resolution + allowlist — different files, independent)
```

**After T002 completes**:
```
T004   (ci.yml skeleton requires SHAs)
T009   (supply-chain.yml requires SHAs — can start in parallel with T004)
```

**After T004 completes**:
```
T005 ∥ T006   (T005 edits ci.yml; T006 creates a new file — parallel if two implementers)
              (single implementer: do T006 first, then T007, then T005, then T008)
```

---

## Implementation Strategy

### MVP (US1 + US2 — both P1): T001–T007

Delivers the two highest-value protections: lockfile enforcement (closes dependency injection) and action SHA pinning with automated validation (closes workflow takeover). These two stories alone address the most severe and most common supply chain attack vectors.

### Increment 2 (US3 — P2): T008

Adds lifecycle script suppression. Safe to ship independently after MVP — requires only a new step in the existing `ci.yml`.

### Increment 3 (US4 + Polish — P2): T009–T010

Adds PR-time dependency advisory blocking and README documentation. Lowest risk, can be deferred if timeline is tight, but SC-004/SC-005 require it for full feature completion.

---

## Summary

| Phase | User Story | Tasks | Priority |
|-------|-----------|-------|----------|
| Setup | — | T001 | — |
| Foundational | — | T002–T003 | — |
| Phase 3 | US1: Dependency Integrity in CI | T004–T005 | P1 |
| Phase 4 | US2: Action SHA Pinning | T006–T007 | P1 |
| Phase 5 | US3: Lifecycle Script Suppression | T008 | P2 |
| Phase 6 | US4: Dependency Vetting | T009 | P2 |
| Polish | Cross-cutting | T010 | — |
| **Total** | | **10 tasks** | |

**Parallel opportunities identified**: 3 (T002∥T003, T004∥T009, T005∥T006)

**Format validation**: All 10 tasks follow `- [ ] [ID] [P?] [Story?] Description with file path` ✅
