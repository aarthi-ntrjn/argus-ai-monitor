# Argus — Architecture

Argus is a local dashboard that gives you centralized visibility and remote control over Claude Code and GitHub Copilot CLI sessions running on your machine. It runs a Fastify backend (Node/TypeScript) that watches AI tool files on disk and injects hooks, stores everything in SQLite, and streams updates to a React frontend over WebSockets.

```mermaid
flowchart TB
    subgraph Browser["🌐 Browser (React + Vite)"]
        direction TB
        Dashboard["DashboardPage\nSessionCard · OutputPane"]
        SessionPg["SessionPage\nSessionDetail · ControlPanel"]
        TQ["TanStack Query\nREST cache + invalidation"]
        WSClient["socket.ts\nWebSocket · auto-reconnect"]
    end

    subgraph Backend["⚙️ Fastify Backend  —  port 7411"]
        direction TB

        subgraph API["HTTP Layer"]
            REST["REST API  /api/v1\nsessions · repositories · fs"]
            HookEndpoint["POST /hooks/claude\nhook receiver"]
        end

        WSServer["WebSocket  /ws\nevent-dispatcher\nsession.created · session.updated\nsession.ended · session.output"]

        subgraph Monitor["Session Monitor  (5 s poll)"]
            direction LR

            subgraph CCD["ClaudeCodeDetector"]
                direction TB
                CC1["1 · injectHooks()\n→ ~/.claude/settings.json"]
                CC2["2 · scanExisting()\nJSONL mtime &lt; 30 min\n+ ps-list PID check"]
                CC3["3 · chokidar watch\n~/.claude/projects/\n{encoded}/{id}.jsonl"]
                CC4["4 · parseClaudeJsonl\nuser · assistant\ntool_use · tool_result\nextract model"]
                CC1 --> CC2 --> CC3 --> CC4
            end

            subgraph CPD["CopilotCliDetector"]
                direction TB
                CP1["1 · scan\n~/.copilot/session-state/"]
                CP2["2 · read\nworkspace.yaml\ninuse.PID.lock"]
                CP3["3 · chokidar watch\nevents.jsonl"]
                CP4["4 · parseJsonlLine\nuser.message\nassistant.message\ntool.exec_*"]
                CP1 --> CP2 --> CP3 --> CP4
            end
        end

        OutputStore["OutputStore\ninsertOutput → broadcast"]
        DB[("SQLite\n~/.argus/argus.db\n─────────────\nrepositories\nsessions\nsession_output\ncontrol_actions")]
    end

    subgraph ClaudeCode["🤖 Claude Code Process"]
        CCSettings["~/.claude/settings.json\ninjected hooks"]
        CCFiles["~/.claude/projects/**/*.jsonl\nconversation history"]
    end

    subgraph CopilotCLI["🤖 Copilot CLI Process"]
        CPFiles["~/.copilot/session-state/{uuid}/\nworkspace.yaml\nevents.jsonl\ninuse.{PID}.lock"]
    end

    %% Browser ↔ Backend
    TQ -- "HTTP REST" --> REST
    WSClient -- "WS events" --> WSServer
    WSServer -- "push updates" --> WSClient

    %% Hook flow
    CCSettings -- "curl POST" --> HookEndpoint
    HookEndpoint --> CCD

    %% File watching
    CC3 -. "chokidar" .-> CCFiles
    CP3 -. "chokidar" .-> CPFiles

    %% Data flow
    CC4 --> OutputStore
    CP4 --> OutputStore
    OutputStore --> WSServer
    Monitor --> DB
    REST --> DB
```

## Key Design Decisions

- **No agents/APIs** — detection is purely file-system based (no Copilot API calls, no Claude API calls)
- **Claude Code hooks** are injected into `~/.claude/settings.json` to receive push events; Copilot is detected passively via file watching
- **WebSocket push** keeps the UI live; TanStack Query handles caching and cache invalidation on WS events
- **SQLite** stores full session history with configurable retention via `pruning-job.ts`

## Development Tooling

All feature work follows a Speckit specification-driven pipeline (`specify → clarify → plan → tasks → analyze → implement`). See `CLAUDE.md` for the full workflow — it is the single source of truth for both Claude Code and the GitHub Copilot CLI.

Speckit skill definitions live in `.claude/commands/`. The CI pipeline (`.github/workflows/ci.yml`) enforces lockfile integrity, action SHA pinning, and critical CVE auditing on every push.
