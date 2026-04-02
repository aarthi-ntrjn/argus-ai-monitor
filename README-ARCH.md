# Argus — Architecture

Argus is a local dashboard that gives you centralized visibility and remote control over Claude Code and GitHub Copilot CLI sessions running on your machine. It runs a Fastify backend (Node/TypeScript) that watches AI tool files on disk and injects hooks, stores everything in SQLite, and streams updates to a React frontend over WebSockets.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          USER'S MACHINE                                     │
│                                                                             │
│  ┌─────────────────────────────────────────────────┐                        │
│  │              BROWSER (React + Vite)             │                        │
│  │                                                 │                        │
│  │  DashboardPage          SessionPage             │                        │
│  │  ┌──────────────┐       ┌───────────────────┐  │                        │
│  │  │ SessionCard  │       │ SessionDetail     │  │                        │
│  │  │ (model badge,│       │ (output stream,   │  │                        │
│  │  │  YOU/AI,     │       │  YOU/AI role      │  │                        │
│  │  │  run/rest)   │       │  labels, PST time)│  │                        │
│  │  └──────────────┘       └───────────────────┘  │                        │
│  │  ┌──────────────────────────────────────────┐  │                        │
│  │  │  TanStack Query (REST cache + refetch)   │  │                        │
│  │  │  socket.ts (WebSocket, auto-reconnect)   │  │                        │
│  │  └──────────────┬───────────────────────────┘  │                        │
│  └─────────────────│─────────────────────────────-┘                        │
│                    │ HTTP + WS (port 7411)                                  │
│  ┌─────────────────▼────────────────────────────────────────────────┐      │
│  │                   FASTIFY BACKEND                                 │      │
│  │                                                                   │      │
│  │  ┌──────────────────────┐  ┌────────────────────────────────┐   │      │
│  │  │  REST API (/api/v1)  │  │  WebSocket (/ws)               │   │      │
│  │  │  sessions            │  │  event-dispatcher.ts           │   │      │
│  │  │  repositories        │  │  broadcasts: session.created,  │   │      │
│  │  │  fs (folder picker)  │  │  session.updated, session.ended│   │      │
│  │  └──────────────────────┘  │  session.output, repo.*        │   │      │
│  │  ┌──────────────────────┐  └────────────────────────────────┘   │      │
│  │  │  POST /hooks/claude  │◄────────────────────────────────────┐ │      │
│  │  │  (hook receiver)     │                                     │ │      │
│  │  └──────────┬───────────┘                                     │ │      │
│  │             │                                                  │ │      │
│  │  ┌──────────▼───────────────────────────────────────────┐    │ │      │
│  │  │              SESSION MONITOR (5s poll)               │    │ │      │
│  │  │                                                      │    │ │      │
│  │  │  ┌─────────────────────────┐  ┌──────────────────┐  │    │ │      │
│  │  │  │  ClaudeCodeDetector     │  │ CopilotCliDetect │  │    │ │      │
│  │  │  │                         │  │                  │  │    │ │      │
│  │  │  │  1. injectHooks()       │  │ 1. scan          │  │    │ │      │
│  │  │  │     → ~/.claude/        │  │    ~/.copilot/   │  │    │ │      │
│  │  │  │       settings.json     │  │    session-state/│  │    │ │      │
│  │  │  │  2. scanExisting()      │  │ 2. read          │  │    │ │      │
│  │  │  │     JSONL mtime < 30min │  │    workspace.yaml│  │    │ │      │
│  │  │  │     + ps-list PID check │  │    inuse.PID.lock│  │    │ │      │
│  │  │  │  3. chokidar watch      │  │ 3. chokidar watch│  │    │ │      │
│  │  │  │     ~/.claude/projects/ │  │    events.jsonl  │  │    │ │      │
│  │  │  │     {encoded}/{id}.jsonl│  │                  │  │    │ │      │
│  │  │  │  4. parseClaudeJsonl    │  │ 4. parseJsonlLine│  │    │ │      │
│  │  │  │     → user/assistant/   │  │    → user.message│  │    │ │      │
│  │  │  │       tool_use/result   │  │    assistant.msg │  │    │ │      │
│  │  │  │     → extract model     │  │    tool.exec_*   │  │    │ │      │
│  │  │  └─────────────────────────┘  └──────────────────┘  │    │ │      │
│  │  │  ┌──────────────────────────────────────────────┐    │    │ │      │
│  │  │  │  OutputStore → insertOutput → broadcast WS   │    │    │ │      │
│  │  │  └──────────────────────────────────────────────┘    │    │ │      │
│  │  └──────────────────────────────────────────────────────┘    │ │      │
│  │                                                               │ │      │
│  │  ┌────────────────────────────────────────────────────┐      │ │      │
│  │  │   SQLite (~/.argus/argus.db)                        │      │ │      │
│  │  │   repositories | sessions | session_output |        │      │ │      │
│  │  │   control_actions                                   │      │ │      │
│  │  └────────────────────────────────────────────────────┘      │ │      │
│  └───────────────────────────────────────────────────────────────┘ │      │
│                                                                     │      │
│  ┌──────────────────────────────────────┐                           │      │
│  │  Claude Code process                 │ curl POST /hooks/claude ──┘      │
│  │  ~/.claude/settings.json (hooks)     │                                  │
│  │  ~/.claude/projects/**/*.jsonl       │◄── chokidar watches              │
│  └──────────────────────────────────────┘                                  │
│                                                                             │
│  ┌──────────────────────────────────────┐                                  │
│  │  Copilot CLI process                 │                                  │
│  │  ~/.copilot/session-state/           │◄── chokidar watches              │
│  │    {uuid}/workspace.yaml             │                                  │
│  │    {uuid}/events.jsonl               │                                  │
│  │    {uuid}/inuse.{PID}.lock           │                                  │
│  └──────────────────────────────────────┘                                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Key Design Decisions

- **No agents/APIs** — detection is purely file-system based (no Copilot API calls, no Claude API calls)
- **Claude Code hooks** are injected into `~/.claude/settings.json` to receive push events; Copilot is detected passively
- **WebSocket push** keeps the UI live; TanStack Query handles caching and cache invalidation on WS events
- **SQLite** stores full session history with configurable retention via `pruning-job.ts`
