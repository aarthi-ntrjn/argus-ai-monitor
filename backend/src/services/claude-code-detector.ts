import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, openSync, readSync, closeSync, statSync } from 'fs';
import { join, dirname, normalize } from 'path';
import { homedir } from 'os';
import psList from 'ps-list';
import chokidar, { type FSWatcher } from 'chokidar';
import { getSession, upsertSession, getRepositories, getRepositoryByPath } from '../db/database.js';
import { OutputStore } from './output-store.js';
import { broadcast } from '../api/ws/event-dispatcher.js';
import { parseClaudeJsonlLine, parseModel } from './claude-code-jsonl-parser.js';
import type { Session } from '../models/index.js';

const CLAUDE_SETTINGS_PATH = join(homedir(), '.claude', 'settings.json');
const HOOK_COMMAND = 'curl -sf -X POST http://127.0.0.1:7411/hooks/claude -H "Content-Type: application/json" -d @- 2>/dev/null || true';
const HOOK_EVENTS = ['SessionStart', 'PreToolUse', 'PostToolUse', 'Stop'];

interface ClaudeSettings {
  hooks?: Record<string, Array<{ matcher: string; hooks: Array<{ type: string; command: string }> }>>;
  [key: string]: unknown;
}

interface HookPayload {
  hook_event_name: string;
  session_id: string;
  cwd?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_result?: unknown;
  [key: string]: unknown;
}

const ACTIVE_JSONL_THRESHOLD_MS = 30 * 60 * 1000;

export class ClaudeCodeDetector {
  private outputStore = new OutputStore();
  private watchers = new Map<string, FSWatcher>();
  private filePositions = new Map<string, number>();
  private sequenceCounters = new Map<string, number>();
  injectHooks(): void {
    try {
      mkdirSync(dirname(CLAUDE_SETTINGS_PATH), { recursive: true });
      let settings: ClaudeSettings = {};
      if (existsSync(CLAUDE_SETTINGS_PATH)) {
        settings = JSON.parse(readFileSync(CLAUDE_SETTINGS_PATH, 'utf-8'));
      }
      if (!settings.hooks) settings.hooks = {};
      let changed = false;
      for (const event of HOOK_EVENTS) {
        if (!this.hasHook(settings, event)) {
          if (!settings.hooks[event]) settings.hooks[event] = [];
          settings.hooks[event].push({ matcher: '', hooks: [{ type: 'command', command: HOOK_COMMAND }] });
          changed = true;
        }
      }
      if (changed) writeFileSync(CLAUDE_SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf-8');
    } catch { /* ignore if settings file inaccessible */ }
  }

  removeHooksForRepo(_repoPath: string): void {
    // Claude hooks are global (not repo-specific) — the single HOOK_COMMAND listens for all repos.
    // We do not remove them on a per-repo basis to avoid breaking other registered repos.
    // Hooks are only removed when ALL repos are gone or the user manually clears them.
  }

  removeAllHooks(): void {
    try {
      if (!existsSync(CLAUDE_SETTINGS_PATH)) return;
      const settings: ClaudeSettings = JSON.parse(readFileSync(CLAUDE_SETTINGS_PATH, 'utf-8'));
      if (!settings.hooks) return;
      let changed = false;
      for (const event of HOOK_EVENTS) {
        const entries = settings.hooks[event];
        if (!entries) continue;
        const filtered = entries.filter(
          (entry) => !entry.hooks?.some((h) => h.command === HOOK_COMMAND)
        );
        if (filtered.length !== entries.length) {
          settings.hooks[event] = filtered;
          changed = true;
        }
      }
      if (changed) writeFileSync(CLAUDE_SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf-8');
    } catch { /* ignore */ }
  }

  private hasHook(settings: ClaudeSettings, event: string): boolean {
    const eventHooks = settings.hooks?.[event];
    if (!eventHooks) return false;
    return eventHooks.some((entry) =>
      entry.hooks?.some((h) => h.command === HOOK_COMMAND)
    );
  }

  // Claude names project dirs by replacing path separators (:, \, /) with hyphens.
  // e.g. C:\source\argus → C--source-argus
  // Encoding forward is deterministic; decoding back is lossy (hyphens in names are ambiguous).
  private claudeProjectDirName(repoPath: string): string {
    return repoPath.replace(/[:\\/]/g, '-');
  }

  async scanExistingSessions(): Promise<void> {
    const projectsDir = join(homedir(), '.claude', 'projects');
    if (!existsSync(projectsDir)) return;

    let processes: Awaited<ReturnType<typeof psList>>;
    try {
      processes = await psList();
    } catch {
      return;
    }

    const claudeProcess = processes.find(p =>
      p.name.toLowerCase().includes('claude') || p.cmd?.toLowerCase().includes('claude')
    );
    if (!claudeProcess) return;
    const claudePid = claudeProcess.pid;

    try {
      const projectDirNames = new Set(
        readdirSync(projectsDir, { withFileTypes: true })
          .filter(e => e.isDirectory())
          .map(e => e.name.toLowerCase())
      );

      for (const repo of getRepositories()) {
        const expectedDirName = this.claudeProjectDirName(repo.path).toLowerCase();
        if (!projectDirNames.has(expectedDirName)) continue;

        const projectDir = join(projectsDir, this.claudeProjectDirName(repo.path));

        // Find the most recently modified JSONL file — its basename IS the real session ID
        let jsonlEntries: Array<{ id: string; path: string; mtime: Date }>;
        try {
          jsonlEntries = readdirSync(projectDir)
            .filter(f => f.endsWith('.jsonl'))
            .map(f => {
              const fp = join(projectDir, f);
              return { id: f.slice(0, -6), path: fp, mtime: statSync(fp).mtime };
            })
            .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
        } catch {
          continue;
        }

        const mostRecent = jsonlEntries[0];
        if (!mostRecent) continue;
        if (Date.now() - mostRecent.mtime.getTime() > ACTIVE_JSONL_THRESHOLD_MS) continue;

        const sessionId = mostRecent.id;
        const now = new Date().toISOString();

        // If already active, just ensure the watcher is running (e.g. after server restart)
        const existingSession = getSession(sessionId);
        if (existingSession?.status === 'active') {
          this.watchJsonlFile(sessionId, repo.path);
          continue;
        }

        // Activate the session using its real ID
        const base: Session = existingSession ?? {
          id: sessionId,
          repositoryId: repo.id,
          type: 'claude-code',
          pid: claudePid,
          status: 'active',
          startedAt: now,
          endedAt: null,
          lastActivityAt: now,
          summary: null,
          expiresAt: null,
          model: null,
        };

        upsertSession({ ...base, status: 'active', endedAt: null, lastActivityAt: now, pid: claudePid });
        this.watchJsonlFile(sessionId, repo.path);
      }
    } catch { /* ignore */ }
  }

  async handleHookPayload(payload: HookPayload): Promise<void> {
    const { hook_event_name, session_id, cwd } = payload;
    if (!session_id) return;

    const normalizedCwd = cwd ? normalize(cwd.trimEnd().replace(/[/\\]+$/, '')) : null;
    const repo = normalizedCwd ? getRepositoryByPath(normalizedCwd) : null;
    if (!repo) return;

    const existing = getSession(session_id);
    const now = new Date().toISOString();

    const session: Session = existing ?? {
      id: session_id,
      repositoryId: repo.id,
      type: 'claude-code',
      pid: null,
      status: 'active',
      startedAt: now,
      endedAt: null,
      lastActivityAt: now,
      summary: null,
      expiresAt: null,
      model: null,
    };

    // All hook events keep the session active and update lastActivityAt.
    // The UI's isInactive() (20-min threshold on lastActivityAt) handles the "resting" display.
    session.status = 'active';
    session.lastActivityAt = now;

    upsertSession(session);

    // Start JSONL watcher if not already watching
    this.watchJsonlFile(session_id, repo.path);
  }

  private watchJsonlFile(sessionId: string, repoPath: string): void {
    if (this.watchers.has(sessionId)) return;
    const jsonlPath = join(
      homedir(), '.claude', 'projects',
      this.claudeProjectDirName(repoPath),
      `${sessionId}.jsonl`,
    );
    if (!existsSync(jsonlPath)) return;

    // Load all existing lines
    this.filePositions.set(sessionId, 0);
    this.sequenceCounters.set(sessionId, 0);
    this.readNewJsonlLines(sessionId, jsonlPath);

    const watcher = chokidar.watch(jsonlPath, { persistent: false, usePolling: false });
    watcher.on('change', () => this.readNewJsonlLines(sessionId, jsonlPath));
    this.watchers.set(sessionId, watcher);
  }

  private readNewJsonlLines(sessionId: string, filePath: string): void {
    try {
      const currentSize = statSync(filePath).size;
      const lastPos = this.filePositions.get(sessionId) ?? 0;
      if (currentSize <= lastPos) return;

      const fd = openSync(filePath, 'r');
      const buffer = Buffer.alloc(currentSize - lastPos);
      readSync(fd, buffer, 0, buffer.length, lastPos);
      closeSync(fd);
      this.filePositions.set(sessionId, currentSize);

      const lines = buffer.toString('utf-8').split('\n').filter(l => l.trim());
      let seq = this.sequenceCounters.get(sessionId) ?? 0;
      const outputs = [];
      let needsModel = !(getSession(sessionId)?.model);

      for (const line of lines) {
        seq++;
        const items = parseClaudeJsonlLine(line, sessionId, seq);
        outputs.push(...items);

        if (needsModel) {
          const model = parseModel(line);
          if (model) {
            const existing = getSession(sessionId);
            if (existing) {
              const updated = { ...existing, model };
              upsertSession(updated);
              broadcast({ type: 'session.updated', timestamp: new Date().toISOString(), data: updated as unknown as Record<string, unknown> });
            }
            needsModel = false;
          }
        }
      }

      this.sequenceCounters.set(sessionId, seq);
      if (outputs.length > 0) {
        this.outputStore.insertOutput(sessionId, outputs);
      }
    } catch { /* ignore */ }
  }

  stopWatchers(): void {
    for (const watcher of this.watchers.values()) {
      watcher.close().catch(() => { /* ignore */ });
    }
    this.watchers.clear();
  }
}