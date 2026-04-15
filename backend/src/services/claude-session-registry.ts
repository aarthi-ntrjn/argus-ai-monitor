import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { ClaudeSessionRegistryEntry } from '../models/index.js';

const SESSIONS_DIR = join(homedir(), '.claude', 'sessions');

export class ClaudeSessionRegistry {
  private sessionsDir: string;

  constructor(sessionsDir?: string) {
    this.sessionsDir = sessionsDir ?? SESSIONS_DIR;
  }

  scanEntries(): ClaudeSessionRegistryEntry[] {
    if (!existsSync(this.sessionsDir)) return [];

    const files = readdirSync(this.sessionsDir).filter(f => f.endsWith('.json'));
    const entries: ClaudeSessionRegistryEntry[] = [];

    for (const file of files) {
      try {
        const raw = readFileSync(join(this.sessionsDir, file), 'utf-8');
        const data = JSON.parse(raw);
        if (typeof data.pid !== 'number' || typeof data.sessionId !== 'string' || typeof data.cwd !== 'string') {
          continue;
        }
        entries.push({
          pid: data.pid,
          sessionId: data.sessionId,
          cwd: data.cwd,
          startedAt: data.startedAt ?? 0,
          kind: data.kind ?? '',
          entrypoint: data.entrypoint ?? '',
        });
      } catch {
        // Skip malformed files
      }
    }

    return entries;
  }
}

