import { getDb } from '../db/database.js';
import { OutputStore } from './output-store.js';
import { loadConfig } from '../config/config-loader.js';

const outputStore = new OutputStore();

function pruneExpiredSessions(): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare("DELETE FROM sessions WHERE expires_at IS NOT NULL AND expires_at < ?").run(now);
}

function pruneAllOutputs(): void {
  const config = loadConfig();
  const maxMb = config.outputRetentionMbPerSession;
  const db = getDb();
  const sessions = db.prepare('SELECT id FROM sessions').all() as Array<{ id: string }>;
  for (const { id } of sessions) {
    outputStore.pruneIfNeeded(id, maxMb);
  }
}

export function startPruningJob(intervalMs = 60000): ReturnType<typeof setInterval> {
  return setInterval(() => {
    try { pruneExpiredSessions(); } catch { /* ignore */ }
    try { pruneAllOutputs(); } catch { /* ignore */ }
  }, intervalMs);
}
