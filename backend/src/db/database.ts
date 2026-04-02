import Database from 'better-sqlite3';
import { join, dirname, normalize } from 'path';
import { homedir } from 'os';
import { mkdirSync } from 'fs';
import { SCHEMA_SQL } from './schema.js';
import type { Repository, Session, SessionOutput, ControlAction } from '../models/index.js';

const DB_PATH = process.env.ARGUS_DB_PATH ?? join(homedir(), '.argus', 'argus.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    mkdirSync(dirname(DB_PATH), { recursive: true });
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.exec(SCHEMA_SQL);
    // Runtime migrations for existing databases (SQLite has no ADD COLUMN IF NOT EXISTS)
    const sessionCols = (db.pragma('table_info(sessions)') as Array<{ name: string }>).map(c => c.name);
    if (!sessionCols.includes('model')) db.exec('ALTER TABLE sessions ADD COLUMN model TEXT');
    const outputCols = (db.pragma('table_info(session_output)') as Array<{ name: string }>).map(c => c.name);
    if (!outputCols.includes('role')) db.exec('ALTER TABLE session_output ADD COLUMN role TEXT');
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
    'SELECT id, path, name, source, added_at as addedAt, last_scanned_at as lastScannedAt FROM repositories ORDER BY added_at DESC'
  ).all() as Repository[];
}

export function getRepository(id: string): Repository | undefined {
  return getDb().prepare(
    'SELECT id, path, name, source, added_at as addedAt, last_scanned_at as lastScannedAt FROM repositories WHERE id = ?'
  ).get(id) as Repository | undefined;
}

export function getRepositoryByPath(path: string): Repository | undefined {
  return getDb().prepare(
    'SELECT id, path, name, source, added_at as addedAt, last_scanned_at as lastScannedAt FROM repositories WHERE LOWER(path) = LOWER(?)'
  ).get(path) as Repository | undefined;
}

export function insertRepository(repo: Repository): void {
  getDb().prepare(
    'INSERT INTO repositories (id, path, name, source, added_at, last_scanned_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(repo.id, normalize(repo.path), repo.name, repo.source, repo.addedAt, repo.lastScannedAt);
}

export function deleteRepository(id: string): void {
  const db = getDb();
  db.prepare('DELETE FROM session_output WHERE session_id IN (SELECT id FROM sessions WHERE repository_id = ?)').run(id);
  db.prepare('DELETE FROM sessions WHERE repository_id = ?').run(id);
  db.prepare('DELETE FROM repositories WHERE id = ?').run(id);
}

export interface SessionFilters { repositoryId?: string; status?: string; type?: string; }

export function getSessions(filters: SessionFilters = {}): Session[] {
  let sql = 'SELECT id, repository_id as repositoryId, type, pid, status, started_at as startedAt, ended_at as endedAt, last_activity_at as lastActivityAt, summary, expires_at as expiresAt, model FROM sessions WHERE 1=1';
  const params: unknown[] = [];
  if (filters.repositoryId) { sql += ' AND repository_id = ?'; params.push(filters.repositoryId); }
  if (filters.status) { sql += ' AND status = ?'; params.push(filters.status); }
  if (filters.type) { sql += ' AND type = ?'; params.push(filters.type); }
  sql += ' ORDER BY started_at DESC';
  return getDb().prepare(sql).all(...params) as Session[];
}

export function getSession(id: string): Session | undefined {
  return getDb().prepare(
    'SELECT id, repository_id as repositoryId, type, pid, status, started_at as startedAt, ended_at as endedAt, last_activity_at as lastActivityAt, summary, expires_at as expiresAt, model FROM sessions WHERE id = ?'
  ).get(id) as Session | undefined;
}

export function updateSessionStatus(id: string, status: string, endedAt: string | null): void {
  getDb().prepare(
    'UPDATE sessions SET status = ?, ended_at = ?, last_activity_at = ? WHERE id = ?'
  ).run(status, endedAt, new Date().toISOString(), id);
}

export function upsertSession(session: Session): void {
  getDb().prepare(`
    INSERT INTO sessions (id, repository_id, type, pid, status, started_at, ended_at, last_activity_at, summary, expires_at, model)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      pid = excluded.pid, status = excluded.status, ended_at = excluded.ended_at,
      last_activity_at = excluded.last_activity_at, summary = excluded.summary,
      expires_at = excluded.expires_at, model = COALESCE(excluded.model, model)
  `).run(session.id, session.repositoryId, session.type, session.pid, session.status,
    session.startedAt, session.endedAt, session.lastActivityAt, session.summary, session.expiresAt, session.model ?? null);
}

export function getOutputForSession(sessionId: string, limit = 100, before?: string): SessionOutput[] {
  let sql = 'SELECT id, session_id as sessionId, timestamp, type, content, tool_name as toolName, role, sequence_number as sequenceNumber FROM session_output WHERE session_id = ?';
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
    'INSERT OR IGNORE INTO session_output (id, session_id, timestamp, type, content, tool_name, sequence_number, role) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(output.id, output.sessionId, output.timestamp, output.type, output.content, output.toolName, output.sequenceNumber, output.role ?? null);
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
