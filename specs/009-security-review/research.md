# Research: Security Review & Hardening

**Branch**: `009-security-review` | **Date**: 2026-04-02

## Windows Process Termination Without Shell Interpolation

**Decision**: Replace `execAsync('taskkill /PID ${pid} /T /F')` with `spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'])`.

**Rationale**: `child_process.exec` passes the command string to the shell (`cmd.exe` on Windows), making it vulnerable to injection even if the input is numeric today. `spawnSync` with an explicit args array bypasses the shell entirely — the OS receives typed arguments. Using `spawnSync` (synchronous) is appropriate here because the call is already inside an `async` function awaited by the caller; the synchronous variant avoids an extra promise layer for a sub-millisecond operation.

**Alternatives considered**: 
- `execFile` (async, no shell) — viable alternative; `spawnSync` chosen for simpler error surfacing in this context.
- Native Win32 API via N-API module — overkill; `taskkill` is the correct documented mechanism.

---

## PID Ownership Verification

**Decision**: Two-stage check — (1) registry membership, then (2) OS process name match via `ps-list`.

**Rationale**: `ps-list` is already a direct dependency (`package.json`). The existing `scanExistingSessions()` in `claude-code-detector.ts` already uses `psList()` with the pattern `p.name.toLowerCase().includes('claude') || p.cmd?.toLowerCase().includes('claude')`. The same pattern is used for Copilot (`gh` / `copilot`). Reusing this established heuristic keeps the validation consistent with session discovery.

The registry check comes first: if a PID is not in the session registry, we reject immediately without the cost of a `psList()` call. The OS check confirms the process is still alive and is genuinely an AI tool.

**Allowlist patterns by session type**:
- `claude-code`: `name.includes('claude')` OR `cmd.includes('claude')`
- `copilot-cli`: `name.includes('gh')` OR `cmd.includes('copilot')`

**Alternatives considered**:
- Executable path check (full path, not just name) — more precise but brittle across install locations and OS versions; name/cmd heuristic is the established pattern in this codebase.
- Registry-only check — insufficient; a PID can be reused by the OS after the original process exits.

---

## Hook Endpoint: Body Size Limit

**Decision**: Set `bodyLimit: 64 * 1024` (64 KB) on the `/hooks/claude` route.

**Rationale**: Fastify supports per-route `bodyLimit` as a route option. A Claude Code hook payload contains JSON with a session UUID, a cwd string, and a tool input object — a 64 KB cap is generous for legitimate payloads and blocks resource exhaustion from oversized bodies. The global Fastify instance has no `bodyLimit` configured today, so this adds a targeted guard without affecting other routes.

**Alternatives considered**:
- Global bodyLimit on the Fastify instance — would affect file upload or future large-payload routes; per-route is more targeted.
- `@fastify/multipart` limit — not applicable (JSON body, not multipart).

---

## session_id Validation

**Decision**: Validate against UUID v4 regex: `/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i`

**Rationale**: Confirmed from real session data — both Claude Code (JSONL filenames) and Copilot CLI (`workspace.yaml` `id` field) use UUIDs exclusively. A strict UUID regex prevents path traversal via `session_id` (e.g., `../../etc/passwd`) and is trivially testable.

**Alternatives considered**:
- Alphanumeric + hyphens + underscores, max 128 chars — more permissive but unnecessary given confirmed UUID usage by both tools.
- Blocklist approach (reject `/`, `\`, `..`) — weaker; allowlist is always preferred for security validation.

---

## Filesystem Path Boundary Enforcement

**Decision**: Use `path.resolve()` to canonicalize input, then check if the resolved path starts with an allowed boundary.

**Rationale**: `path.normalize()` (currently used) collapses `..` sequences but does NOT resolve them relative to the filesystem root — `normalize('../../etc')` yields `../../etc`, not an absolute path. `path.resolve()` produces an absolute path that can be compared against boundary prefixes. Allowed boundaries: `os.homedir()` and all configured repository paths.

Boundary check: `resolvedPath === boundary || resolvedPath.startsWith(boundary + path.sep)` — the `+ sep` guard prevents a boundary of `/home/user` from allowing `/home/userother`.

**Alternatives considered**:
- Chroot/jail — not available in Node.js without native modules; overkill for a localhost tool.
- Allowlist of known-good paths only — too restrictive for the folder-browser feature which needs to navigate within the home directory.

---

## Symlink Loop Detection

**Decision**: Use `lstatSync` instead of `statSync` in `findGitRepos`; skip entries where `lstatSync` returns `isSymbolicLink() === true`.

**Rationale**: `statSync` follows symlinks — if a symlink points to a parent directory, `isDirectory()` returns `true` and recursion enters an infinite loop. `lstatSync` does NOT follow symlinks, so `isSymbolicLink()` correctly identifies and allows skipping of symlinks before recursing. This is a one-line fix.

**Alternatives considered**:
- Track visited inodes — more complete (detects hard-link loops too) but significantly more complex; symlink skipping covers the realistic attack surface.
- `realpath` canonicalization and deduplication — viable but adds I/O cost per entry; `lstatSync` skip is O(1).

---

## Security Headers

**Decision**: Add `X-Content-Type-Options: nosniff` and `X-Frame-Options: DENY` to the existing `onSend` hook in `server.ts`. No additional plugin needed.

**Rationale**: Fastify does NOT add a `Server` header by default (unlike Express's `X-Powered-By`). The existing `onSend` hook already sets `X-Request-Id`. Adding two `reply.header()` calls there is the minimal change. `@fastify/helmet` would add these and more, but introduces new dependencies and potentially overly-strict CSP headers that would break the Swagger UI (`/api/docs`) — not worth the complexity for a two-header requirement.

**Alternatives considered**:
- `@fastify/helmet` — too broad; CSP defaults break Swagger UI.
- Per-route header middleware — repetitive; the `onSend` hook applies globally.

---

## Concurrent Hook Payload Conflict (FR-004)

**Decision**: First write wins. If a hook payload arrives for an existing session with a different `pid`, return 409. (Clarification answer from session 2026-04-02.)

**Rationale**: `handleHookPayload` already preserves the existing session if one exists (`existing ?? { ... }`). However, it currently calls `upsertSession(session)` unconditionally, which could update fields. The guard must be explicit: if `existing` is non-null and has a non-null `pid`, and the incoming payload carries a different `pid`, return 409. In practice, hooks do not carry `pid` in the payload today — PIDs come from `scanExistingSessions`. This guard is defensive future-proofing.
