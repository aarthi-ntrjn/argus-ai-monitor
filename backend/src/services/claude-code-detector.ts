import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import * as logger from '../utils/logger.js';
import { join, dirname, normalize } from 'path';
import { homedir } from 'os';
import { getSession, upsertSession, updateSessionStatus, getRepositoryByPath } from '../db/database.js';
import { ptyRegistry } from './pty-registry.js';
import { ClaudeSessionRegistry } from './claude-session-registry.js';
import { ClaudeJsonlWatcher } from './claude-jsonl-watcher.js';
import { broadcast } from '../api/ws/event-dispatcher.js';
import { detectYoloModeFromPids, isPidRunning, isExpectedProcess } from './process-utils.js';
import type { Session, Repository, PendingChoice } from '../models/index.js';

const CLAUDE_SETTINGS_PATH = join(homedir(), '.claude', 'settings.json');
const HOOK_COMMAND = 'curl -sf -X POST http://127.0.0.1:7411/hooks/claude -H "Content-Type: application/json" -d @- 2>/dev/null || true';
const HOOK_EVENTS: Array<{ event: string; matcher: string }> = [
  { event: 'SessionStart', matcher: '' },
  { event: 'SessionEnd', matcher: '' },
  { event: 'PreToolUse', matcher: 'AskUserQuestion' },
  { event: 'PostToolUse', matcher: 'AskUserQuestion' },
];

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
  private jsonlWatcher = new ClaudeJsonlWatcher();
  private pendingChoices = new Map<string, PendingChoice>();
  private sessionCreatedCallback?: (session: Session) => void;

  setSessionCreatedCallback(cb: (session: Session) => void): void {
    this.sessionCreatedCallback = cb;
  }

  getPendingChoice(sessionId: string): PendingChoice | null {
    return this.pendingChoices.get(sessionId) ?? null;
  }

  injectHooks(): void {
    try {
      mkdirSync(dirname(CLAUDE_SETTINGS_PATH), { recursive: true });
      let settings: ClaudeSettings = {};
      if (existsSync(CLAUDE_SETTINGS_PATH)) {
        settings = JSON.parse(readFileSync(CLAUDE_SETTINGS_PATH, 'utf-8'));
      }
      if (!settings.hooks) settings.hooks = {};
      let changed = false;

      // Remove Argus hook entries whose (event, matcher) pair is no longer in HOOK_EVENTS.
      // Also delete any malformed keys (e.g. '[object Object]' from object-as-key coercion).
      for (const event of Object.keys(settings.hooks)) {
        if (!/^\w+$/.test(event)) {
          delete settings.hooks[event];
          changed = true;
          continue;
        }
        const before = settings.hooks[event];
        const after = before.filter((entry) => {
          const isArgusEntry = entry.hooks?.some((h) => h.command === HOOK_COMMAND);
          if (!isArgusEntry) return true;
          return HOOK_EVENTS.some((he) => he.event === event && he.matcher === entry.matcher);
        });
        if (after.length !== before.length) {
          settings.hooks[event] = after;
          changed = true;
        }
      }

      for (const { event, matcher } of HOOK_EVENTS) {
        if (!this.hasHook(settings, event, matcher)) {
          if (!settings.hooks[event]) settings.hooks[event] = [];
          settings.hooks[event].push({ matcher, hooks: [{ type: 'command', command: HOOK_COMMAND }] });
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
      for (const { event } of HOOK_EVENTS) {
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

  private hasHook(settings: ClaudeSettings, event: string, matcher: string): boolean {
    const eventHooks = settings.hooks?.[event];
    if (!eventHooks) return false;
    return eventHooks.some((entry) =>
      entry.matcher === matcher && entry.hooks?.some((h) => h.command === HOOK_COMMAND)
    );
  }

  // Claude names project dirs by replacing path separators (:, \, /) with hyphens.
  static projectDirName(repoPath: string): string {
    return repoPath.replace(/[:\\/]/g, '-');
  }

  async scanExistingSessions(): Promise<void> {
    const registry = new ClaudeSessionRegistry();
    const registryEntries = registry.scanEntries();

    for (const entry of registryEntries) {
      // Guard 1: process is running
      if (!isPidRunning(entry.pid)) continue;

      // Guard 2: session not already ended in DB
      // Guard 3 (only when guard 2 fails): verify process name to catch PID reuse
      const existingSession = getSession(entry.sessionId);
      if (existingSession?.status === 'ended') {
        if (!isExpectedProcess(entry.pid, 'claude-code')) {
          logger.info(`[ClaudeDetector] PID reuse detected: session ${entry.sessionId} is ended but pid ${entry.pid} is running with wrong name — skipping`);
          continue;
        }
      }

      const normalizedCwd = normalize(entry.cwd.trimEnd().replace(/[/\\]+$/, ''));
      const repo = getRepositoryByPath(normalizedCwd);
      if (!repo) { logger.warn(`[ClaudeDetector] no repo for cwd="${normalizedCwd}" sessionId=${entry.sessionId} — session ignored`); continue; }

      await this.activateFoundSession(entry.sessionId, repo, null);
    }

  }

  async handleHookPayload(payload: HookPayload): Promise<void> {
    const { hook_event_name, session_id, cwd } = payload;
    if (!session_id) return;

    const normalizedCwd = cwd ? normalize(cwd.trimEnd().replace(/[/\\]+$/, '')) : null;
    const repo = normalizedCwd ? getRepositoryByPath(normalizedCwd) : null;
    if (!repo) { logger.warn(`[ClaudeDetector] no repo for cwd="${normalizedCwd ?? 'none'}" sessionId=${session_id} hook=${hook_event_name} — hook ignored`); return; }

    const existing = getSession(session_id);
    const now = new Date().toISOString();

    if (hook_event_name === 'SessionEnd') {
      return this.handleSessionEnd(existing, session_id, now);
    }
    if (hook_event_name === 'PreToolUse' && payload.tool_name === 'AskUserQuestion') {
      return this.handlePreAskQuestion(session_id, existing, payload, now);
    }
    if (hook_event_name === 'PostToolUse' && payload.tool_name === 'AskUserQuestion') {
      return this.handlePostAskQuestion(session_id, existing, now);
    }

    if (!existing) {
      const claimed = normalizedCwd ? ptyRegistry.claimForSession(session_id, normalizedCwd, 'claude-code') : null;
      if (claimed) {
        return this.createPtySession(session_id, repo, claimed, now);
      }
    }

    this.upsertAndBroadcastSession(session_id, repo, existing, now);
    await this.jsonlWatcher.watchFile(session_id, repo.path);
  }

  private handleSessionEnd(existing: Session | null | undefined, sessionId: string, now: string): void {
    if (!existing) return;
    updateSessionStatus(sessionId, 'ended', now);
    this.jsonlWatcher.closeWatcher(sessionId);
    broadcast({ type: 'session.ended', timestamp: now, data: { ...existing, status: 'ended', endedAt: now } as unknown as Record<string, unknown> });
  }

  private handlePreAskQuestion(sessionId: string, existing: Session | null | undefined, payload: HookPayload, now: string): void {
    if (!existing) return;
    const toolInput = payload.tool_input ?? {};
    const firstQ = Array.isArray(toolInput.questions) && toolInput.questions.length > 0
      ? toolInput.questions[0] as Record<string, unknown>
      : null;
    const question = typeof toolInput.question === 'string'
      ? toolInput.question
      : typeof firstQ?.question === 'string' ? firstQ.question : '';
    const rawOptions: unknown[] = Array.isArray(toolInput.choices)
      ? toolInput.choices
      : Array.isArray(firstQ?.options) ? firstQ.options as unknown[] : [];
    const choices = rawOptions.map((c) => {
      if (typeof c === 'string') return c;
      if (c && typeof c === 'object' && typeof (c as Record<string, unknown>).label === 'string') {
        return (c as Record<string, unknown>).label as string;
      }
      return null;
    }).filter((c): c is string => c !== null);
    this.pendingChoices.set(sessionId, { question, choices });
    broadcast({ type: 'session.pending_choice', timestamp: now, data: { sessionId, question, choices } });
  }

  private handlePostAskQuestion(sessionId: string, existing: Session | null | undefined, now: string): void {
    if (!existing) return;
    this.pendingChoices.delete(sessionId);
    broadcast({ type: 'session.pending_choice.resolved', timestamp: now, data: { sessionId } });
  }

  private async createPtySession(sessionId: string, repo: Repository, claimed: { pid: number | null; hostPid: number; ptyLaunchId: string }, now: string): Promise<void> {
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
      ptyLaunchId: claimed.ptyLaunchId,
    };
    upsertSession(session);
    this.sessionCreatedCallback?.(session);
    await this.jsonlWatcher.watchFile(sessionId, repo.path);
  }

  private upsertAndBroadcastSession(sessionId: string, repo: Repository, existing: Session | null | undefined, now: string): void {
    const session: Session = existing ?? {
      id: sessionId,
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
    if (existing) {
      broadcast({ type: 'session.updated', timestamp: now, data: session as unknown as Record<string, unknown> });
    } else {
      this.sessionCreatedCallback?.(session);
    }
  }

  private async activateFoundSession(sessionId: string, repo: Repository, claudePid: number | null): Promise<void> {
    const now = new Date().toISOString();
    const existingSession = getSession(sessionId);

    if (!existingSession) {
      const claimed = ptyRegistry.claimForSession(sessionId, repo.path, 'claude-code');
      if (claimed) {
        logger.info(`[ClaudeDetector] session activated via PTY claim sessionId=${sessionId} hostPid=${claimed.hostPid} pid=${claimed.pid}`);
        await this.createPtySession(sessionId, repo, claimed, now);
        return;
      }
    }

    if (existingSession?.status === 'active') {
      await this.jsonlWatcher.watchFile(sessionId, repo.path);
      return;
    }

    // Don't re-activate a PTY session whose launcher has already disconnected.
    // When the terminal closes, the WS close handler calls ptyRegistry.unregister(),
    // so has() being false means the launcher is gone and the session should stay ended.
    if (existingSession?.launchMode === 'pty' && !ptyRegistry.has(sessionId)) {
      logger.info(`[ClaudeDetector] skipping re-activation — PTY launcher gone sessionId=${sessionId}`);
      return;
    }
    this.jsonlWatcher.closeWatcher(sessionId);
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
    const isNewSession = !existingSession;
    const activated = { ...base, status: 'active' as const, endedAt: null as null, lastActivityAt: now, pid: claudePid };
    logger.info(`[ClaudeDetector] session activated sessionId=${sessionId} pid=${claudePid}`);
    upsertSession(activated);
    if (isNewSession) {
      this.sessionCreatedCallback?.(activated);
    }
    await this.jsonlWatcher.watchFile(sessionId, repo.path);
  }

  closeSessionWatcher(sessionId: string): void {
    this.jsonlWatcher.closeWatcher(sessionId);
  }

  stopWatchers(): void {
    this.jsonlWatcher.stopAll();
  }
}

