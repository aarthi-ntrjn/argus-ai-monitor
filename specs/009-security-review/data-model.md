# Data Model: Security Review & Hardening

**Branch**: `009-security-review` | **Date**: 2026-04-02

This feature adds no new entities. It hardens validation constraints on existing ones.

---

## Modified Entity: Hook Payload

Input received at `POST /hooks/claude`.

| Field | Type | Constraint (new) |
|-------|------|-----------------|
| `session_id` | `string` | MUST match UUID v4 regex: `/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i`. Reject 400 if invalid. |
| `cwd` | `string \| undefined` | MUST resolve to a registered repository path. If absent or unrecognized, silently discard (no error, no watcher). Already partially enforced. |
| *(body)* | — | MUST be ≤ 64 KB. Reject 413 (Fastify default for bodyLimit) if exceeded. |

**Conflict rule (FR-004)**: If a payload arrives for an existing active session whose `pid` is non-null, and the payload carries a different `pid`, the server MUST return 409 and leave the session unchanged.

---

## Modified Entity: Session (PID field)

The `pid` field on `Session` is the target of the PID ownership validation.

| Field | Type | Validation rule (new) |
|-------|------|-----------------------|
| `pid` | `number \| null` | Before any stop/interrupt signal: MUST pass two-stage ownership check — (1) session exists in registry with this PID set, AND (2) `psList()` finds a live process at this PID whose `name` or `cmd` matches the AI tool allowlist for the session's `type`. |

**AI tool allowlist by session type**:
- `claude-code`: `name.includes('claude')` OR `cmd.includes('claude')`
- `copilot-cli`: `name.includes('gh')` OR `cmd.includes('copilot')`

---

## Modified Entity: Filesystem Path (fs routes)

User-supplied paths in `GET /api/v1/fs/browse`, `GET /api/v1/fs/scan`, `POST /api/v1/fs/scan-folder`.

| Constraint | Rule |
|-----------|------|
| Canonicalization | `path.resolve(input)` — produces absolute path, resolves all `..` sequences |
| Boundary check | Resolved path MUST equal or be a child of `os.homedir()` OR any configured repository path. Check: `resolved === boundary \|\| resolved.startsWith(boundary + path.sep)` |
| Rejection | Return 403 `{ error: 'PATH_OUTSIDE_BOUNDARY', message: '...', requestId }` for paths outside boundary |
| Symlink entries | `findGitRepos` MUST use `lstatSync` and skip entries where `isSymbolicLink() === true` |

---

## New Helper: `PidValidator`

Not a database entity — a pure service. Encapsulates the two-stage PID ownership check.

**Interface**:
```typescript
interface PidValidationResult {
  valid: boolean;
  reason?: 'not_in_registry' | 'process_not_found' | 'process_not_ai_tool';
}

async function validatePidOwnership(
  pid: number,
  sessionType: 'claude-code' | 'copilot-cli'
): Promise<PidValidationResult>
```

**New helper**: `path-sandbox.ts`

```typescript
function isPathWithinBoundary(inputPath: string, allowedBoundaries: string[]): boolean
function resolveAndValidatePath(inputPath: string, allowedBoundaries: string[]): { valid: boolean; resolved: string }
```
