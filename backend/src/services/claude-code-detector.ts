import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { open as fsOpen, stat as fsStat } from 'fs/promises';
import { join, dirname, normalize } from 'path';
import { homedir } from 'os';

import chokidar, { type FSWatcher } from 'chokidar';
import { getSession, upsertSession, updateSessionStatus, getRepositories, getRepositoryByPath } from '../db/database.js';
import { ptyRegistry } from './pty-registry.js';
import { ClaudeSessionRegistry } from './claude-session-registry.js';
import { OutputStore } from './output-store.js';
import { broadcast } from '../api/ws/event-dispatcher.js';
import { parseClaudeJsonlLine, parseModel } from './claude-code-jsonl-parser.js';
import { detectYoloModeFromPids } from './process-utils.js';
import type { Session, Repository } from '../models/index.js';

const CLAUDE_SETTINGS_PATH = join(homedir(), '.claude', 'settings.json');
const HOOK_COMMAND = 'curl -sf -X POST http://127.0.0.1:7411/hooks/claude -H "Content-Type: application/json" -d @- 2>/dev/null || true';
const HOOK_EVENTS = ['SessionStart', 'SessionEnd'];

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

      // Remove Argus hooks from events no longer in HOOK_EVENTS (e.g. PreToolUse, PostToolUse, Stop)
      for (const event of Object.keys(settings.hooks)) {
        if (!HOOK_EVENTS.includes(event)) {
          const before = settings.hooks[event];
          const after = before.filter((e) => !e.hooks?.some((h) => h.command === HOOK_COMMAND));
          if (after.length !== before.length) {
            settings.hooks[event] = after;
            changed = true;
          }
        }
      }

      // Add hooks for current HOOK_EVENTS
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

    // Read the session registry to know which sessions are actually alive.
    // Only JSONL sessions with a matching registry entry (or already active
    // in the DB) should be activated. Sessions without a registry entry
    // have already exited.
    const registry = new ClaudeSessionRegistry();
    const registryEntries = registry.scanEntries();
    const liveSessionIds = new Set(registryEntries.map(e => e.sessionId));

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

        if (jsonlEntries.length === 0) continue;

        for (const entry of jsonlEntries.slice(0, 5)) {
          // Only activate sessions that have a live registry entry (process running)
          // or are already active in the DB (e.g., PTY-launched sessions)
          const existing = getSession(entry.id);
          if (existing?.status === 'active') {
            // Already active, just ensure watcher is running
            await this.activateFoundSession(entry.id, repo, null);
          } else if (liveSessionIds.has(entry.id)) {
            // Registry says this session is alive
            await this.activateFoundSession(entry.id, repo, null);
          }
          // else: no registry entry = process has exited, skip
        }
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

    // SessionEnd means the session is ending. Mark it ended immediately
    // instead of waiting for the next 5s poll cycle.
    if (hook_event_name === 'SessionEnd') {
      if (existing) {
        updateSessionStatus(session_id, 'ended', now);
        this.closeSessionWatcher(session_id);
        broadcast({ type: 'session.ended', timestamp: now, data: { ...existing, status: 'ended', endedAt: now } as unknown as Record<string, unknown> });
      }
      return;
    }

    // If this is the first hook for this claude session, check whether argus launch
    // is waiting for it. If so, claim the PTY connection and create the session as
    // launchMode='pty' — no separate powershell session, just the real claude session.
    if (!existing) {
      const claimed = normalizedCwd ? ptyRegistry.claimForSession(session_id, normalizedCwd) : null;
      if (claimed) {
        const yoloMode = detectYoloModeFromPids(claimed.pid, claimed.hostPid, 'claude-code');
        const session: Session = {
          id: session_id,
          repositoryId: repo.id,
          type: 'claude-code',
          launchMode: 'pty',
          pid: claimed.pid,
          hostPid: claimed.hostPid,
          pidSource: 'pty_registry',
          status: 'active',
          startedAt: now,
          endedAt: null,
          lastActivityAt: now,
          summary: null,
          expiresAt: null,
          model: null,
          reconciled: true,
          yoloMode,
        };
        upsertSession(session);
        broadcast({ type: 'session.created', timestamp: now, data: session as unknown as Record<string, unknown> });
        await this.watchJsonlFile(session_id, repo.path);
        return;
      }
    }

    const session: Session = existing ?? {
      id: session_id,
      repositoryId: repo.id,
      type: 'claude-code',
      launchMode: null,
      pid: null,
      hostPid: null,
      pidSource: null,
      status: 'active',
      startedAt: now,
      endedAt: null,
      lastActivityAt: now,
      summary: null,
      expiresAt: null,
      model: null,
      reconciled: true,
      yoloMode: null,
    };

    session.status = 'active';
    session.lastActivityAt = now;

    upsertSession(session);
    broadcast({
      type: existing ? 'session.updated' : 'session.created',
      timestamp: now,
      data: session as unknown as Record<string, unknown>,
    });

    await this.watchJsonlFile(session_id, repo.path);
  }

  private async activateFoundSession(sessionId: string, repo: Repository, claudePid: number | null): Promise<void> {
    const now = new Date().toISOString();
    const existingSession = getSession(sessionId);

    if (!existingSession) {
      // Check whether argus launch is pending for this repo — claim it if so.
      const claimed = ptyRegistry.claimForSession(sessionId, repo.path);
      if (claimed) {
        console.log(`[ClaudeDetector] session activated via PTY claim sessionId=${sessionId} hostPid=${claimed.hostPid} pid=${claimed.pid}`);
        const yoloMode = detectYoloModeFromPids(claimed.pid, claimed.hostPid, 'claude-code');
        const session: Session = {
          id: sessionId,
          repositoryId: repo.id,
          type: 'claude-code',
          launchMode: 'pty',
          pid: claimed.pid,
          hostPid: claimed.hostPid,
          pidSource: 'pty_registry',
          status: 'active',
          startedAt: now,
          endedAt: null,
          lastActivityAt: now,
          summary: null,
          expiresAt: null,
          model: null,
          reconciled: true,
          yoloMode,
        };
        upsertSession(session);
        await this.watchJsonlFile(sessionId, repo.path);
        return;
      }
    }

    if (existingSession?.status === 'active') {
      await this.watchJsonlFile(sessionId, repo.path);
      return;
    }
    // Close any stale watcher from before the session was deleted, so
    // watchJsonlFile re-reads the full JSONL from the beginning.
    this.closeSessionWatcher(sessionId);
    const base: Session = existingSession ?? {
      id: sessionId,
      repositoryId: repo.id,
      type: 'claude-code',
      launchMode: null,
      pid: claudePid,
      hostPid: null,
      pidSource: null,
      status: 'active',
      startedAt: now,
      endedAt: null,
      lastActivityAt: now,
      summary: null,
      expiresAt: null,
      model: null,
      reconciled: true,
      yoloMode: claudePid ? detectYoloModeFromPids(claudePid, null, 'claude-code') : null,
    };
    console.log(`[ClaudeDetector] session activated sessionId=${sessionId} pid=${claudePid}`);
    upsertSession({ ...base, status: 'active', endedAt: null, lastActivityAt: now, pid: claudePid });
    await this.watchJsonlFile(sessionId, repo.path);
  }

  private async watchJsonlFile(sessionId: string, repoPath: string): Promise<void> {
    if (this.watchers.has(sessionId)) return;
    const jsonlPath = join(
      homedir(), '.claude', 'projects',
      this.claudeProjectDirName(repoPath),
      `${sessionId}.jsonl`,
    );
    if (!existsSync(jsonlPath)) return;

    this.filePositions.set(sessionId, 0);
    this.sequenceCounters.set(sessionId, 0);
    await this.readNewJsonlLines(sessionId, jsonlPath);

    const watcher = chokidar.watch(jsonlPath, { persistent: false, usePolling: false });
    watcher.on('change', () => { this.readNewJsonlLines(sessionId, jsonlPath).catch(() => {}); });
    this.watchers.set(sessionId, watcher);
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
              console.log(`[ClaudeDetector] model detected sessionId=${sessionId} model=${model}`);
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

        // Update lastActivityAt from the JSONL watcher — replaces PreToolUse/PostToolUse hooks
        const now = new Date().toISOString();
        const active = getSession(sessionId);
        if (active) {
          const updated = { ...active, lastActivityAt: now };
          upsertSession(updated);
          broadcast({ type: 'session.updated', timestamp: now, data: updated as unknown as Record<string, unknown> });
        }
      }

      // Update summary with the most recent user prompt in this batch
      const lastUserMsg = [...outputs].reverse().find(o => o.role === 'user' && o.type === 'message');
      if (lastUserMsg?.content) {
        const existing = getSession(sessionId);
        if (existing) {
          const summary = lastUserMsg.content.slice(0, 120);
          if (existing.summary !== summary) {
            console.log(`[ClaudeDetector] summary updated sessionId=${sessionId}`);
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