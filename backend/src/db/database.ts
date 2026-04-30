import Database from 'better-sqlite3';
import { join, dirname, normalize } from 'path';
import { homedir } from 'os';
import { mkdirSync } from 'fs';
import { SCHEMA_SQL } from './schema.js';
import type { Repository, Session, SessionOutput, ControlAction, TodoItem, TeamsThread, SlackThread } from '../models/index.js';
import * as logger from '../utils/logger.js';

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
    if (!repoCols.includes('remote_url')) db.exec('ALTER TABLE repositories ADD COLUMN remote_url TEXT');
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
    if (!sessionCols.includes('pty_launch_id')) {
      db.exec('ALTER TABLE sessions ADD COLUMN pty_launch_id TEXT');
    }
    const yoloColInfo = (db.pragma('table_info(sessions)') as Array<{ name: string; notnull: number }>)
      .find(c => c.name === 'yolo_mode');
    if (!sessionCols.includes('yolo_mode')) {
      db.exec('ALTER TABLE sessions ADD COLUMN yolo_mode INTEGER DEFAULT NULL');
    } else if (yoloColInfo && yoloColInfo.notnull === 1) {
      // Migrate from NOT NULL DEFAULT 0 to nullable -- preserve existing true values
      db.exec('ALTER TABLE sessions ADD COLUMN yolo_mode_new INTEGER DEFAULT NULL');
      db.exec('UPDATE sessions SET yolo_mode_new = 1 WHERE yolo_mode = 1');
      db.exec('ALTER TABLE sessions DROP COLUMN yolo_mode');
      db.exec('ALTER TABLE sessions RENAME COLUMN yolo_mode_new TO yolo_mode');
    }
    const teamsCols = (db.pragma('table_info(teams_threads)') as Array<{ name: string }>).map(c => c.name);
    if (!teamsCols.includes('tenant_id')) db.exec("ALTER TABLE teams_threads ADD COLUMN tenant_id TEXT NOT NULL DEFAULT ''");
    const slackThreadsCols = (db.pragma('table_info(slack_threads)') as Array<{ name: string }>).map(c => c.name);
    if (!slackThreadsCols.includes('workspace_id')) db.exec("ALTER TABLE slack_threads ADD COLUMN workspace_id TEXT NOT NULL DEFAULT ''");
    const controlCols = (db.pragma('table_info(control_actions)') as Array<{ name: string }>).map(c => c.name);
    if (!controlCols.includes('source')) db.exec('ALTER TABLE control_actions ADD COLUMN source TEXT');
    if (sessionCols.includes('slack_thread_ts')) {
      // Migrate existing slack thread data into the new slack_threads table then drop the column
      db.prepare(`
        INSERT OR IGNORE INTO slack_threads (id, session_id, slack_thread_ts, slack_channel_id, created_at)
        SELECT lower(hex(randomblob(16))), id, slack_thread_ts, ?, started_at
        FROM sessions WHERE slack_thread_ts IS NOT NULL
      `).run(process.env.SLACK_CHANNEL_ID ?? '');
      db.exec('ALTER TABLE sessions DROP COLUMN slack_thread_ts');
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
    'SELECT id, path, name, source, added_at as addedAt, last_scanned_at as lastScannedAt, branch, remote_url as remoteUrl FROM repositories ORDER BY added_at DESC'
  ).all() as Repository[];
}

export function getRepository(id: string): Repository | undefined {
  return getDb().prepare(
    'SELECT id, path, name, source, added_at as addedAt, last_scanned_at as lastScannedAt, branch, remote_url as remoteUrl FROM repositories WHERE id = ?'
  ).get(id) as Repository | undefined;
}

function normalizeRepoPath(p: string): string {
  return normalize(p.trimEnd().replace(/[/\\]+$/, ''));
}

export function getRepositoryByPath(path: string): Repository | undefined {
  return getDb().prepare(
    'SELECT id, path, name, source, added_at as addedAt, last_scanned_at as lastScannedAt, branch, remote_url as remoteUrl FROM repositories WHERE LOWER(path) = LOWER(?)'
  ).get(normalizeRepoPath(path)) as Repository | undefined;
}

export function insertRepository(repo: Repository): void {
  getDb().prepare(
    'INSERT INTO repositories (id, path, name, source, added_at, last_scanned_at, branch, remote_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(repo.id, normalizeRepoPath(repo.path), repo.name, repo.source, repo.addedAt, repo.lastScannedAt, repo.branch ?? null, repo.remoteUrl ?? null);
}

export function updateRepositoryBranch(id: string, branch: string | null, remoteUrl?: string | null): void {
  if (remoteUrl !== undefined) {
    getDb().prepare('UPDATE repositories SET branch = ?, remote_url = ? WHERE id = ?').run(branch, remoteUrl, id);
  } else {
    getDb().prepare('UPDATE repositories SET branch = ? WHERE id = ?').run(branch, id);
  }
}

export function updateRepositoryRemoteUrl(id: string, remoteUrl: string | null): void {
  getDb().prepare('UPDATE repositories SET remote_url = ? WHERE id = ?').run(remoteUrl, id);
}

export function deleteRepository(id: string): void {
  const db = getDb();

  const sessionIds = (db.prepare('SELECT id FROM sessions WHERE repository_id = ?').all(id) as Array<{ id: string }>).map(r => r.id);
  logger.info(`[deleteRepository] repo=${id} sessions=${JSON.stringify(sessionIds)}`);

  if (sessionIds.length > 0) {
    const placeholders = sessionIds.map(() => '?').join(',');
    const caCount = (db.prepare(`SELECT COUNT(*) as n FROM control_actions WHERE session_id IN (${placeholders})`).get(...sessionIds) as { n: number }).n;
    const soCount = (db.prepare(`SELECT COUNT(*) as n FROM session_output WHERE session_id IN (${placeholders})`).get(...sessionIds) as { n: number }).n;
    logger.info(`[deleteRepository] control_actions to delete=${caCount}, session_output to delete=${soCount}`);
  }

  const caResult = db.prepare('DELETE FROM control_actions WHERE session_id IN (SELECT id FROM sessions WHERE repository_id = ?)').run(id);
  const soResult = db.prepare('DELETE FROM session_output WHERE session_id IN (SELECT id FROM sessions WHERE repository_id = ?)').run(id);
  const ttResult = db.prepare('DELETE FROM teams_threads WHERE session_id IN (SELECT id FROM sessions WHERE repository_id = ?)').run(id);
  const stResult = db.prepare('DELETE FROM slack_threads WHERE session_id IN (SELECT id FROM sessions WHERE repository_id = ?)').run(id);
  logger.info(`[deleteRepository] deleted control_actions=${caResult.changes}, session_output=${soResult.changes}, teams_threads=${ttResult.changes}, slack_threads=${stResult.changes}`);

  // Verify no child records remain before deleting sessions
  if (sessionIds.length > 0) {
    const placeholders = sessionIds.map(() => '?').join(',');
    const caRemaining = (db.prepare(`SELECT COUNT(*) as n FROM control_actions WHERE session_id IN (${placeholders})`).get(...sessionIds) as { n: number }).n;
    const soRemaining = (db.prepare(`SELECT COUNT(*) as n FROM session_output WHERE session_id IN (${placeholders})`).get(...sessionIds) as { n: number }).n;
    const ttRemaining = (db.prepare(`SELECT COUNT(*) as n FROM teams_threads WHERE session_id IN (${placeholders})`).get(...sessionIds) as { n: number }).n;
    const stRemaining = (db.prepare(`SELECT COUNT(*) as n FROM slack_threads WHERE session_id IN (${placeholders})`).get(...sessionIds) as { n: number }).n;
    logger.info(`[deleteRepository] remaining after cleanup: control_actions=${caRemaining}, session_output=${soRemaining}, teams_threads=${ttRemaining}, slack_threads=${stRemaining}`);
  }

  db.prepare('DELETE FROM sessions WHERE repository_id = ?').run(id);
  db.prepare('DELETE FROM repositories WHERE id = ?').run(id);
  logger.info(`[deleteRepository] done repo=${id}`);
}

export interface SessionFilters { repositoryId?: string; status?: string; type?: string; limit?: number; }

export function getSessions(filters: SessionFilters = {}): Session[] {
  let sql = 'SELECT id, repository_id as repositoryId, type, launch_mode as launchMode, pid, host_pid as hostPid, pid_source as pidSource, status, started_at as startedAt, ended_at as endedAt, last_activity_at as lastActivityAt, summary, expires_at as expiresAt, model, reconciled, yolo_mode as yoloMode, pty_launch_id as ptyLaunchId FROM sessions WHERE 1=1';
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
    'SELECT id, repository_id as repositoryId, type, launch_mode as launchMode, pid, host_pid as hostPid, pid_source as pidSource, status, started_at as startedAt, ended_at as endedAt, last_activity_at as lastActivityAt, summary, expires_at as expiresAt, model, reconciled, yolo_mode as yoloMode, pty_launch_id as ptyLaunchId FROM sessions WHERE id = ?'
  ).get(id) as (Omit<Session, 'reconciled' | 'yoloMode'> & { reconciled: number; yoloMode: number | null }) | undefined;
  if (!row) return undefined;
  return { ...row, reconciled: row.reconciled === 1, yoloMode: row.yoloMode === null ? null : row.yoloMode === 1 };
}

export function getSessionByPtyLaunchId(ptyLaunchId: string): Session | undefined {
  const row = getDb().prepare(
    'SELECT id, repository_id as repositoryId, type, launch_mode as launchMode, pid, host_pid as hostPid, pid_source as pidSource, status, started_at as startedAt, ended_at as endedAt, last_activity_at as lastActivityAt, summary, expires_at as expiresAt, model, reconciled, yolo_mode as yoloMode, pty_launch_id as ptyLaunchId FROM sessions WHERE pty_launch_id = ?'
  ).get(ptyLaunchId) as (Omit<Session, 'reconciled' | 'yoloMode'> & { reconciled: number; yoloMode: number | null }) | undefined;
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
    INSERT INTO sessions (id, repository_id, type, launch_mode, pid, host_pid, pid_source, status, started_at, ended_at, last_activity_at, summary, expires_at, model, reconciled, yolo_mode, pty_launch_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      launch_mode = COALESCE(excluded.launch_mode, launch_mode),
      pid = excluded.pid, host_pid = COALESCE(excluded.host_pid, host_pid),
      pid_source = COALESCE(excluded.pid_source, pid_source),
      status = excluded.status, ended_at = excluded.ended_at,
      last_activity_at = excluded.last_activity_at, summary = excluded.summary,
      expires_at = excluded.expires_at, model = COALESCE(excluded.model, model),
      reconciled = excluded.reconciled,
      yolo_mode = COALESCE(excluded.yolo_mode, yolo_mode),
      pty_launch_id = COALESCE(excluded.pty_launch_id, pty_launch_id)
  `).run(session.id, session.repositoryId, session.type, session.launchMode ?? null, session.pid,
    session.hostPid ?? null, session.pidSource ?? null, session.status, session.startedAt, session.endedAt,
    session.lastActivityAt, session.summary, session.expiresAt, session.model ?? null,
    session.reconciled ? 1 : 0, session.yoloMode === null ? null : (session.yoloMode ? 1 : 0),
    session.ptyLaunchId ?? null);
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

/** Returns true if the row was inserted, false if it was a duplicate (INSERT OR IGNORE skipped it). */
export function insertOutput(output: SessionOutput): boolean {
  const result = getDb().prepare(
    'INSERT OR IGNORE INTO session_output (id, session_id, timestamp, type, content, tool_name, tool_call_id, sequence_number, role) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(output.id, output.sessionId, output.timestamp, output.type, output.content, output.toolName, output.toolCallId ?? null, output.sequenceNumber, output.role ?? null);
  return result.changes > 0;
}

export function getMaxSequenceNumber(sessionId: string): number {
  const row = getDb()
    .prepare('SELECT COALESCE(MAX(sequence_number), 0) AS maxSeq FROM session_output WHERE session_id = ?')
    .get(sessionId) as { maxSeq: number };
  return row.maxSeq;
}

export function insertControlAction(action: ControlAction): void {
  getDb().prepare(
    'INSERT INTO control_actions (id, session_id, type, payload, status, created_at, completed_at, result, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(action.id, action.sessionId, action.type, action.payload ? JSON.stringify(action.payload) : null,
    action.status, action.createdAt, action.completedAt, action.result, action.source ?? null);
}

export function getControlActions(sessionId: string): ControlAction[] {
  const rows = getDb().prepare(
    'SELECT id, session_id as sessionId, type, payload, status, created_at as createdAt, completed_at as completedAt, result, source FROM control_actions WHERE session_id = ? ORDER BY created_at ASC'
  ).all(sessionId) as Array<Omit<ControlAction, 'payload'> & { payload: string | null }>;
  return rows.map(r => ({ ...r, payload: r.payload ? JSON.parse(r.payload) : null }));
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

export function upsertTeamsThread(thread: TeamsThread): void {
  getDb().prepare(`
    INSERT OR REPLACE INTO teams_threads (id, session_id, teams_thread_id, teams_channel_id, tenant_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(thread.id, thread.sessionId, thread.teamsThreadId, thread.teamsChannelId, thread.tenantId, thread.createdAt);
}

export function getTeamsThread(sessionId: string): TeamsThread | null {
  return getDb().prepare(
    'SELECT id, session_id as sessionId, teams_thread_id as teamsThreadId, teams_channel_id as teamsChannelId, tenant_id as tenantId, created_at as createdAt FROM teams_threads WHERE session_id = ?'
  ).get(sessionId) as TeamsThread | null;
}

export function getTeamsThreadByTeamsId(teamsThreadId: string): TeamsThread | null {
  return getDb().prepare(
    'SELECT id, session_id as sessionId, teams_thread_id as teamsThreadId, teams_channel_id as teamsChannelId, tenant_id as tenantId, created_at as createdAt FROM teams_threads WHERE teams_thread_id = ?'
  ).get(teamsThreadId) as TeamsThread | null;
}

export function deleteTeamsThread(sessionId: string): void {
  getDb().prepare('DELETE FROM teams_threads WHERE session_id = ?').run(sessionId);
}

export function upsertSlackThread(thread: SlackThread): void {
  getDb().prepare(`
    INSERT OR REPLACE INTO slack_threads (id, session_id, slack_thread_ts, slack_channel_id, workspace_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(thread.id, thread.sessionId, thread.slackThreadTs, thread.slackChannelId, thread.workspaceId, thread.createdAt);
}

export function getSlackThread(sessionId: string): SlackThread | null {
  return getDb().prepare(
    'SELECT id, session_id as sessionId, slack_thread_ts as slackThreadTs, slack_channel_id as slackChannelId, workspace_id as workspaceId, created_at as createdAt FROM slack_threads WHERE session_id = ?'
  ).get(sessionId) as SlackThread | null;
}

export function getSlackThreadByTs(threadTs: string): SlackThread | null {
  return getDb().prepare(
    'SELECT id, session_id as sessionId, slack_thread_ts as slackThreadTs, slack_channel_id as slackChannelId, workspace_id as workspaceId, created_at as createdAt FROM slack_threads WHERE slack_thread_ts = ?'
  ).get(threadTs) as SlackThread | null;
}

export function deleteSlackThread(sessionId: string): void {
  getDb().prepare('DELETE FROM slack_threads WHERE session_id = ?').run(sessionId);
}

export function getIntegrationEnabled(id: string): boolean | null {
  const row = getDb().prepare('SELECT enabled FROM integrations WHERE id = ?').get(id) as { enabled: number } | undefined;
  if (!row) return null; // never explicitly set — use default (initialize normally)
  return row.enabled === 1;
}

export function setIntegrationEnabled(id: string, enabled: boolean): void {
  getDb().prepare(
    'INSERT OR REPLACE INTO integrations (id, enabled, updated_at) VALUES (?, ?, ?)'
  ).run(id, enabled ? 1 : 0, new Date().toISOString());
}

export function getServerState(key: string): string | null {
  const row = getDb().prepare('SELECT value FROM server_state WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setServerState(key: string, value: string): void {
  getDb().prepare('INSERT INTO server_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
}
