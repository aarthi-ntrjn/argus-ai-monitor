<!--
## Sync Impact Report

**Version change**: N/A → 1.0.0 (initial ratification)

**Added sections**:
- Core Principles: I–X (all new)
- Governance

**Modified principles**: N/A (initial version)

**Removed sections**: N/A (initial version)

**Templates reviewed**:
- `.specify/templates/plan-template.md`: ✅ Compatible — Constitution Check section references constitution gates
- `.specify/templates/spec-template.md`: ✅ Compatible — requirements and success criteria align with principles
- `.specify/templates/tasks-template.md`: ✅ Compatible — test-first task ordering and DoD-driven tasks align

**Deferred items**: None
-->

# Argus Constitution

## Core Principles

### I. Engineering Principles

Systems MUST be reliable, observable, and debuggable at all times. Solutions MUST favor
simplicity over complexity — every additional abstraction requires explicit justification.
All functionality MUST be testable in isolation. All changes MUST be reversible (via
feature flags, migrations, or rollback strategies). Architecture MUST be designed for
scale from the beginning, even if initial deployments are small.

**Rationale**: Argus monitors live AI coding sessions and MUST NOT introduce fragility
or opacity into its own infrastructure.

### II. Architecture Rules

All services MUST expose clear, versioned API boundaries. No service MAY directly access
another service's database — data MUST flow through the owning service's API. All
inter-service communication MUST happen via defined APIs (REST, gRPC, or message queue).
All long-running operations MUST be executed asynchronously with observable status.

**Rationale**: Enforcing boundaries prevents accidental coupling and ensures each service
can evolve, be tested, and be deployed independently.

### III. Code Standards

Code MUST be readable and self-documenting — comments explain *why*, not *what*. Functions
MUST be fewer than 50 lines; larger functions MUST be decomposed. All public APIs MUST have
documentation (docstrings, OpenAPI specs, or equivalent). All services MUST use structured
logging (JSON or key-value format) — no unstructured `print`/`console.log` in production
paths.

**Rationale**: Argus is a monitoring tool; its own code MUST be the standard it holds
others to.

### IV. Testing Requirements

All new features MUST include unit tests covering core logic. All APIs MUST have
integration tests validating request/response contracts. All critical user flows (session
monitoring, remote control commands) MUST have end-to-end tests. All AI-generated code
MUST be reviewed by a human before merge. Tests MUST be written before implementation
(see principle IX). Test coverage MUST NOT decrease with any PR.

**Rationale**: Argus controls live AI sessions — defects have immediate, visible impact
on developer productivity. AI-assisted code carries additional review risk.

### V. Security & Compliance

All endpoints MUST enforce authentication and authorization — no unauthenticated access
to session data or control APIs. Secrets MUST never be stored in source code, configuration
files, or logs. All user-initiated and system-initiated actions MUST be logged for audit
with actor, timestamp, and outcome. Access MUST follow least-privilege: services and users
receive only the permissions required for their specific role.

**Rationale**: Argus has privileged access to AI coding sessions. A security failure
directly compromises developer environments.

### VI. Observability

All services MUST emit structured logs for every significant event. All services MUST emit
metrics (request rates, error rates, latencies, business-level counters). All services MUST
expose a health check endpoint. All failures MUST be traceable end-to-end via correlation
IDs or distributed tracing.

**Rationale**: A monitoring tool that cannot monitor itself cannot be trusted. Observability
is non-negotiable for Argus.

### VII. Performance

APIs MUST respond within 500ms at p95 under normal load. The system MUST support 10,000
concurrent users without degradation. The system MUST degrade gracefully under overload —
shedding load or queuing work rather than failing hard.

**Rationale**: Session monitoring must be near-real-time to be useful. Latency or
unavailability makes the tool worthless at the moment it is most needed.

### VIII. AI Usage Rules

AI MAY generate implementation code but MUST NOT make architecture decisions. All
AI-generated outputs MUST be validated with tests before merge. AI MUST NOT be used for
security-critical code (auth, authz, secrets handling, audit logging) without explicit
human review and sign-off. AI-generated code MUST be clearly identifiable in review.

**Rationale**: Argus exists to provide human oversight of AI sessions — it MUST apply
that same discipline to its own development.

### IX. Test-First (NON-NEGOTIABLE)

Tests MUST be written before implementation code. The Red-Green-Refactor cycle MUST be
strictly followed: write a failing test → confirm it fails → implement → confirm it
passes → refactor. No implementation PR may be submitted without accompanying tests
written first. This applies to all code, including AI-generated code.

**Rationale**: Test-first surfaces API and contract issues before code accumulates. This
is the single most enforceable quality gate in this constitution.

### X. Definition of Done

A feature is complete only when ALL of the following are true:

- **Code written**: Implementation complete and reviewed
- **Tests written**: Unit, integration, and E2E tests written test-first and passing
- **Documentation written**: Public APIs documented; `quickstart.md` updated if applicable
- **Metrics added**: Feature-level counters and latency metrics instrumented
- **Logs added**: Structured logs emitted for all significant events in the feature
- **Security reviewed**: Auth, authz, secrets handling, and audit logging confirmed

No feature may be merged or marked complete until every item above is satisfied.
Partial completion is not done.

**Rationale**: Incomplete features create hidden debt. Every increment MUST be fully
shippable.

## Governance

This constitution supersedes all other development practices and conventions. Any practice
that conflicts with this constitution MUST be amended or removed.

**Amendment procedure**:
1. Open a dedicated PR with the proposed amendment and rationale.
2. The amendment MUST include a migration plan for any existing work affected.
3. The `/speckit.constitution` command MUST be used to update this file and propagate
   changes to dependent templates.
4. Version MUST be bumped per semantic versioning rules (MAJOR/MINOR/PATCH).
5. No feature branch work may amend the constitution — amendments require a separate PR.

**Versioning policy**: MAJOR for principle removals or redefinitions; MINOR for new
principles or materially expanded guidance; PATCH for clarifications or wording fixes.

**Compliance review**: All PRs MUST include a constitution check. The `/speckit.analyze`
command MUST be run before marking any feature complete. Constitution violations are
CRITICAL findings and block merge.

**Version**: 1.0.0 | **Ratified**: 2026-04-01 | **Last Amended**: 2026-04-01
