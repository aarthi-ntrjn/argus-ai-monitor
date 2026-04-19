import { join } from 'path';
import { homedir } from 'os';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { load as yamlLoad } from 'js-yaml';
import type { SessionType } from '../models/index.js';

export const CLAUDE_SESSIONS_DIR = join(homedir(), '.claude', 'sessions');
export const COPILOT_SESSION_STATE_DIR = join(homedir(), '.copilot', 'session-state');

interface Dirs {
  claude?: string;
  copilot?: string;
}

// Scans on-disk session files to find the session ID that owns the given tool PID.
// For claude-code: reads ~/.claude/sessions/*.json (each file has { pid, sessionId }).
// For copilot-cli: scans ~/.copilot/session-state/ for a dir whose inuse.<pid>.lock matches,
// then reads workspace.yaml for the session id.
// Returns null if no match is found (e.g. file not yet written — caller should retry later).
export function resolveSessionIdByPid(pid: number, sessionType: SessionType, dirs?: Dirs): string | null {
  if (sessionType === 'claude-code') {
    return resolveClaudeSessionId(pid, dirs?.claude ?? CLAUDE_SESSIONS_DIR);
  }
  if (sessionType === 'copilot-cli') {
    return resolveCopilotSessionId(pid, dirs?.copilot ?? COPILOT_SESSION_STATE_DIR);
  }
  return null;
}

function resolveClaudeSessionId(pid: number, sessionsDir: string): string | null {
  if (!existsSync(sessionsDir)) return null;
  try {
    for (const file of readdirSync(sessionsDir)) {
      if (!file.endsWith('.json')) continue;
      try {
        const data = JSON.parse(readFileSync(join(sessionsDir, file), 'utf-8'));
        if (data.pid === pid && typeof data.sessionId === 'string') return data.sessionId as string;
      } catch { /* skip malformed */ }
    }
  } catch { /* sessionsDir unreadable */ }
  return null;
}

function resolveCopilotSessionId(pid: number, sessionStateDir: string): string | null {
  if (!existsSync(sessionStateDir)) return null;
  try {
    for (const entry of readdirSync(sessionStateDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const dirPath = join(sessionStateDir, entry.name);
      try {
        const files = readdirSync(dirPath);
        if (!files.includes(`inuse.${pid}.lock`)) continue;
        const workspaceFile = join(dirPath, 'workspace.yaml');
        if (!existsSync(workspaceFile)) continue;
        const workspace = yamlLoad(readFileSync(workspaceFile, 'utf-8')) as { id?: string };
        if (workspace.id) return workspace.id;
      } catch { /* skip */ }
    }
  } catch { /* sessionStateDir unreadable */ }
  return null;
}
