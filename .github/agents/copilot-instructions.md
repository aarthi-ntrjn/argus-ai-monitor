# argus2 Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-04-07

## Active Technologies
- TypeScript 5.9, Node.js 22 + node-pty (new), Fastify 5, better-sqlite3, ws, @fastify/websocket (020-fix-send-prompts)
- SQLite (better-sqlite3) — adding `launch_mode` column to sessions table (020-fix-send-prompts)

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
- 020-fix-send-prompts: Added TypeScript 5.9, Node.js 22 + node-pty (new), Fastify 5, better-sqlite3, ws, @fastify/websocket

- 015-docs-cleanup: Added /pull command; improved README and contributor guide
- 014-engineer-todo-list: Added TypeScript 5.9 (frontend + backend) + Fastify 5.x (backend), React 18 + TailwindCSS 3 + React Query (frontend), better-sqlite3 (storage), pino (logging), vitest + Playwright (testing)

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
