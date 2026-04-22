import { EventEmitter } from 'events';
import { insertOutput as dbInsertOutput, getOutputForSession as dbGetOutput } from '../db/database.js';
import { broadcast } from '../api/ws/event-dispatcher.js';
import { getDb } from '../db/database.js';
import type { SessionOutput } from '../models/index.js';

export const outputEvents = new EventEmitter();

export interface OutputPage {
  items: SessionOutput[];
  nextBefore: string | null;
  total: number;
}

type OutputListener = (sessionId: string, outputs: SessionOutput[]) => void;

export class OutputStore {
  private readonly listeners = new Set<OutputListener>();

  addOutputListener(fn: OutputListener): void {
    this.listeners.add(fn);
  }

  removeOutputListener(fn: OutputListener): void {
    this.listeners.delete(fn);
  }

  /** Returns true if at least one output was newly inserted (not a duplicate). */
  insertOutput(sessionId: string, outputs: SessionOutput[], options?: { skipNotifications?: boolean }): boolean {
    const inserted = outputs.filter(o => dbInsertOutput(o));
    if (inserted.length > 0 && !options?.skipNotifications) {
      broadcast({
        type: 'session.output.batch',
        timestamp: new Date().toISOString(),
        data: { sessionId, outputs: inserted as unknown as Record<string, unknown>[] },
      });
      outputEvents.emit('session.output.batch', sessionId, outputs);
      for (const fn of this.listeners) fn(sessionId, inserted);
    }
    return inserted.length > 0;
  }

  getOutputPage(sessionId: string, limit: number, before?: string): OutputPage {
    const items = dbGetOutput(sessionId, limit, before);
    const totalRow = getDb()
      .prepare('SELECT COUNT(*) as count FROM session_output WHERE session_id = ?')
      .get(sessionId) as { count: number };
    const total = totalRow?.count ?? 0;
    const nextBefore = items.length > 0 ? String(items[0].sequenceNumber) : null;
    return { items, nextBefore, total };
  }

  pruneIfNeeded(sessionId: string, maxMb: number): void {
    const maxBytes = maxMb * 1024 * 1024;
    const db = getDb();
    const totalRow = db
      .prepare('SELECT SUM(length(content)) as total FROM session_output WHERE session_id = ?')
      .get(sessionId) as { total: number | null };
    const total = totalRow?.total ?? 0;
    if (total <= maxBytes) return;

    const rows = db
      .prepare('SELECT id, length(content) as size FROM session_output WHERE session_id = ? ORDER BY sequence_number ASC')
      .all(sessionId) as Array<{ id: string; size: number }>;

    let remaining = total;
    const toDelete: string[] = [];

    for (const row of rows) {
      if (remaining <= maxBytes) break;
      toDelete.push(row.id);
      remaining -= row.size;
    }

    if (toDelete.length > 0) {
      const placeholders = toDelete.map(() => '?').join(',');
      db.prepare(`DELETE FROM session_output WHERE id IN (${placeholders})`).run(...toDelete);
    }
  }
}

export const outputStore = new OutputStore();
