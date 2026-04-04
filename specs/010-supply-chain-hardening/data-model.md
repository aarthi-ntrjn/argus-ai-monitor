# Data Model: Supply Chain Attack Protection

**Branch**: `010-supply-chain-hardening`
**Date**: 2026-04-03

This feature introduces no new runtime database entities. All "data" is stored as configuration files tracked in the repository. The entities below represent those configuration structures.

---

## Entity: Lifecycle Script Allowlist Entry

**File**: `.github/supply-chain/lifecycle-allowlist.yml`

**Purpose**: Records which packages are explicitly permitted to run lifecycle scripts during dependency installation, with justification and environment scope.

**Fields**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `package` | string | yes | Exact npm package name (must match `package-lock.json` entry) |
| `reason` | string | yes | Human-readable justification for why the lifecycle script is needed |
| `environments` | string[] | yes | Scopes where the script is permitted: `ci`, `local`, or both |

**Validation rules**:
- `package` must be a non-empty string matching a package present in `package-lock.json`
- `reason` must be a non-empty string (enforced by YAML schema validation at review time)
- `environments` must contain at least one of `["ci", "local"]`

**State transitions**: None — this is a static configuration file. Changes are made via PR.

**Example**:
```yaml
allowed:
  - package: better-sqlite3
    reason: "Compiles native SQLite bindings via node-gyp. Required for the backend DB layer."
    environments: [ci, local]
```

---

## Entity: GitHub Actions Workflow

**Files**: `.github/workflows/ci.yml`, `.github/workflows/supply-chain.yml`

**Purpose**: Defines the automated CI pipeline steps. From a supply chain perspective, the critical attribute is the action reference format.

**Action Reference Fields**:

| Field | Format | Valid | Invalid |
|-------|--------|-------|---------|
| `uses` (third-party) | `owner/repo@<40-hex-sha> # tag` | `actions/checkout@abc123...def456 # v4` | `actions/checkout@v4` |
| `uses` (local) | `./.github/actions/<name>` | `./.github/actions/setup` | N/A (local refs exempt) |

**Validation rule**: Every `uses:` directive referencing an external action must include a 40-character lowercase hexadecimal string after `@`.

---

## Entity: Dependency Review Result

**Source**: GitHub Advisory Database (via `github/dependency-review-action`)
**Format**: Workflow run annotation (not stored in the repository)

**Attributes surfaced per new dependency**:

| Attribute | Source | Used for |
|-----------|--------|----------|
| Package name | `package-lock.json` diff | Identifying the new dependency |
| Advisory severity | GitHub Advisory Database | Blocking decision (critical = block) |
| Advisory ID | GHSA-xxx-xxx-xxx | Linking to full advisory details |
| Vulnerability description | GitHub Advisory Database | PR annotation visible to reviewer |

**Blocking rule**: Any new dependency with a `critical` or active `malicious` advisory causes the workflow step to exit non-zero, blocking the PR.

---

## Entity: CI Validation Script

**File**: `.github/scripts/validate-action-pins.sh`

**Purpose**: Scans all workflow YAML files and verifies every third-party `uses:` directive includes a full commit SHA.

**Input**: All `.yml` files under `.github/workflows/`
**Output**: Exit code 0 (all pinned) or exit code 1 (one or more unpinned, with file:line reported to stdout)

**Logic**:
- Extract all lines matching `uses: <value>`
- Skip lines where `<value>` starts with `./` (local actions)
- For remaining lines, check if `<value>` contains `@[0-9a-f]{40}` pattern
- Report any that do not match
