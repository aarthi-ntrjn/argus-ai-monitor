import { insertOutput as dbInsertOutput, getOutputForSession as dbGetOutput } from '../db/database.js';
import { broadcast } from '../api/ws/event-dispatcher.js';
import { getDb } from '../db/database.js';
import type { SessionOutput } from '../models/index.js';

export interface OutputPage {
  items: SessionOutput[];
  nextBefore: string | null;
  total: number;
}

export class OutputStore {
  insertOutput(sessionId: string, outputs: SessionOutput[]): void {
    for (const output of outputs) {
      dbInsertOutput(output);
      broadcast({
        type: 'session.output',
        timestamp: new Date().toISOString(),
        data: { sessionId, output: output as unknown as Record<string, unknown> },
      });
    }
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
    const rows = db
      .prepare('SELECT id, length(content) as size FROM session_output WHERE session_id = ? ORDER BY sequence_number ASC')
      .all(sessionId) as Array<{ id: string; size: number }>;

    let totalSize = rows.reduce((sum, r) => sum + r.size, 0);
    const toDelete: string[] = [];

    for (const row of rows) {
      if (totalSize <= maxBytes) break;
      toDelete.push(row.id);
      totalSize -= row.size;
    }

    if (toDelete.length > 0) {
      const placeholders = toDelete.map(() => '?').join(',');
      db.prepare(`DELETE FROM session_output WHERE id IN (${placeholders})`).run(...toDelete);
    }
  }
}
