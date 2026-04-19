# argus2 Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-04-19

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
- TypeScript (Node.js 20 backend, React 18 frontend) + Fastify, better-sqlite3, React Query, Tailwind CSS, Vite (032-repo-compare-session-focus)
- SQLite via better-sqlite3; runtime migration pattern (ALTER TABLE IF NOT EXISTS column) (032-repo-compare-session-focus)
- [e.g., Python 3.11, Swift 5.9, Rust 1.75 or NEEDS CLARIFICATION] + [e.g., FastAPI, UIKit, LLVM or NEEDS CLARIFICATION] (043-marketing-landing-page)
- [if applicable, e.g., PostgreSQL, CoreData, files or N/A] (043-marketing-landing-page)
- HTML5, CSS3, JavaScript ES2020 (vanilla, no framework) + None (zero npm dependencies); shields.io CDN for dynamic badges (043-marketing-landing-page)
- N/A (static files only) (043-marketing-landing-page)
- TypeScript 5.x + React 18, lucide-react (icons), Tailwind CSS (046-github-feedback)

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
- 046-github-feedback: Added TypeScript 5.x + React 18, lucide-react (icons), Tailwind CSS
- 043-marketing-landing-page: Added HTML5, CSS3, JavaScript ES2020 (vanilla, no framework) + None (zero npm dependencies); shields.io CDN for dynamic badges
- 043-marketing-landing-page: Added [e.g., Python 3.11, Swift 5.9, Rust 1.75 or NEEDS CLARIFICATION] + [e.g., FastAPI, UIKit, LLVM or NEEDS CLARIFICATION]


<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
