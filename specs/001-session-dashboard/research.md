# Phase 0 Research: Session Dashboard

**Date**: 2026-04-01 | **Feature**: [spec.md](./spec.md)

---

## Decision 1: Backend Language & Runtime

**Decision**: TypeScript 5.x + Node.js 22 LTS

**Rationale**: Cross-platform (Windows/macOS/Linux), single language for frontend and backend, excellent file-watching ecosystem (chokidar), native process management, strong SQLite bindings (better-sqlite3), and mature WebSocket support (ws). The team is a solo developer — minimizing language context switching matters.

**Alternatives considered**:
- Python: Good process monitoring libs but requires a separate frontend language; slower cold start
- Go: Excellent binaries and system-level access but separate frontend language and less mature web UI ecosystem
- Rust: Too complex for this scope; not justified by v1 performance requirements

---

## Decision 2: Frontend Framework

**Decision**: React 18 + Vite + TypeScript + Tailwind CSS + shadcn/ui

**Rationale**: React is mature, has the largest ecosystem, and integrates cleanly with TanStack Query for server-state management. Vite gives fast builds. shadcn/ui provides accessible, unstyled-by-default components that are easy to theme. Single language (TypeScript) across frontend and backend reduces cognitive overhead.

**Alternatives considered**:
- Vue: Less TypeScript-native, smaller ecosystem
- Svelte: Excellent performance but smaller ecosystem and less tooling
- Next.js: Overkill for a local-only single-page app

---

## Decision 3: Storage

**Decision**: SQLite via better-sqlite3 (session output history) + JSON config file at `~/.argus/config.json` (repository registration)

**Rationale**: SQLite is embedded, requires no server, supports transactions, and is queryable. Perfect for a single-developer local tool. Config as JSON is simple, human-readable, and version-controllable. better-sqlite3 is synchronous (no callback hell) and the fastest Node.js SQLite binding.

**Alternatives considered**:
- PostgreSQL: Requires a running server — overkill for local tool
- Plain JSON files for output: No transactions, poor query performance at scale
- LevelDB: Less queryable, overkill for this volume

---

## Decision 4: Real-Time Updates

**Decision**: WebSockets (ws library) — server pushes events to all connected browser clients

**Rationale**: Session state changes (output, status changes) must reach the browser within 2 seconds per SC-002. WebSockets give push capability without polling. The ws library is minimal, battle-tested, and requires no additional protocol overhead.

**Alternatives considered**:
- Server-Sent Events (SSE): One-way only — cannot support future bidirectional features
- Polling: Wasteful and difficult to meet 2s latency target reliably
- Socket.io: Adds unnecessary abstraction overhead for a local-only app

---

## Decision 5: GitHub Copilot CLI Session Detection

**Decision**: File-system based detection via `~/.copilot/session-state/`

**Rationale**: Direct inspection of the Copilot CLI data directory on this machine revealed a well-structured, stable format:
- `~/.copilot/session-state/{session-uuid}/` — one directory per session
- `inuse.{PID}.lock` — presence indicates active session; filename contains the OS process ID
- `workspace.yaml` — YAML file with `id`, `cwd` (repository path), `summary`, `created_at`, `updated_at`
- `events.jsonl` — append-only JSONL event stream (typed events with timestamps)
- `session.db` — SQLite database present in some sessions

**Integration approach**:
1. Scan `~/.copilot/session-state/` on startup and on directory change events
2. Active session = directory containing an `inuse.{PID}.lock` file
3. Extract PID from lock filename; verify process is still running
4. Read `workspace.yaml` to get repository CWD and session metadata
5. Use `chokidar` to tail `events.jsonl` for real-time output streaming

**Named pipe (MCP) noted**: Copilot CLI creates `\\.\pipe\mcp-{UUID}.sock` Windows named pipes for IDE integration. This is available for future richer integration but not required for v1.

**Alternatives considered**:
- OS process scanning only: Cannot retrieve session output or CWD without the file system data
- Named pipe MCP protocol: Richer but requires implementing MCP client; deferred to post-v1

---

## Decision 6: Claude Code Session Detection

**Decision**: Hook injection into `~/.claude/settings.json` + file-system watching of `~/.claude/projects/`

**Rationale**: Claude Code exposes a comprehensive hook system with 12+ event types (SessionStart, PreToolUse, PostToolUse, Stop, etc.). Hooks are configured as shell commands that receive JSON on stdin and can POST to a local HTTP endpoint. This is the officially supported way to receive events from a running Claude Code session.

**Hook configuration Argus injects** (into `~/.claude/settings.json`):
```json
{
  "hooks": {
    "SessionStart": [{"hooks": [{"type": "command", "command": "curl -sf -X POST http://127.0.0.1:7411/hooks/claude -H 'Content-Type: application/json' -d @- 2>/dev/null || true"}]}],
    "PreToolUse":   [{"hooks": [{"type": "command", "command": "curl -sf -X POST http://127.0.0.1:7411/hooks/claude -H 'Content-Type: application/json' -d @- 2>/dev/null || true"}]}],
    "PostToolUse":  [{"hooks": [{"type": "command", "command": "curl -sf -X POST http://127.0.0.1:7411/hooks/claude -H 'Content-Type: application/json' -d @- 2>/dev/null || true"}]}],
    "Stop":         [{"hooks": [{"type": "command", "command": "curl -sf -X POST http://127.0.0.1:7411/hooks/claude -H 'Content-Type: application/json' -d @- 2>/dev/null || true"}]}]
  }
}
```

Hook payload includes: `session_id`, `cwd`, `tool_name`, `tool_input`, `tool_result`, `hook_event_name`.

**Alternatives considered**:
- MCP server (Argus as MCP): Allows Claude to query Argus but requires Claude to initiate — cannot push events to Argus unprompted. Hooks provide push semantics needed for real-time monitoring. MCP deferred to post-v1.
- Process scanning only: Cannot get session output without hooks

---

## Decision 7: Session Control — Stop

**Decision**: OS-level process termination via PID

**Rationale**: Both Copilot CLI (`inuse.{PID}.lock`) and Claude Code (detectable via `ps-list`) expose their PIDs. Sending SIGTERM (Unix) or `taskkill /PID {pid}` (Windows) is the only reliable cross-platform stop mechanism available without documented IPC stop APIs.

**Implementation**: Use Node.js `process.kill(pid, 'SIGTERM')` on Unix/macOS; `exec('taskkill /PID {pid} /T')` on Windows.

---

## Decision 8: Session Control — Send Prompt

**Decision**: Deferred mechanism — v1 will support send-prompt for Claude Code only via hook response injection; Copilot CLI send-prompt deferred to v1.1

**Rationale**: Injecting prompts into a running AI session requires a two-way IPC channel. Claude Code hooks are currently one-way (push to Argus). Copilot CLI has no documented prompt injection API. The `send_prompt` API endpoint will be implemented but return a `501 Not Implemented` response for Copilot CLI sessions in v1, with a clear user-facing message.

**Post-v1 path**: Copilot CLI named pipe MCP protocol (`\\.\pipe\mcp-{UUID}.sock`) is a candidate for richer send-prompt integration.

---

## Decision 9: HTTP Framework

**Decision**: Fastify 4

**Rationale**: Faster than Express, first-class TypeScript support, built-in JSON schema validation, plugin ecosystem. Good WebSocket integration via `@fastify/websocket`.

**Alternatives considered**:
- Express: Slower, no built-in validation, less TypeScript-native
- Hono: Excellent but smaller ecosystem; less battle-tested for this use case
- NestJS: Far too heavy for a local single-developer tool

---

## Decision 10: Testing Stack

**Decision**: Vitest (unit + integration), Supertest (REST contract tests), Playwright (E2E)

**Rationale**: Vitest is Jest-compatible, faster, and native to Vite projects. Supertest integrates well with Fastify for HTTP contract tests. Playwright is the gold standard for E2E browser testing and has excellent Windows support.

**Alternatives considered**:
- Jest: Slower than Vitest; no advantage for a new project
- Cypress: Heavier than Playwright; Playwright has better cross-browser support
