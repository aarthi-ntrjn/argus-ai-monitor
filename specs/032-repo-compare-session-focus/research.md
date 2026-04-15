# Research: Repository Compare Link and Session Focus Button

## Decision 1: How to Store Remote URL

**Decision**: Add `remote_url TEXT` column to the `repositories` table using the existing runtime migration pattern (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS` workaround).

**Rationale**: The existing codebase already performs runtime migrations in `database.ts` using `pragma('table_info')` checks before `ALTER TABLE`. This is consistent, battle-tested, and avoids a schema versioning system.

**Alternatives considered**:
- Derive remote URL on-the-fly per request: rejected because it requires a `git` shell call on every API response, adding latency and failing if the git binary is slow or unavailable.
- Separate `repository_remotes` table: rejected as over-engineering for a single optional field.

---

## Decision 2: How to Build the GitHub Compare URL

**Decision**: Parse the remote URL in a pure utility function (`buildGitHubCompareUrl`) that handles both SSH (`git@github.com:owner/repo.git`) and HTTPS (`https://github.com/owner/repo.git`) formats, strips `.git` suffix, and constructs the compare URL on the frontend.

**Rationale**: The frontend already receives the `remoteUrl` field. Constructing the URL client-side avoids an extra API round-trip. A pure function is easy to unit test.

**Alternatives considered**:
- Compute compare URL on backend and expose as a field: slightly simpler frontend but ties URL construction logic to backend, harder to change URL format for different git hosts later.
- Use GitHub API to detect default branch: adds network dependency and complexity; detecting `master` vs `main` from remote URL heuristic is sufficient for the stated scope.

---

## Decision 3: Default Branch Detection

**Decision**: Detect the default branch by trying to resolve `origin/HEAD` via `git remote show origin` or by checking whether `master` or `main` exists as a remote branch. If neither can be determined, default to `master`.

**Rationale**: The heuristic covers 99% of GitHub repos. A network call to GitHub API for the default branch is out of scope per the spec assumptions.

**Alternatives considered**:
- Always use `master`: breaks for repos that use `main` as default. Rejected.
- Always use `main`: breaks for legacy repos. Rejected.
- Store default branch in DB: overkill for this feature; the heuristic is sufficient.

---

## Decision 4: OS Window Focus Mechanism

**Decision**:
- **Windows**: Use PowerShell `[System.Diagnostics.Process]::GetProcessById(pid).MainWindowHandle` + `[System.Runtime.InteropServices.Marshal]` / `ShowWindow` / `SetForegroundWindow` via inline C# in a `powershell` child process. Fall back to `AppActivate` via WScript.Shell.
- **macOS**: Use `osascript -e 'tell application "System Events" to set frontmost of (first process whose unix id is PID) to true'`.
- **Linux**: Use `wmctrl -ip PID` if available; fall back to `xdotool search --pid PID windowactivate` if available; return `WINDOW_NOT_FOUND` if neither is installed.

**Rationale**: Each OS has a different window management API. Platform detection is already done elsewhere in `process-utils.ts` via `platform()`. The focus logic is encapsulated in a new `focusProcess(pid: number): Promise<void>` helper.

**Alternatives considered**:
- node-window-manager npm package: adds a native dependency with platform-specific build requirements. Rejected in favour of shell commands already used throughout the codebase.
- Only support Windows + macOS: Linux focus is best-effort; we return a clear error if the tools are not available rather than silently failing.

---

## Decision 5: Which PID to Focus

**Decision**: Prefer `hostPid` (the terminal host process) over `pid` (the AI process). The terminal host is more likely to have a visible window.

**Rationale**: On detected sessions, `hostPid` is set to the parent shell/terminal emulator. Focusing the host PID brings the terminal window containing the AI session to the foreground. Focusing just the `pid` of the AI subprocess may not have a window handle.
