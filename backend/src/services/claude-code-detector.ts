import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import psList from 'ps-list';
import { getSession, upsertSession, getRepositoryByPath, getSessions, updateSessionStatus } from '../db/database.js';
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

export class ClaudeCodeDetector {
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

  private hasHook(settings: ClaudeSettings, event: string): boolean {
    const eventHooks = settings.hooks?.[event];
    if (!eventHooks) return false;
    return eventHooks.some((entry) =>
      entry.hooks?.some((h) => h.command === HOOK_COMMAND)
    );
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

    // On Windows psList does not return process cwd, so we cannot match by path.
    // Instead check whether any Claude process is running at all.
    const claudeRunning = processes.some(p =>
      p.name.toLowerCase().includes('claude') || p.cmd?.toLowerCase().includes('claude')
    );
    if (!claudeRunning) return;

    try {
      const projectDirs = readdirSync(projectsDir, { withFileTypes: true })
        .filter(e => e.isDirectory());

      for (const dir of projectDirs) {
        let decodedPath: string;
        try {
          decodedPath = decodeURIComponent(dir.name.replace(/-/g, '/'));
        } catch {
          continue;
        }

        const repo = getRepositoryByPath(decodedPath);
        if (!repo) continue;

        // Already have an active session — nothing to do
        const activeSessions = getSessions({ repositoryId: repo.id, status: 'active', type: 'claude-code' });
        if (activeSessions.length > 0) continue;

        const now = new Date().toISOString();

        // Re-activate the most recently ended session for this repo, if any
        const allSessions = getSessions({ repositoryId: repo.id, type: 'claude-code' });
        const mostRecentEnded = allSessions
          .filter(s => s.status === 'ended')
          .sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt))[0];

        if (mostRecentEnded) {
          updateSessionStatus(mostRecentEnded.id, 'active', null);
        } else {
          // No prior session — create a startup placeholder
          upsertSession({
            id: `claude-startup-${repo.id}-${Date.now()}`,
            repositoryId: repo.id,
            type: 'claude-code',
            pid: null,
            status: 'active',
            startedAt: now,
            endedAt: null,
            lastActivityAt: now,
            summary: null,
            expiresAt: null,
          });
        }
      }
    } catch { /* ignore */ }
  }

  async handleHookPayload(payload: HookPayload): Promise<void> {
    const { hook_event_name, session_id, cwd } = payload;
    if (!session_id) return;

    const repo = cwd ? getRepositoryByPath(cwd) : null;
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
    };

    if (hook_event_name === 'Stop') {
      session.status = 'ended';
      session.endedAt = now;
    } else {
      session.status = 'active';
      session.lastActivityAt = now;
    }

    upsertSession(session);
  }
}