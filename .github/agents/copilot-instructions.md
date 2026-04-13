# argus2 Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-04-13

## Active Technologies
- TypeScript 5.9, Node.js 22 + node-pty (new), Fastify 5, better-sqlite3, ws, @fastify/websocket (020-fix-send-prompts)
- SQLite (better-sqlite3) — adding `launch_mode` column to sessions table (020-fix-send-prompts)
- TypeScript 5.x (Node.js 22 LTS) + better-sqlite3, chokidar, ps-list, fastify, @tanstack/react-query (021-session-pid-mapping)
- SQLite (better-sqlite3), `~/.argus/argus.db` (021-session-pid-mapping)
- TypeScript 5.x, React 18.3 + React Query (existing), Tailwind CSS (existing), React Markdown (existing) (023-stream-attention)
- `localStorage` via existing `useSettings` hook (`argus:settings` key) (023-stream-attention)
- TypeScript 5.x (backend Node.js 20, frontend React 18 + Vite) + Fastify (backend API), React Query (frontend data fetching), Tailwind CSS (frontend styling) (025-yolo-mode)
- `~/.argus/config.json` (existing key-value config file managed by `config-loader.ts`) (025-yolo-mode)
- TypeScript 5.x (React 18 frontend, Node.js backend) + React, TanStack React Query, Tailwind CSS, Lucide icons, React Router (027-kill-session)
- SQLite (existing, no schema changes needed) (027-kill-session)
- TypeScript 5.x, React 18 + React, Tailwind CSS, Vitest, Playwright (026-configurable-resting)
- `localStorage` via the existing `useSettings` hook (`argus:settings` key) (026-configurable-resting)
- N/A (reads from existing session output query cache; no new persistence) (028-ai-choice-alert)
- TypeScript 5, Node.js >=22 (backend); React 18 + TypeScript 5 (frontend) + Fastify 5, better-sqlite3, Vitest; Microsoft Bot Framework REST API (via native `fetch`) for outbound messages; Bot Framework activity schema for inbound webhook events (031-teams-channel-integration)
- SQLite (better-sqlite3) — new `teams_threads` table; Teams credentials stored in `~/.argus/teams-config.json` (separate from general config to isolate secrets) (031-teams-channel-integration)

- TypeScript 5.9 (frontend + backend) + Fastify 5.x (backend), React 18 + TailwindCSS 3 + React Query (frontend), better-sqlite3 (storage), pino (logging), vitest + Playwright (testing) (014-engineer-todo-list)

## Project Structure

```text
backend/
frontend/
tests/
```

## Commands

npm test; npm run lint

## Code Style

TypeScript 5.9 (frontend + backend): Follow standard conventions

## Recent Changes
- 031-teams-channel-integration: Added TypeScript 5, Node.js >=22 (backend); React 18 + TypeScript 5 (frontend) + Fastify 5, better-sqlite3, Vitest; Microsoft Bot Framework REST API (via native `fetch`) for outbound messages; Bot Framework activity schema for inbound webhook events
- 028-ai-choice-alert: Added TypeScript 5.x, React 18 + React, Tailwind CSS, Vitest, Playwright
- 027-kill-session: Added TypeScript 5.x (React 18 frontend, Node.js backend) + React, TanStack React Query, Tailwind CSS, Lucide icons, React Router


<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
