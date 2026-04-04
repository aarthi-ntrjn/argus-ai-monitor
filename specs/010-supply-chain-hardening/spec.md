# Feature Specification: Supply Chain Attack Protection

**Feature Branch**: `010-supply-chain-hardening`
**Created**: 2026-04-03
**Status**: Draft
**Input**: User description: "protect this repository from supply chain attacks"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Dependency Integrity Is Enforced in CI (Priority: P1)

A developer opens a pull request that updates a dependency. The CI pipeline verifies that only the exact dependency versions recorded in the lockfile are installed, and that no package's content has changed since it was added to the lockfile. If anything does not match, the build fails with a clear message identifying the problem package. This gives the team confidence that the code running in CI matches what was reviewed.

**Why this priority**: Compromised or swapped packages are the most common supply chain attack vector. Enforcing lockfile-only installs closes the most direct dependency injection path before code reaches any environment.

**Independent Test**: Manually alter a single package's content hash in the lockfile, then trigger CI — the build must fail and report the tampered package. Revert the change — the build must pass. Delete the lockfile — CI must fail rather than regenerate it.

**Acceptance Scenarios**:

1. **Given** the lockfile is committed and unmodified, **When** CI installs dependencies, **Then** only the exact versions in the lockfile are installed and no extra resolution step runs.
2. **Given** a tampered lockfile entry (hash mismatch), **When** CI installs dependencies, **Then** the build fails with a clear error identifying the affected package.
3. **Given** the lockfile is absent from the repository, **When** CI attempts to install dependencies, **Then** the pipeline fails rather than generating a new lockfile.
4. **Given** a valid PR that adds a new dependency, **When** CI runs, **Then** the updated lockfile is validated and the build succeeds only if the new entry's hash matches the registry record.

---

### User Story 2 - Build Pipeline Actions Are Pinned to Immutable References (Priority: P1)

A developer reviews the CI/CD workflow configuration. Every third-party action used in the pipeline references an exact, immutable commit identifier — not a mutable version label — so that a compromised action author cannot push malicious changes under an existing label and silently affect future builds.

**Why this priority**: Mutable version labels in CI workflows are a well-documented supply chain attack vector. Pinning to immutable commit identifiers ensures the exact code that was reviewed is always the code that runs.

**Independent Test**: Inspect all workflow configuration files — every reference to a third-party action must include a full, immutable commit identifier. Any reference using only a version label must be flagged. A new PR introducing an unpinned reference must be blocked by an automated check.

**Acceptance Scenarios**:

1. **Given** the repository's CI workflow files, **When** each third-party action reference is inspected, **Then** every reference includes a full immutable commit identifier alongside any human-readable label.
2. **Given** a PR that introduces a new workflow step using only a mutable version label, **When** CI runs a validation step, **Then** the PR is blocked with a message identifying the unpinned reference.
3. **Given** a workflow step that references an action defined within the same repository, **When** reviewed, **Then** it is exempted from the pinning requirement (it is version-controlled within the same repo).

---

### User Story 3 - Postinstall Scripts Cannot Execute Arbitrary Code During Installation (Priority: P2)

When dependencies are installed — in CI or locally — package lifecycle scripts are suppressed by default. Packages that legitimately require a build step must be explicitly named in an allowlist maintained in the repository. This prevents a compromised package from executing arbitrary code on developer machines or in the build environment as a side effect of installing dependencies.

**Why this priority**: Lifecycle scripts run automatically and silently during install, making them a common exfiltration and persistence vector. Suppressing them by default removes this attack surface with minimal developer friction, since the vast majority of packages do not need lifecycle scripts to function correctly.

**Independent Test**: Install a test package whose lifecycle script writes a marker file. With protection active, the marker file must not be created. Add the package to the allowlist — the marker file must appear. Remove it from the allowlist — the marker file must not appear again.

**Acceptance Scenarios**:

1. **Given** a dependency with a lifecycle script that is not on the allowlist, **When** dependencies are installed, **Then** the script does not execute and a warning is emitted identifying the suppressed package.
2. **Given** a dependency on the explicit allowlist that has a lifecycle script, **When** dependencies are installed, **Then** the script executes normally.
3. **Given** CI running dependency installation, **When** the install completes, **Then** no lifecycle scripts from non-allowlisted packages have executed.

---

### User Story 4 - New Dependencies Are Vetted Before Acceptance (Priority: P2)

A developer proposes adding a new package. Before the change can be merged, an automated check surfaces key risk signals — package age, adoption level, known vulnerability or malicious-behaviour flags — and makes this information visible in the PR. The check blocks the merge only if a package is flagged as actively malicious; otherwise it informs the reviewer and lets them decide.

**Why this priority**: Preventing new risky dependencies from entering the tree is more cost-effective than remediating them after adoption. Automated vetting reduces the human review burden while keeping the decision with the developer.

**Independent Test**: Open a PR that adds one well-known, widely-adopted package and one obscure package with minimal adoption. The check must produce a report distinguishing the two. A PR that adds a package with an active malicious flag must be blocked.

**Acceptance Scenarios**:

1. **Given** a PR that adds a new dependency, **When** the automated check runs, **Then** a summary is produced showing: package age, adoption signal, and any known vulnerability or malicious-flag status.
2. **Given** a package flagged as actively malicious by a recognised security source, **When** the check runs, **Then** CI fails and the PR cannot be merged until the package is removed or the flag is explicitly overridden by a maintainer.
3. **Given** a PR that modifies only non-dependency files, **When** the check runs, **Then** it completes immediately with no report produced.

---

### Edge Cases

- What happens when the lockfile is regenerated locally after a legitimate update and committed? The CI check must accept the regenerated lockfile provided all hashes match the registry — not treat regeneration itself as an error.
- How does the immutable-reference check handle CI-managed runner images (e.g., `ubuntu-latest`)? Runner version labels are managed by the CI platform and are exempt; only third-party action references must use immutable identifiers.
- What if a legitimate package is private or has low public adoption by design (e.g., an internal shared library)? The vetting allowlist must support adding private or internal packages to permanently suppress false positives.
- What if a lifecycle script is required for local development but must not run in CI? The allowlist must support environment-scoped entries (local-only vs CI-only vs both).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The CI pipeline MUST install dependencies using only the versions and content hashes recorded in the committed lockfile, with no additional resolution step permitted.
- **FR-002**: The CI pipeline MUST fail if the lockfile is absent at install time rather than regenerating it.
- **FR-003**: Dependency installation MUST suppress all package lifecycle scripts (`preinstall`, `install`, `postinstall`, `prepare`) by default, in both CI and documented local workflows.
- **FR-004**: An allowlist configuration file MUST be maintained in the repository listing packages explicitly permitted to run lifecycle scripts, with a comment explaining each exception.
- **FR-005**: Every reference to a third-party action in CI workflow files MUST include a full, immutable commit identifier for the action being used.
- **FR-006**: A CI validation step MUST scan all workflow files for action references that lack an immutable commit identifier and fail the build if any are found.
- **FR-007**: When a PR adds or modifies package dependency entries, an automated check MUST run and produce a risk summary for each new package covering: age, adoption level, and security advisory or malicious-flag status.
- **FR-008**: The automated dependency check MUST fail CI if any new package carries an active malicious flag or a critical security advisory from a recognised source.
- **FR-009**: The dependency risk check MUST NOT run or produce output when no dependency changes are present in the PR.
- **FR-010**: All supply chain protection measures MUST be documented in the repository so developers understand what checks run, why they run, and how to respond when they fail.

### Key Entities

- **Lockfile**: The committed file that records exact package versions and content hashes for all direct and transitive dependencies.
- **Lifecycle Script Allowlist**: A configuration file listing packages explicitly permitted to run install-time scripts, with per-entry justification comments and optional environment scope.
- **Action Reference**: A `uses:` directive in a CI workflow file, consisting of an owner/repo path and a version specifier (mutable label or immutable commit identifier).
- **Dependency Risk Report**: A structured summary produced per-PR for each new dependency, covering adoption signal, age, and security advisory or malicious-flag status.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Zero dependency installs in CI use a version or content hash not recorded in the committed lockfile.
- **SC-002**: Zero CI workflow files contain a third-party action reference without a full immutable commit identifier after this feature is implemented.
- **SC-003**: Zero lifecycle scripts from non-allowlisted packages execute during any CI install run.
- **SC-004**: 100% of PRs that add a new dependency receive an automated risk summary before merge.
- **SC-005**: A PR that introduces a package with an active malicious flag is blocked by CI without requiring manual reviewer intervention.
- **SC-006**: A developer can add a legitimate package with a required lifecycle script to the allowlist and have CI pass within one additional commit, with no change to the CI pass rate for other PRs.

## Assumptions

- The repository uses npm and `package-lock.json` as its lockfile format; Yarn and pnpm lockfiles are out of scope for this feature.
- GitHub Actions is the CI/CD platform; no other CI systems are in scope.
- The existing GitHub Actions workflows reference at least some third-party actions that will require immutable commit identifier pinning.
- Malicious-flag and vulnerability detection relies on an existing CLI tool available in the CI environment (e.g., `npm audit` or a third-party scanner); no custom malware detection is built as part of this feature.
- Private or internal packages with low public adoption are a known use case and the allowlist mechanism accommodates them.
- Local developer machines are within scope for lifecycle script suppression via documented install commands, but the CI check is the authoritative enforcement gate.
- Signing or notarising the Argus build artefact for distribution is a separate supply chain concern and is out of scope for this feature.
