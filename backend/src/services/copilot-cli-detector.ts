import { readdirSync, existsSync, readFileSync, statSync } from 'fs';
import * as logger from '../utils/logger.js';
import { join, normalize } from 'path';
import { homedir } from 'os';
import { load as yamlLoad } from 'js-yaml';
import { randomUUID } from 'crypto';
import { upsertSession, getRepositoryByPath, getSession, getSessions, getServerState, setServerState } from '../db/database.js';
import { ptyRegistry } from './pty-registry.js';
import { CopilotJsonlWatcher } from './copilot-jsonl-watcher.js';
import { detectYoloModeFromPids, isPidRunning, isExpectedProcess } from './process-utils.js';
import { SessionTypes } from '../models/index.js';
import type { Session, PidSource } from '../models/index.js';

const DEFAULT_SESSION_DIR = join(homedir(), '.copilot', 'session-state');

interface WorkspaceYaml {
  id?: string;
  cwd?: string;
  summary?: string;
  created_at?: string | Date;
  updated_at?: string | Date;
}

export class CopilotCliDetector {
  private readonly jsonlWatcher = new CopilotJsonlWatcher();
  private lastScanTime: number;
  // Dirs known to have an active session — rechecked on every scan to detect when they end.
  private activeDirPaths = new Set<string>();

  constructor(private sessionStateDir: string = DEFAULT_SESSION_DIR) {
    const stored = getServerState('copilot_last_scan_time');
    this.lastScanTime = stored ? parseInt(stored, 10) : 0;
    // Pre-populate activeDirPaths from DB so sessions that were active when the server
    // stopped are picked up on the first scan even if their dir mtime predates lastScanTime.
    this.initActiveDirsFromDb();
  }

  // Reads active copilot-cli sessions from the DB and finds their on-disk dirs.
  // This ensures active sessions are always rechecked on startup regardless of mtime.
  private initActiveDirsFromDb(): void {
    if (!existsSync(this.sessionStateDir)) return;
    const activeSessions = getSessions({ type: SessionTypes.COPILOT_CLI, status: 'active' });
    if (activeSessions.length === 0) return;
    const activeIds = new Set(activeSessions.map(s => s.id));
    try {
      const entries = readdirSync(this.sessionStateDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const dirPath = join(this.sessionStateDir, entry.name);
        const workspaceFile = join(dirPath, 'workspace.yaml');
        if (!existsSync(workspaceFile)) continue;
        try {
          const workspace = yamlLoad(readFileSync(workspaceFile, 'utf-8')) as WorkspaceYaml;
          if (workspace.id && activeIds.has(workspace.id)) this.activeDirPaths.add(dirPath);
        } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
  }

  async scan(force = false): Promise<Session[]> {
    if (!existsSync(this.sessionStateDir)) return [];
    const t0 = Date.now();

    // Collect dirs to process:
    // 1. Dirs modified since last scan — may contain new sessions.
    //    When force=true (triggered by repo add) skip the mtime filter so we catch
    //    sessions whose dir predates the last scan (e.g. after a repo remove+re-add).
    // 2. Dirs that had an active session last scan — detect if they have ended.
    const dirsToProcess = new Set<string>();
    let totalDirs = 0;

    try {
      const entries = readdirSync(this.sessionStateDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        totalDirs++;
        const dirPath = join(this.sessionStateDir, entry.name);

        if (this.activeDirPaths.has(dirPath)) {
          dirsToProcess.add(dirPath);
          continue;
        }

        if (force) {
          dirsToProcess.add(dirPath);
          continue;
        }

        try {
          if (statSync(dirPath).mtimeMs > this.lastScanTime) dirsToProcess.add(dirPath);
        } catch { /* ignore */ }
      }
    } catch { /* ignore */ }

    const sessions: Session[] = [];
    const newActiveDirPaths = new Set<string>();

    for (const dirPath of dirsToProcess) {
      const tDir = Date.now();
      const session = await this.processSessionDir(dirPath);
      const dirMs = Date.now() - tDir;
      if (dirMs > 50) {
        logger.info(`[CopilotDetector] slow dir (${dirMs}ms): ${dirPath}`);
      }
      if (session) {
        sessions.push(session);
        if (session.status === 'active') newActiveDirPaths.add(dirPath);
      }
    }

    this.activeDirPaths = newActiveDirPaths;
    this.lastScanTime = t0;
    setServerState('copilot_last_scan_time', String(t0));

    return sessions;
  }

  private async processSessionDir(dirPath: string): Promise<Session | null> {
    const workspaceFile = join(dirPath, 'workspace.yaml');
    if (!existsSync(workspaceFile)) return null;

    let workspace: WorkspaceYaml;
    try {
      workspace = yamlLoad(readFileSync(workspaceFile, 'utf-8')) as WorkspaceYaml;
    } catch { return null; }

    const lockFile = this.findLockFile(dirPath);
    const pid = lockFile ? this.extractPid(lockFile) : null;

    const sessionId = workspace.id ?? randomUUID();
    const existingSession = getSession(sessionId);

    // Guard 1: process is running (cheap signal-0 check)
    // Guard 2: verify the process at this PID is actually the expected AI tool — catches
    //   stale lock files pointing to recycled PIDs (PID reuse by an unrelated process).
    const pidAlive = pid !== null && isPidRunning(pid);
    const isRunning = pidAlive && isExpectedProcess(pid!, SessionTypes.COPILOT_CLI);
    if (pidAlive && !isRunning) {
      logger.info(`[CopilotDetector] PID reuse detected: pid ${pid} is running with wrong name — skipping (sessionId=${sessionId} existingStatus=${existingSession?.status ?? 'new'})`);
    }

    // Skip directories for sessions already recorded as ended: no lock file means
    // nothing has changed since we last marked them ended.
    if (!isRunning && existingSession?.status === 'ended') return null;

    const repo = workspace.cwd ? getRepositoryByPath(normalize(workspace.cwd)) : null;
    if (!repo) { logger.warn(`[CopilotDetector] no repo for cwd="${workspace.cwd ?? 'none'}" sessionId=${sessionId} — session ignored`); return null; }

    const status = isRunning ? 'active' : 'ended';
    const toIso = (val: string | Date | undefined): string =>
      val ? (val instanceof Date ? val.toISOString() : val) : new Date().toISOString();

    const { launchMode, resolvedPid, resolvedHostPid, resolvedPidSource, resolvedPtyLaunchId } =
      this.resolvePtyLinkage(sessionId, existingSession, repo, pid, isRunning);

    const yoloMode = existingSession?.yoloMode != null
      ? existingSession.yoloMode
      : isRunning ? detectYoloModeFromPids(resolvedPid, resolvedHostPid, SessionTypes.COPILOT_CLI) : null;
    const session: Session = {
      id: sessionId,
      repositoryId: repo.id,
      type: SessionTypes.COPILOT_CLI,
      launchMode,
      pid: resolvedPid,
      hostPid: resolvedHostPid,
      pidSource: resolvedPidSource,
      status,
      startedAt: toIso(workspace.created_at),
      endedAt: status === 'ended' ? toIso(workspace.updated_at) : null,
      lastActivityAt: existingSession?.lastActivityAt && existingSession.lastActivityAt > toIso(workspace.updated_at)
        ? existingSession.lastActivityAt
        : toIso(workspace.updated_at),
      summary: existingSession?.summary ?? workspace.summary ?? null,
      expiresAt: null,
      model: existingSession?.model ?? null,
      reconciled: true,
      yoloMode,
      ptyLaunchId: resolvedPtyLaunchId,
    };

    upsertSession(session);

    if (isRunning) {
      await this.jsonlWatcher.watchFile(sessionId, dirPath);
    }

    return session;
  }

  private resolvePtyLinkage(
    sessionId: string,
    existingSession: Session | null | undefined,
    repo: { path: string },
    pid: number | null,
    isRunning: boolean,
  ): { launchMode: 'pty' | null; resolvedPid: number | null; resolvedHostPid: number | null; resolvedPidSource: PidSource | null; resolvedPtyLaunchId: string | null } {
    const alreadyClaimed = existingSession?.launchMode === 'pty';
    const registryHas = ptyRegistry.has(sessionId);

    let launchMode: 'pty' | null = null;
    let resolvedPid = pid;
    let resolvedHostPid: number | null = existingSession?.hostPid ?? null;
    let resolvedPidSource: PidSource | null = pid != null ? 'lockfile' : null;
    let resolvedPtyLaunchId: string | null = existingSession?.ptyLaunchId ?? null;

    if (alreadyClaimed) {
      launchMode = 'pty';
      resolvedPid = existingSession!.pid;
      resolvedHostPid = existingSession!.hostPid;
      resolvedPidSource = existingSession!.pidSource;
      // The lockfile PID is ground truth: it is written by the Copilot process itself and
      // is always authoritative for which process owns this session. Correct any stale DB
      // value so the row converges within one scan cycle.
      if (pid !== null && pid !== existingSession!.pid) {
        logger.warn(`[CopilotDetector] alreadyClaimed pid mismatch: lockfile=${pid} stored=${existingSession!.pid} sessionId=${sessionId} — correcting to lockfile pid`);
        resolvedPid = pid;
        resolvedPidSource = 'lockfile';
      }
      if (!registryHas && isRunning) {
        logger.info(`[CopilotDetector] alreadyClaimed + WS gone + isRunning — attempting re-link sessionId=${sessionId}`);
        const claimed = ptyRegistry.claimForSession(sessionId, repo.path, 'copilot-cli');
        if (claimed) {
          resolvedPid = claimed.pid;
          resolvedHostPid = claimed.hostPid;
          resolvedPidSource = 'pty_registry';
          resolvedPtyLaunchId = claimed.ptyLaunchId;
          logger.info(`[CopilotDetector] re-link OK sessionId=${sessionId} hostPid=${claimed.hostPid} pid=${claimed.pid}`);
        } else {
          logger.info(`[CopilotDetector] re-link MISS — no pending WS yet for sessionId=${sessionId}`);
        }
      }
    } else if (registryHas) {
      logger.info(`[CopilotDetector] ptyRegistry already has sessionId=${sessionId} — marking pty`);
      launchMode = 'pty';
      resolvedPidSource = 'pty_registry';
      resolvedPtyLaunchId = existingSession?.ptyLaunchId ?? ptyRegistry.getPtyLaunchIdForSession(sessionId) ?? null;
      const parkedPid = ptyRegistry.getClaimedPid(sessionId);
      if (parkedPid != null) {
        resolvedPid = parkedPid;
        logger.info(`[CopilotDetector] using parked resolved pid=${parkedPid} for sessionId=${sessionId}`);
      }
    } else if (isRunning && existingSession == null) {
      logger.info(`[CopilotDetector] isRunning + not claimed — trying claimForSession sessionId=${sessionId} repoPath="${repo.path}"`);
      const claimed = ptyRegistry.claimForSession(sessionId, repo.path, 'copilot-cli');
      if (claimed) {
        launchMode = 'pty';
        resolvedPid = claimed.pid;
        resolvedHostPid = claimed.hostPid;
        resolvedPidSource = 'pty_registry';
        resolvedPtyLaunchId = claimed.ptyLaunchId;
        logger.info(`[CopilotDetector] claimForSession OK sessionId=${sessionId} hostPid=${claimed.hostPid} pid=${claimed.pid}`);
      } else {
        logger.info(`[CopilotDetector] claimForSession MISS — no pending WS — sessionId=${sessionId} will be read-only`);
      }
    }

    return { launchMode, resolvedPid, resolvedHostPid, resolvedPidSource, resolvedPtyLaunchId };
  }

  /**
   * Scan all copilot session directories and return a map of session ID → PID
   * from inuse.<PID>.lock files. This is the copilot equivalent of
   * ClaudeSessionRegistry.scanEntries().
   */
  scanLockEntries(): Map<string, number> {
    const result = new Map<string, number>();
    if (!existsSync(this.sessionStateDir)) return result;

    try {
      const entries = readdirSync(this.sessionStateDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const dirPath = join(this.sessionStateDir, entry.name);
        const workspaceFile = join(dirPath, 'workspace.yaml');
        if (!existsSync(workspaceFile)) continue;

        try {
          const workspace = yamlLoad(readFileSync(workspaceFile, 'utf-8')) as WorkspaceYaml;
          if (!workspace.id) continue;

          const lockFile = this.findLockFile(dirPath);
          const pid = lockFile ? this.extractPid(lockFile) : null;
          if (pid != null) {
            result.set(workspace.id, pid);
          }
        } catch { /* skip malformed */ }
      }
    } catch { /* ignore */ }

    return result;
  }

  stopWatchers(): void {
    this.jsonlWatcher.stopWatchers();
  }

  private findLockFile(dirPath: string): string | null {
    try {
      const files = readdirSync(dirPath);
      return files.find((f) => f.startsWith('inuse.') && f.endsWith('.lock')) ?? null;
    } catch { return null; }
  }

  private extractPid(lockFile: string): number | null {
    const match = lockFile.match(/inuse\.(\d+)\.lock/);
    return match ? parseInt(match[1], 10) : null;
  }

}
