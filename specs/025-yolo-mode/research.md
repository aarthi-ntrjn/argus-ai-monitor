# Research: 025-yolo-mode

## Decision Log

### 1. Correct CLI flags

**Decision**: `--dangerously-skip-permissions` for Claude Code, `--allow-all` for GitHub Copilot CLI.

**Rationale**: Confirmed by searching existing test files in `backend/tests/launch-command-resolver.test.ts` and reviewing Claude Code documentation. The user initially guessed `--dangerously-skip-all-permissions` but the actual flag is the shorter form. `--allow-all` for Copilot is the standard bypass flag for the Copilot CLI.

**Alternatives considered**: `--dangerously-skip-all-permissions` (incorrect, too long). `--yes` / `--no-confirm` (Copilot, but `--allow-all` is the canonical bypass flag).

---

### 2. Where to persist yolo mode

**Decision**: Store in backend `ArgusConfig` (`~/.argus/config.json`), not in frontend `localStorage`.

**Rationale**: Yolo mode affects command construction on the backend (PTY launch path). Storing it in `localStorage` would only affect the frontend copy path and would be invisible to the backend PTY launch. Since the spec requires consistent behavior across both paths, it must live in the backend config.

**Alternatives considered**: `localStorage` only (rejected: backend PTY path would not see it). Separate config file (rejected: unnecessary complexity; `ArgusConfig` is the right home).

---

### 3. Flag injection point

**Decision**: Inject flags in `buildLaunchCmdBase()` in `tools.ts` by passing `yoloMode` as a parameter.

**Rationale**: Both the clipboard copy path (`GET /api/v1/tools`) and the PTY launch path (`POST /api/v1/sessions/launch-terminal`) call `buildLaunchCmdBase()`. A single parameter change covers both paths with no duplication.

**Alternatives considered**: Inject at the `launch.ts` CLI level by reading config there (rejected: the CLI does not have access to the backend config; it only receives the command string).

---

### 4. Warning dialog trigger point

**Decision**: Warning dialog is triggered in `SettingsPanel` when the user attempts to toggle yolo mode on.

**Rationale**: The backend does not track whether the warning was shown; it simply stores the boolean. The frontend is responsible for confirming intent before calling `PATCH /api/v1/settings`. This follows the existing pattern for destructive confirmations in UI.

**Alternatives considered**: Server-side confirmation token (rejected: over-engineered for a localhost tool). Backend always shows warning (N/A: backend has no UI).

---

### 5. useArgusSettings hook placement

**Decision**: Create a new `useArgusSettings` hook in `frontend/src/hooks/useArgusSettings.ts`.

**Rationale**: The existing `useSettings` hook manages `DashboardSettings` (localStorage). Yolo mode is a backend setting and requires React Query for caching and invalidation. Keeping them separate avoids mixing concerns.

**Alternatives considered**: Extend `useSettings` to also manage backend settings (rejected: mixes two distinct persistence layers).

---

### 6. Yolo mode detection for per-session icon display

**Decision**: Store `yoloMode` per session in the database at launch time. This is the primary detection method. Process command line inspection is a secondary fallback for detected (non-PTY) sessions.

**Rationale**: Seven detection methods were evaluated:

| Method | Per-Session | Persists | Viable |
|--------|------------|----------|--------|
| Process command line (`Get-CimInstance Win32_Process`) | Yes | No (live only) | Yes |
| Backend config (`loadConfig().yoloMode`) | No (global) | Yes | Already exists |
| Session DB metadata (new `yolo_mode` column) | Yes | Yes | **Recommended** |
| Claude Code config files (`~/.claude/`) | No | No | Not viable |
| Copilot config files (`~/.copilot/session-state/`) | No | No | Not viable |
| Environment variables | Yes | No | Fragile |
| API/IPC from Claude/Copilot | No | No | Not viable |

The session DB approach is the only method that is both per-session and persistent. The launch.ts CLI already detects `yoloActive` from command line args (line 46) but does not transmit it to the backend. Adding it to the WebSocket `RegisterMessage` and storing it in the session record completes the data flow.

**Alternatives considered**: Process command line only (rejected: only works for running sessions, lost after exit, requires OS-specific process inspection). Environment variables (rejected: fragile, explicitly stripped for Claude Code). Global config check (rejected: does not track per-session state, e.g. user enables yolo, launches session, then disables yolo).

---

### 7. Yolo mode icon placement

**Decision**: Add a small icon/badge inline with the existing session type badge in `SessionCard.tsx`, using Lucide React icons consistent with the existing icon system.

**Rationale**: The SessionCard already shows type badges (Claude/Copilot), status badges (running/resting), and launch mode badges (live/read-only). A yolo mode indicator fits naturally as an additional badge. Using Lucide React icons (e.g., `ShieldOff` for yolo, `Shield` for normal) keeps the icon system consistent.

**Alternatives considered**: Overlay icon on the session type badge (rejected: cluttered at small sizes). Color change on the card border (rejected: color already used for selection state). Separate column in session list (rejected: wastes space).
