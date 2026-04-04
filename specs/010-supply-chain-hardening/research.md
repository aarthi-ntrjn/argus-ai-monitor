# Research: Supply Chain Attack Protection

**Branch**: `010-supply-chain-hardening`
**Date**: 2026-04-03
**Status**: Complete — all NEEDS CLARIFICATION resolved

---

## Finding 1: No Existing GitHub Actions Workflows

**Question**: What CI infrastructure already exists to build upon?

**Finding**: The `.github/` directory contains only Copilot/agent instruction files — no `workflows/` directory exists. The supply chain feature must create the CI pipeline from scratch, not modify existing workflows.

**Decision**: Create two workflow files:
- `.github/workflows/ci.yml` — main build and test pipeline (runs on every push and PR)
- `.github/workflows/supply-chain.yml` — supply-chain-specific checks (runs only on PRs)

**Rationale**: Separating concerns keeps CI readable and lets supply chain checks run exclusively on PRs (where dependency changes happen) without adding noise to push builds.

**Alternatives considered**:
- Single monolithic workflow: rejected — mixes build concerns with security audit concerns; harder to iterate on independently.

---

## Finding 2: Lockfile Enforcement Tool

**Question**: Which tool enforces lockfile-only installs, and does it work with the npm workspace setup?

**Decision**: Use `npm ci` (built-in npm command).

**Rationale**: `npm ci` has built-in lockfile enforcement:
- Fails if `package-lock.json` is absent.
- Fails if `package-lock.json` is inconsistent with `package.json`.
- Never writes to the lockfile.
- Works with npm workspaces (the root-level `package-lock.json` covers all workspaces).

**Alternatives considered**:
- `npm install --frozen-lockfile`: not a valid npm flag (that flag is Yarn-specific); `npm ci` is the correct npm equivalent.
- Manually checking file presence before install: redundant — `npm ci` already handles this.

---

## Finding 3: Lifecycle Script Suppression and Allowlist Format

**Question**: How do you suppress postinstall scripts selectively, and what format should the allowlist take?

**Decision**: 
- Use `npm ci --ignore-scripts` for all installs in CI.
- Maintain `.github/supply-chain/lifecycle-allowlist.yml` listing packages that need lifecycle scripts.
- After the suppressed install, run `npm rebuild <package>` for each package on the allowlist that requires a native build step.

**Rationale**: `--ignore-scripts` is an official npm flag that suppresses all lifecycle script execution. The allowlist + `npm rebuild` pattern is idiomatic for native modules (e.g., `better-sqlite3` uses `node-gyp` to compile a native addon). Storing the allowlist as a structured YAML file keeps it reviewable and machine-readable for the CI step that consumes it.

**Allowlist format**:
```yaml
# Packages permitted to run lifecycle scripts
# Each entry requires a justification comment
allowed:
  - package: better-sqlite3
    reason: "Compiles native SQLite bindings via node-gyp. Required for the backend database layer."
    environments: [ci, local]
```

**Alternatives considered**:
- `.npmrc` with `ignore-scripts=true`: suppresses scripts globally but provides no selective re-enable mechanism — the rebuild step would still be needed.
- Per-package npm install flags: fragile and not centralised in a reviewable file.

---

## Finding 4: GitHub Actions SHA Pinning Validation

**Question**: Which tool should validate that all action `uses:` references include a full commit SHA?

**Decision**: Implement a custom POSIX shell validation script (`.github/scripts/validate-action-pins.sh`) that is called from a CI step.

**Rationale**: A custom script has zero external dependencies, no API key requirement, and can be read and understood by any contributor. The check is simple: parse every `uses:` directive in YAML files under `.github/workflows/` and verify it contains a 40-character hexadecimal string (the format of a full Git commit SHA). Self-referencing actions (`./`) are excluded.

**Script logic**:
```
For each `uses:` line in .github/workflows/*.yml:
  Skip if starts with "./" (local action)
  Check if reference contains "@" followed by 40 hex characters
  If not: print error with file + line, exit 1
```

**Alternatives considered**:
- `zizmor`: a Rust-based GitHub Actions security linter that checks pinning among many other issues. Excluded because it requires a binary install step in CI and is an additional supply chain dependency — ironic for a supply chain security feature.
- `step-security/harden-runner`: a GitHub Action itself; using an unpinned third-party action to enforce action pinning is circular.
- Manual review only: does not satisfy FR-006 (automated CI gate).

---

## Finding 5: Dependency Vetting Tool

**Question**: Which tool produces a per-PR dependency risk report and blocks on malicious packages without requiring a paid API key?

**Decision**: Use GitHub's built-in `dependency-review-action` for PR-time vetting.

**Rationale**: 
- `dependency-review-action` is maintained by GitHub and backed by the GitHub Advisory Database (GHSA) — no API key needed.
- It runs as a workflow step that compares the dependency snapshot of the base and head commits and reports new, removed, or changed packages.
- It can be configured to fail on `critical` severity advisories.
- It produces a PR-visible summary as a workflow run annotation.
- It handles FR-009 automatically — it only runs when dependency files change (the action compares diff; if no change, it produces no output and exits 0).

**SHA to pin**: The SHA for `github/dependency-review-action` will be resolved at implementation time from the GitHub releases page.

**Limitations accepted**:
- The Advisory Database covers known CVEs and confirmed malicious packages; it does not perform behavioural analysis of novel threats.
- The "adoption signal" (download count, package age) mentioned in US4 is not available in the Advisory Database. Decision: scope this to known-malicious/critical-vulnerability blocking only; the adoption signal is deferred as a P3 enhancement.

**Alternatives considered**:
- `socket` CLI (Socket.dev): provides behavioural and adoption signals but requires a paid plan or API key for CI use. Excluded.
- `npm audit` only: does not produce a PR-visible per-package summary; only reports known CVEs. Used as a secondary check in the main CI workflow alongside `dependency-review-action`.

---

## Finding 6: Scope Adjustment — Adoption Signal

**Finding**: US4 includes "adoption signal (age, download volume)" in the risk report. This data is not available without a paid third-party service.

**Decision**: Adjust US4 scope to: the automated check blocks on known-malicious packages and critical advisories via the GitHub Advisory Database. Adoption signals are deferred. This is within the spirit of FR-008 (block on malicious flag) and satisfies SC-005.

**Impact on spec**: FR-007's "age, adoption level" language is acknowledged but implemented at the advisory-database level only. This is documented here so the planning team understands the scoping decision.

---

## Finding 7: npm Workspaces — Where to Run Commands

**Finding**: The project uses npm workspaces with a root `package-lock.json`. All workspace packages are installed from the root.

**Decision**: All install commands run from the repo root (not per-workspace). Testing commands run per-workspace (`npm test --workspace=backend`, `npm run build --workspace=frontend`) or via the root workspace script.

**Impact on CI**: The CI workflow runs a single `npm ci --ignore-scripts` at the repo root, which installs all workspace packages. The rebuild step for allowlisted packages also runs from the root.
