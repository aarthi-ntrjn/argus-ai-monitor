import Database from 'better-sqlite3';
import { join, dirname, normalize } from 'path';
import { homedir } from 'os';
import { mkdirSync } from 'fs';
import { SCHEMA_SQL } from './schema.js';
import type { Repository, Session, SessionOutput, ControlAction, TodoItem } from '../models/index.js';

const DB_PATH = process.env.ARGUS_DB_PATH ?? join(homedir(), '.argus', 'argus.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    mkdirSync(dirname(DB_PATH), { recursive: true });
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('foreign_keys = ON');
    db.pragma('cache_size = -64000');
    db.pragma('temp_store = MEMORY');
    db.pragma('mmap_size = 268435456');
    db.pragma('busy_timeout = 5000');
    db.exec(SCHEMA_SQL);
    // Runtime migrations for existing databases (SQLite has no ADD COLUMN IF NOT EXISTS)
    const repoCols = (db.pragma('table_info(repositories)') as Array<{ name: string }>).map(c => c.name);
    if (!repoCols.includes('branch')) db.exec('ALTER TABLE repositories ADD COLUMN branch TEXT');
    const sessionCols = (db.pragma('table_info(sessions)') as Array<{ name: string }>).map(c => c.name);
    if (!sessionCols.includes('model')) db.exec('ALTER TABLE sessions ADD COLUMN model TEXT');
    const outputCols = (db.pragma('table_info(session_output)') as Array<{ name: string }>).map(c => c.name);
    if (!outputCols.includes('role')) db.exec('ALTER TABLE session_output ADD COLUMN role TEXT');
    if (!outputCols.includes('tool_call_id')) db.exec('ALTER TABLE session_output ADD COLUMN tool_call_id TEXT');
    if (!sessionCols.includes('launch_mode')) db.exec("ALTER TABLE sessions ADD COLUMN launch_mode TEXT CHECK(launch_mode IN ('pty','detected'))");
    if (!sessionCols.includes('pid_source')) {
      db.exec('ALTER TABLE sessions ADD COLUMN pid_source TEXT');
      db.exec("UPDATE sessions SET pid_source = 'pty_registry' WHERE launch_mode = 'pty' AND pid IS NOT NULL");
      db.exec("UPDATE sessions SET pid_source = 'lockfile' WHERE type = 'copilot-cli' AND pid IS NOT NULL AND launch_mode IS NULL");
    }
    if (!sessionCols.includes('reconciled')) {
      db.exec('ALTER TABLE sessions ADD COLUMN reconciled INTEGER NOT NULL DEFAULT 1');
    }
    if (!sessionCols.includes('host_pid')) {
      db.exec('ALTER TABLE sessions ADD COLUMN host_pid INTEGER');
    }
    const yoloColInfo = (db.pragma('table_info(sessions)') as Array<{ name: string; notnull: number }>)
      .find(c => c.name === 'yolo_mode');
    if (!yoloColInfo) {
      db.exec('ALTER TABLE sessions ADD COLUMN yolo_mode INTEGER DEFAULT NULL');
    } else if (yoloColInfo.notnull === 1) {
      // Migrate from NOT NULL DEFAULT 0 to nullable — preserve existing true values
      db.exec('ALTER TABLE sessions ADD COLUMN yolo_mode_new INTEGER DEFAULT NULL');
      db.exec('UPDATE sessions SET yolo_mode_new = 1 WHERE yolo_mode = 1');
      db.exec('ALTER TABLE sessions DROP COLUMN yolo_mode');
      db.exec('ALTER TABLE sessions RENAME COLUMN yolo_mode_new TO yolo_mode');
    }
  }
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

export function getRepositories(): Repository[] {
  return getDb().prepare(
    'SELECT id, path, name, source, added_at as addedAt, last_scanned_at as lastScannedAt, branch FROM repositories ORDER BY added_at DESC'
  ).all() as Repository[];
}

export function getRepository(id: string): Repository | undefined {
  return getDb().prepare(
    'SELECT id, path, name, source, added_at as addedAt, last_scanned_at as lastScannedAt, branch FROM repositories WHERE id = ?'
  ).get(id) as Repository | undefined;
}

export function getRepositoryByPath(path: string): Repository | undefined {
  return getDb().prepare(
    'SELECT id, path, name, source, added_at as addedAt, last_scanned_at as lastScannedAt, branch FROM repositories WHERE LOWER(path) = LOWER(?)'
  ).get(path) as Repository | undefined;
}

export function insertRepository(repo: Repository): void {
  getDb().prepare(
    'INSERT INTO repositories (id, path, name, source, added_at, last_scanned_at, branch) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(repo.id, normalize(repo.path), repo.name, repo.source, repo.addedAt, repo.lastScannedAt, repo.branch ?? null);
}

export function updateRepositoryBranch(id: string, branch: string | null): void {
  getDb().prepare('UPDATE repositories SET branch = ? WHERE id = ?').run(branch, id);
}

export function deleteRepository(id: string): void {
  const db = getDb();
  db.prepare('DELETE FROM control_actions WHERE session_id IN (SELECT id FROM sessions WHERE repository_id = ?)').run(id);
  db.prepare('DELETE FROM session_output WHERE session_id IN (SELECT id FROM sessions WHERE repository_id = ?)').run(id);
  db.prepare('DELETE FROM sessions WHERE repository_id = ?').run(id);
  db.prepare('DELETE FROM repositories WHERE id = ?').run(id);
}

export interface SessionFilters { repositoryId?: string; status?: string; type?: string; limit?: number; }

export function getSessions(filters: SessionFilters = {}): Session[] {
  let sql = 'SELECT id, repository_id as repositoryId, type, launch_mode as launchMode, pid, host_pid as hostPid, pid_source as pidSource, status, started_at as startedAt, ended_at as endedAt, last_activity_at as lastActivityAt, summary, expires_at as expiresAt, model, reconciled, yolo_mode as yoloMode FROM sessions WHERE 1=1';
  const params: unknown[] = [];
  if (filters.repositoryId) { sql += ' AND repository_id = ?'; params.push(filters.repositoryId); }
  if (filters.status) { sql += ' AND status = ?'; params.push(filters.status); }
  if (filters.type) { sql += ' AND type = ?'; params.push(filters.type); }
  sql += ' ORDER BY started_at DESC';
  sql += ' LIMIT ?'; params.push(filters.limit ?? 500);
  return (getDb().prepare(sql).all(...params) as Array<Omit<Session, 'reconciled' | 'yoloMode'> & { reconciled: number; yoloMode: number | null }>).map(
    r => ({ ...r, reconciled: r.reconciled === 1, yoloMode: r.yoloMode === null ? null : r.yoloMode === 1 })
  );
}

export function getSession(id: string): Session | undefined {
  const row = getDb().prepare(
    'SELECT id, repository_id as repositoryId, type, launch_mode as launchMode, pid, host_pid as hostPid, pid_source as pidSource, status, started_at as startedAt, ended_at as endedAt, last_activity_at as lastActivityAt, summary, expires_at as expiresAt, model, reconciled, yolo_mode as yoloMode FROM sessions WHERE id = ?'
  ).get(id) as (Omit<Session, 'reconciled' | 'yoloMode'> & { reconciled: number; yoloMode: number | null }) | undefined;
  if (!row) return undefined;
  return { ...row, reconciled: row.reconciled === 1, yoloMode: row.yoloMode === null ? null : row.yoloMode === 1 };
}

export function updateSessionStatus(id: string, status: string, endedAt: string | null, reconciled?: boolean): void {
  if (reconciled !== undefined) {
    getDb().prepare(
      'UPDATE sessions SET status = ?, ended_at = ?, last_activity_at = ?, reconciled = ? WHERE id = ?'
    ).run(status, endedAt, new Date().toISOString(), reconciled ? 1 : 0, id);
  } else {
    getDb().prepare(
      'UPDATE sessions SET status = ?, ended_at = ?, last_activity_at = ? WHERE id = ?'
    ).run(status, endedAt, new Date().toISOString(), id);
  }
}

export function upsertSession(session: Session): void {
  getDb().prepare(`
    INSERT INTO sessions (id, repository_id, type, launch_mode, pid, host_pid, pid_source, status, started_at, ended_at, last_activity_at, summary, expires_at, model, reconciled, yolo_mode)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      launch_mode = COALESCE(excluded.launch_mode, launch_mode),
      pid = excluded.pid, host_pid = COALESCE(excluded.host_pid, host_pid),
      pid_source = COALESCE(excluded.pid_source, pid_source),
      status = excluded.status, ended_at = excluded.ended_at,
      last_activity_at = excluded.last_activity_at, summary = excluded.summary,
      expires_at = excluded.expires_at, model = COALESCE(excluded.model, model),
      reconciled = excluded.reconciled,
      yolo_mode = COALESCE(excluded.yolo_mode, yolo_mode)
  `).run(session.id, session.repositoryId, session.type, session.launchMode ?? null, session.pid,
    session.hostPid ?? null, session.pidSource ?? null, session.status, session.startedAt, session.endedAt,
    session.lastActivityAt, session.summary, session.expiresAt, session.model ?? null,
    session.reconciled ? 1 : 0, session.yoloMode === null ? null : (session.yoloMode ? 1 : 0));
}

export function getOutputForSession(sessionId: string, limit = 100, before?: string): SessionOutput[] {
  let sql = 'SELECT id, session_id as sessionId, timestamp, type, content, tool_name as toolName, tool_call_id as toolCallId, role, sequence_number as sequenceNumber FROM session_output WHERE session_id = ?';
  const params: unknown[] = [sessionId];
  if (before) { sql += ' AND sequence_number < ?'; params.push(parseInt(before, 10)); }
  sql += ' ORDER BY sequence_number DESC LIMIT ?';
  params.push(limit);
  const rows = getDb().prepare(sql).all(...params) as SessionOutput[];
  return rows.reverse();
}

export function deleteSessionOutput(sessionId: string): void {
  getDb().prepare('DELETE FROM session_output WHERE session_id = ?').run(sessionId);
}

export function insertOutput(output: SessionOutput): void {
  getDb().prepare(
    'INSERT OR IGNORE INTO session_output (id, session_id, timestamp, type, content, tool_name, tool_call_id, sequence_number, role) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(output.id, output.sessionId, output.timestamp, output.type, output.content, output.toolName, output.toolCallId ?? null, output.sequenceNumber, output.role ?? null);
}

export function insertControlAction(action: ControlAction): void {
  getDb().prepare(
    'INSERT INTO control_actions (id, session_id, type, payload, status, created_at, completed_at, result) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(action.id, action.sessionId, action.type, action.payload ? JSON.stringify(action.payload) : null,
    action.status, action.createdAt, action.completedAt, action.result);
}

export function updateControlAction(id: string, status: string, completedAt: string | null, result: string | null): void {
  getDb().prepare(
    'UPDATE control_actions SET status = ?, completed_at = ?, result = ? WHERE id = ?'
  ).run(status, completedAt, result, id);
}

export function getTodos(userId = 'default'): TodoItem[] {
  return (getDb().prepare(
    'SELECT id, user_id as userId, text, done, created_at as createdAt, updated_at as updatedAt FROM todos WHERE user_id = ? ORDER BY created_at ASC'
  ).all(userId) as Array<Omit<TodoItem, 'done'> & { done: number }>).map(r => ({ ...r, done: r.done === 1 }));
}

export function insertTodo(todo: TodoItem): void {
  getDb().prepare(
    'INSERT INTO todos (id, user_id, text, done, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(todo.id, todo.userId, todo.text, todo.done ? 1 : 0, todo.createdAt, todo.updatedAt);
}

export function updateTodo(id: string, patch: { done?: boolean; text?: string }, updatedAt: string): TodoItem | undefined {
  const sets: string[] = [];
  const params: unknown[] = [];
  if (patch.done !== undefined) { sets.push('done = ?'); params.push(patch.done ? 1 : 0); }
  if (patch.text !== undefined) { sets.push('text = ?'); params.push(patch.text); }
  if (sets.length === 0) return undefined;
  sets.push('updated_at = ?');
  params.push(updatedAt, id);
  getDb().prepare(`UPDATE todos SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  return getTodos().find(t => t.id === id);
}

export function deleteTodo(id: string): boolean {
  const result = getDb().prepare('DELETE FROM todos WHERE id = ?').run(id);
  return result.changes > 0;
}
