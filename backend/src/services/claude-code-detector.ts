import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { open as fsOpen, stat as fsStat } from 'fs/promises';
import { join, dirname, normalize } from 'path';
import { homedir } from 'os';
import psList from 'ps-list';
import chokidar, { type FSWatcher } from 'chokidar';
import { getSession, getSessions, upsertSession, getRepositories, getRepositoryByPath } from '../db/database.js';
import { OutputStore } from './output-store.js';
import { broadcast } from '../api/ws/event-dispatcher.js';
import { parseClaudeJsonlLine, parseModel } from './claude-code-jsonl-parser.js';
import type { Session, Repository } from '../models/index.js';

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

export const ACTIVE_JSONL_THRESHOLD_MS = 30 * 60 * 1000;

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
  static projectDirName(repoPath: string): string {
    return repoPath.replace(/[:\\/]/g, '-');
  }

  private claudeProjectDirName(repoPath: string): string {
    return ClaudeCodeDetector.projectDirName(repoPath);
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

        await this.activateFoundSession(mostRecent.id, repo, claudePid);
      }
    } catch { /* ignore */ }
  }

  // Return an active PTY session for this repository, if one exists.
  // Used to avoid creating a duplicate detected session when argus launch is running.
  private activePtySessionForRepo(repositoryId: string): Session | undefined {
    return getSessions({ repositoryId, status: 'active' }).find(s => s.launchMode === 'pty');
  }

  async handleHookPayload(payload: HookPayload): Promise<void> {
    const { hook_event_name, session_id, cwd } = payload;
    if (!session_id) return;

    const normalizedCwd = cwd ? normalize(cwd.trimEnd().replace(/[/\\]+$/, '')) : null;
    const repo = normalizedCwd ? getRepositoryByPath(normalizedCwd) : null;
    if (!repo) return;

    const existing = getSession(session_id);
    const now = new Date().toISOString();

    // If this claude session isn't in the DB yet, check whether a PTY session
    // already exists for the same repo (i.e. the user ran `argus launch`).
    // If so, route JSONL output to the PTY session instead of creating a duplicate.
    if (!existing) {
      const ptySession = this.activePtySessionForRepo(repo.id);
      if (ptySession) {
        const updated = { ...ptySession, status: 'active' as const, lastActivityAt: now };
        upsertSession(updated);
        broadcast({ type: 'session.updated', timestamp: now, data: updated as unknown as Record<string, unknown> });
        await this.watchJsonlFile(session_id, repo.path, ptySession.id);
        return;
      }
    }

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

    session.status = 'active';
    session.lastActivityAt = now;

    upsertSession(session);
    broadcast({ type: 'session.updated', timestamp: now, data: session as unknown as Record<string, unknown> });

    await this.watchJsonlFile(session_id, repo.path);
  }

  private async activateFoundSession(sessionId: string, repo: Repository, claudePid: number): Promise<void> {
    const now = new Date().toISOString();
    const existingSession = getSession(sessionId);

    if (!existingSession) {
      // Check if argus launched this session via PTY — route output there instead.
      const ptySession = this.activePtySessionForRepo(repo.id);
      if (ptySession) {
        await this.watchJsonlFile(sessionId, repo.path, ptySession.id);
        return;
      }
    }

    if (existingSession?.status === 'active') {
      await this.watchJsonlFile(sessionId, repo.path);
      return;
    }
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
    await this.watchJsonlFile(sessionId, repo.path);
  }

  // claudeSessionId: Claude's own session ID — used to locate the .jsonl file.
  // storeAsId: which session ID to store output under (defaults to claudeSessionId).
  //   Pass the PTY session ID here to route output to the live PTY session instead
  //   of creating a separate detected session.
  private async watchJsonlFile(claudeSessionId: string, repoPath: string, storeAsId?: string): Promise<void> {
    const targetId = storeAsId ?? claudeSessionId;
    if (this.watchers.has(targetId)) return;
    const jsonlPath = join(
      homedir(), '.claude', 'projects',
      this.claudeProjectDirName(repoPath),
      `${claudeSessionId}.jsonl`,
    );
    if (!existsSync(jsonlPath)) return;

    this.filePositions.set(targetId, 0);
    this.sequenceCounters.set(targetId, 0);
    await this.readNewJsonlLines(targetId, jsonlPath);

    const watcher = chokidar.watch(jsonlPath, { persistent: false, usePolling: false });
    watcher.on('change', () => { this.readNewJsonlLines(targetId, jsonlPath).catch(() => {}); });
    this.watchers.set(targetId, watcher);
  }

  private async readNewJsonlLines(sessionId: string, filePath: string): Promise<void> {
    try {
      const { size: currentSize } = await fsStat(filePath);
      const lastPos = this.filePositions.get(sessionId) ?? 0;
      if (currentSize <= lastPos) return;

      const fh = await fsOpen(filePath, 'r');
      const buffer = Buffer.alloc(currentSize - lastPos);
      await fh.read(buffer, 0, buffer.length, lastPos);
      await fh.close();
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

      // Update summary with the most recent user prompt in this batch
      const lastUserMsg = [...outputs].reverse().find(o => o.role === 'user' && o.type === 'message');
      if (lastUserMsg?.content) {
        const existing = getSession(sessionId);
        if (existing) {
          const summary = lastUserMsg.content.slice(0, 120);
          if (existing.summary !== summary) {
            const updated = { ...existing, summary };
            upsertSession(updated);
            broadcast({ type: 'session.updated', timestamp: new Date().toISOString(), data: updated as unknown as Record<string, unknown> });
          }
        }
      }
    } catch { /* ignore */ }
  }

  closeSessionWatcher(sessionId: string): void {
    this.watchers.get(sessionId)?.close().catch(() => { /* ignore */ });
    this.watchers.delete(sessionId);
    this.filePositions.delete(sessionId);
    this.sequenceCounters.delete(sessionId);
  }

  stopWatchers(): void {
    for (const watcher of this.watchers.values()) {
      watcher.close().catch(() => { /* ignore */ });
    }
    this.watchers.clear();
    this.filePositions.clear();
    this.sequenceCounters.clear();
  }
}