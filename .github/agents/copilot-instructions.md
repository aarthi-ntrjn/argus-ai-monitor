# argus2 Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-04-10

## Active Technologies
- TypeScript 5.9, Node.js 22 + node-pty (new), Fastify 5, better-sqlite3, ws, @fastify/websocket (020-fix-send-prompts)
- SQLite (better-sqlite3) — adding `launch_mode` column to sessions table (020-fix-send-prompts)
- TypeScript 5.x (Node.js 22 LTS) + better-sqlite3, chokidar, ps-list, fastify, @tanstack/react-query (021-session-pid-mapping)
- SQLite (better-sqlite3), `~/.argus/argus.db` (021-session-pid-mapping)
- TypeScript 5.x, React 18.3 + React Query (existing), Tailwind CSS (existing), React Markdown (existing) (023-stream-attention)
- `localStorage` via existing `useSettings` hook (`argus:settings` key) (023-stream-attention)

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
- 023-stream-attention: Added TypeScript 5.x, React 18.3 + React Query (existing), Tailwind CSS (existing), React Markdown (existing)
- 021-session-pid-mapping: Added TypeScript 5.x (Node.js 22 LTS) + better-sqlite3, chokidar, ps-list, fastify, @tanstack/react-query
- 020-fix-send-prompts: Added TypeScript 5.9, Node.js 22 + node-pty (new), Fastify 5, better-sqlite3, ws, @fastify/websocket


<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
