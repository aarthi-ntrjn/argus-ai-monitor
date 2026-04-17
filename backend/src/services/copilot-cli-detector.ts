import { readdirSync, existsSync, readFileSync, openSync, readSync, closeSync, statSync } from 'fs';
import * as logger from '../utils/logger.js';
import { join, normalize } from 'path';
import { homedir } from 'os';
import { load as yamlLoad } from 'js-yaml';
import { randomUUID } from 'crypto';
import chokidar, { type FSWatcher } from 'chokidar';
import { upsertSession, getRepositoryByPath, deleteSessionOutput, getSession } from '../db/database.js';
import { broadcast } from '../api/ws/event-dispatcher.js';
import { ptyRegistry } from './pty-registry.js';
import { OutputStore } from './output-store.js';
import { parseJsonlLine, parseModelFromEvent } from './events-parser.js';
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
  private watchers = new Map<string, FSWatcher>();
  private filePositions = new Map<string, number>();
  private sequenceCounters = new Map<string, number>();
  private outputStore = new OutputStore();
  private lastScanTime = 0;
  // Dirs known to have an active session last scan — must be rechecked even if mtime unchanged.
  private activeDirPaths = new Set<string>();

  constructor(private sessionStateDir: string = DEFAULT_SESSION_DIR) {}

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
    // Guard 2: session is not already ended in DB
    // Guard 3 (only when guard 1 passes but guard 2 fails): verify process name matches
    //   — catches PID reuse where an unrelated process inherited a previously-used PID.
    const pidAlive = pid !== null && isPidRunning(pid);
    const isRunning = pidAlive && (
      existingSession?.status !== 'ended' ||
      isExpectedProcess(pid!, SessionTypes.COPILOT_CLI)
    );
    if (pidAlive && !isRunning) {
      logger.info(`[CopilotDetector] PID reuse detected: session ${sessionId} is ended but pid ${pid} is running with wrong name — skipping`);
    }

    // Skip directories for sessions already recorded as ended: no lock file means
    // nothing has changed since we last marked them ended.
    if (!isRunning && existingSession?.status === 'ended') return null;

    const repo = workspace.cwd ? getRepositoryByPath(normalize(workspace.cwd)) : null;
    if (!repo) return null;

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
      this.watchEventsFile(sessionId, dirPath);
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
      // is always authoritative for which process owns this session. If it disagrees with the
      // stored pid, the DB row is stale. The most likely cause is the session-type hijack bug
      // where a Copilot scan claimed a Claude launcher's pending registry entry (keyed only by
      // repo path) before the workspace_id message arrived, writing Claude's PID into this row.
      // Correcting to the lockfile PID here lets the DB converge within one scan cycle.
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

  private watchEventsFile(sessionId: string, dirPath: string): void {
    if (this.watchers.has(sessionId)) return;
    const eventsFile = join(dirPath, 'events.jsonl');
    if (!existsSync(eventsFile)) return;

    const TAIL_BYTES = 16 * 1024; // ~20-50 recent events; avoids reading huge historical files
    const fileSize = statSync(eventsFile).size;

    deleteSessionOutput(sessionId);
    this.filePositions.set(sessionId, Math.max(0, fileSize - TAIL_BYTES));
    this.sequenceCounters.set(sessionId, 0);

    this.readNewLines(sessionId, eventsFile);

    const watcher = chokidar.watch(eventsFile, { persistent: false, usePolling: false });
    watcher.on('change', () => this.readNewLines(sessionId, eventsFile));
    this.watchers.set(sessionId, watcher);
  }

  private readNewLines(sessionId: string, filePath: string): void {
    try {
      const currentSize = statSync(filePath).size;
      const lastPos = this.filePositions.get(sessionId) ?? 0;
      if (currentSize <= lastPos) return;

      const fd = openSync(filePath, 'r');
      const buffer = Buffer.alloc(currentSize - lastPos);
      readSync(fd, buffer, 0, buffer.length, lastPos);
      closeSync(fd);
      this.filePositions.set(sessionId, currentSize);

      const newContent = buffer.toString('utf-8');
      const lines = newContent.split('\n').filter((l) => l.trim());
      let seq = this.sequenceCounters.get(sessionId) ?? 0;

      let detectedModel: string | null = null;
      const outputs = lines.map((line) => {
        seq++;
        if (!detectedModel) detectedModel = parseModelFromEvent(line);
        return parseJsonlLine(line, sessionId, seq);
      }).filter((o): o is NonNullable<typeof o> => o !== null);

      this.sequenceCounters.set(sessionId, seq);
      if (outputs.length > 0) {
        this.outputStore.insertOutput(sessionId, outputs);
        const now = new Date().toISOString();
        const active = getSession(sessionId);
        if (active) {
          const updated = { ...active, lastActivityAt: now };
          upsertSession(updated);
          broadcast({ type: 'session.updated', timestamp: now, data: updated as unknown as Record<string, unknown> });
        }
      }

      if (detectedModel && !getSession(sessionId)?.model) {
        const existing = getSession(sessionId);
        if (existing) {
          const updated = { ...existing, model: detectedModel };
          upsertSession(updated);
          broadcast({ type: 'session.updated', timestamp: new Date().toISOString(), data: updated as unknown as Record<string, unknown> });
        }
      }

      // Update summary with the most recent user prompt in this batch
      const lastUserMsg = [...outputs].reverse().find(o => o.role === 'user' && o.type === 'message' && !o.isMeta);
      if (lastUserMsg?.content) {
        const existing = getSession(sessionId);
        if (existing) {
          const summary = lastUserMsg.content.slice(0, 120);
          if (existing.summary !== summary) {
            const updated = { ...existing, summary };
            upsertSession(updated);
            broadcast({ type: 'session.updated', timestamp: new Date().toISOString(), data: updated as unknown as Record<string, unknown> });
          }
        }
      }
    } catch { /* ignore */ }
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
    for (const watcher of this.watchers.values()) {
      watcher.close().catch(() => { /* ignore */ });
    }
    this.watchers.clear();
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
