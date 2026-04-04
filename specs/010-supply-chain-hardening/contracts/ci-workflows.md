# Contract: CI Workflow Behaviour

**Feature**: Supply Chain Attack Protection (`010-supply-chain-hardening`)
**Date**: 2026-04-03

This contract defines the observable behaviour of the two GitHub Actions workflows introduced by this feature. It specifies inputs, outputs, and pass/fail conditions for each job.

---

## Workflow 1: `ci.yml` — Main CI Pipeline

**Trigger**: Push to any branch; Pull Requests targeting `master`

### Job: `build-and-test`

**Steps and their contracts**:

| Step | Input | Pass condition | Fail condition |
|------|-------|----------------|----------------|
| Checkout | Repository contents | Code checked out at exact commit SHA | — |
| Setup Node | `.nvmrc` or hardcoded version | Node.js available at specified version | Version unavailable |
| Install dependencies | Root `package-lock.json` | All packages installed per lockfile | Lockfile absent; hash mismatch; `package.json` inconsistency |
| Rebuild allowlisted packages | `.github/supply-chain/lifecycle-allowlist.yml`, `environments: [ci]` | Each listed package rebuilt successfully | Rebuild fails for an allowlisted package |
| Validate action pins | `.github/workflows/*.yml` | All third-party action `uses:` directives include a 40-char SHA | Any unpinned reference found |
| Run backend tests | `backend/` | All Vitest tests pass (exit 0) | Any test fails |
| Run frontend build | `frontend/` | TypeScript compilation + Vite build succeeds | Build error |
| Run `npm audit` | Root `package-lock.json` | No critical vulnerabilities in lockfile | Critical vulnerability present |

**Exit contract**: Job exits 0 only if all steps pass. Any step failure causes the workflow to report failure and block the PR merge.

---

## Workflow 2: `supply-chain.yml` — Dependency Review

**Trigger**: Pull Requests targeting `master` only (not pushes)

### Job: `dependency-review`

**Steps and their contracts**:

| Step | Input | Pass condition | Fail condition |
|------|-------|----------------|----------------|
| Checkout | PR base and head commits | Both snapshots available | — |
| Dependency review | `package-lock.json` diff between base and head; GitHub Advisory Database | No new dependency carries a critical or malicious advisory | Any new dependency has a critical/malicious advisory |

**No-op condition**: If `package-lock.json` is identical between base and head, the dependency review action produces no output and exits 0 immediately (satisfying FR-009).

**Exit contract**: Job exits 0 when no new risky dependencies are introduced. Job exits non-zero (and blocks PR merge) when a new dependency has an active critical or malicious advisory.

---

## Contract: Lifecycle Script Allowlist Schema

**File**: `.github/supply-chain/lifecycle-allowlist.yml`

**Schema** (YAML):
```yaml
# yaml-language-server: $schema not enforced at runtime; validated during code review
allowed:           # Required. List of allowed entries (may be empty list).
  - package: string    # Required. Exact npm package name.
    reason: string     # Required. Non-empty justification.
    environments:      # Required. At least one of: ci, local
      - ci
      - local
```

**Consumer**: The `ci.yml` workflow reads this file to determine which packages to rebuild after `--ignore-scripts` install.

**Change process**: Any addition to this file requires a PR with at least one reviewer approving the justification.

---

## Contract: Action Pin Validation Script

**File**: `.github/scripts/validate-action-pins.sh`

**Interface**:
- **Invocation**: `bash .github/scripts/validate-action-pins.sh`
- **Working directory**: Repository root
- **Exit 0**: All third-party `uses:` references in `.github/workflows/*.yml` include a 40-char SHA
- **Exit 1**: One or more unpinned references found; each reported as `FILE:LINE: <offending uses value>`
- **Stdout on failure**: Human-readable list of violations
- **Exemptions**: Lines where `uses:` value starts with `./` are silently skipped
