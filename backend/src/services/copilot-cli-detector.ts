import { readdirSync, existsSync, readFileSync, openSync, readSync, closeSync, statSync } from 'fs';
import { join, normalize } from 'path';
import { homedir } from 'os';
import { load as yamlLoad } from 'js-yaml';
import psList from 'ps-list';
import { randomUUID } from 'crypto';
import chokidar, { type FSWatcher } from 'chokidar';
import { upsertSession, getRepositoryByPath, deleteSessionOutput, getSession } from '../db/database.js';
import { ptyRegistry } from './pty-registry.js';
import { OutputStore } from './output-store.js';
import { parseJsonlLine, parseModelFromEvent } from './events-parser.js';
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

  constructor(private sessionStateDir: string = DEFAULT_SESSION_DIR) {}

  async scan(): Promise<Session[]> {
    if (!existsSync(this.sessionStateDir)) return [];
    const runningPids = await this.getRunningPids();
    const sessions: Session[] = [];
    try {
      const entries = readdirSync(this.sessionStateDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const session = await this.processSessionDir(join(this.sessionStateDir, entry.name), runningPids);
        if (session) sessions.push(session);
      }
    } catch { /* ignore */ }
    return sessions;
  }

  private async getRunningPids(): Promise<Set<number>> {
    try {
      const processes = await psList();
      return new Set(processes.map((p) => p.pid));
    } catch {
      return new Set();
    }
  }

  private async processSessionDir(dirPath: string, runningPids: Set<number>): Promise<Session | null> {
    const workspaceFile = join(dirPath, 'workspace.yaml');
    if (!existsSync(workspaceFile)) return null;

    let workspace: WorkspaceYaml;
    try {
      workspace = yamlLoad(readFileSync(workspaceFile, 'utf-8')) as WorkspaceYaml;
    } catch { return null; }

    const lockFile = this.findLockFile(dirPath);
    const pid = lockFile ? this.extractPid(lockFile) : null;
    const isRunning = pid !== null && runningPids.has(pid);

    const sessionId = workspace.id ?? randomUUID();
    const existingSession = getSession(sessionId);

    // Skip directories for sessions already recorded as ended: no lock file means
    // nothing has changed since we last marked them ended.
    if (!isRunning && existingSession?.status === 'ended') return null;

    const repo = workspace.cwd ? getRepositoryByPath(normalize(workspace.cwd)) : null;
    if (!repo) return null;

    const status = isRunning ? 'active' : 'ended';

    const toIso = (val: string | Date | undefined): string =>
      val ? (val instanceof Date ? val.toISOString() : val) : new Date().toISOString();

    // Check if this session was already claimed as a PTY session on a previous scan
    const alreadyClaimed = existingSession?.launchMode === 'pty';

    let launchMode: 'pty' | null = null;
    let resolvedPid = pid;
    let resolvedHostPid: number | null = existingSession?.hostPid ?? null;
    let resolvedPidSource: PidSource | null = pid != null ? 'lockfile' : null;

    const registryHas = ptyRegistry.has(sessionId);
    console.log(`[CopilotDetector] scan sessionId=${sessionId} pid=${pid} isRunning=${isRunning} alreadyClaimed=${alreadyClaimed} registryHas=${registryHas}`);

    if (alreadyClaimed) {
      // Preserve launchMode:'pty' as a historical record — this session was launched via argus launch
      launchMode = 'pty';
      resolvedPid = existingSession.pid;
      resolvedHostPid = existingSession.hostPid;
      resolvedPidSource = existingSession.pidSource;
      // If the WS is gone but the process is still running (e.g. Argus restarted), try to
      // re-link to a freshly reconnected launcher WS. If that also fails, keep the existing
      // pid/pidSource — the launcher will reconnect within 2s and the next scan will claim it.
      if (!registryHas && isRunning) {
        console.log(`[CopilotDetector] alreadyClaimed + WS gone + isRunning — attempting re-link sessionId=${sessionId}`);
        const claimed = ptyRegistry.claimForSession(sessionId, repo.path);
        if (claimed) {
          resolvedPid = claimed.pid;
          resolvedHostPid = claimed.hostPid;
          resolvedPidSource = 'pty_registry';
          console.log(`[CopilotDetector] re-link OK sessionId=${sessionId} hostPid=${claimed.hostPid} pid=${claimed.pid}`);
        } else {
          console.log(`[CopilotDetector] re-link MISS — no pending WS yet for sessionId=${sessionId}`);
        }
      }
    } else if (registryHas) {
      // workspace_id message already claimed this session before the scan ran
      console.log(`[CopilotDetector] ptyRegistry already has sessionId=${sessionId} — marking pty`);
      launchMode = 'pty';
      resolvedPidSource = 'pty_registry';
    } else if (isRunning) {
      // Fallback: try claiming via repoPath (workspace_id message not yet received).
      // Non-running (ended) sessions must not steal a pending launcher WS that belongs
      // to the new active session for the same cwd.
      console.log(`[CopilotDetector] isRunning + not claimed — trying claimForSession sessionId=${sessionId} repoPath="${repo.path}"`);
      const claimed = ptyRegistry.claimForSession(sessionId, repo.path);
      if (claimed) {
        launchMode = 'pty';
        resolvedPid = claimed.pid;
        resolvedHostPid = claimed.hostPid;
        resolvedPidSource = 'pty_registry';
        console.log(`[CopilotDetector] claimForSession OK sessionId=${sessionId} hostPid=${claimed.hostPid} pid=${claimed.pid}`);
      } else {
        console.log(`[CopilotDetector] claimForSession MISS — no pending WS — sessionId=${sessionId} will be read-only`);
      }
    } else {
      console.log(`[CopilotDetector] not running + not claimed — sessionId=${sessionId} read-only`);
    }

    console.log(`[CopilotDetector] result sessionId=${sessionId} launchMode=${launchMode} status=${status} hostPid=${resolvedHostPid} pid=${resolvedPid}`);

    const session: Session = {
      id: sessionId,
      repositoryId: repo.id,
      type: 'copilot-cli',
      launchMode,
      pid: resolvedPid,
      hostPid: resolvedHostPid,
      pidSource: resolvedPidSource,
      status,
      startedAt: toIso(workspace.created_at),
      endedAt: status === 'ended' ? toIso(workspace.updated_at) : null,
      lastActivityAt: toIso(workspace.updated_at),
      summary: workspace.summary ?? null,
      expiresAt: null,
      model: this.extractModelFromEventsFile(join(dirPath, 'events.jsonl')),
      reconciled: true,
    };

    upsertSession(session);

    if (isRunning) {
      this.watchEventsFile(sessionId, dirPath);
    }

    return session;
  }

  private watchEventsFile(sessionId: string, dirPath: string): void {
    if (this.watchers.has(sessionId)) return;
    const eventsFile = join(dirPath, 'events.jsonl');
    if (!existsSync(eventsFile)) return;

    // Clear any stale output (may be raw JSON from before parser fix) and reload from scratch
    deleteSessionOutput(sessionId);
    this.filePositions.set(sessionId, 0);
    this.sequenceCounters.set(sessionId, 0);

    // Load all historical lines immediately before starting the watcher
    this.readNewLines(sessionId, eventsFile);

    const watcher = chokidar.watch(eventsFile, { persistent: false, usePolling: false });
    watcher.on('change', () => this.readNewLines(sessionId, eventsFile));
    this.watchers.set(sessionId, watcher);
  }

  private extractModelFromEventsFile(filePath: string): string | null {
    if (!existsSync(filePath)) return null;
    try {
      const lines = readFileSync(filePath, 'utf-8').split('\n');
      for (const line of lines) {
        const model = parseModelFromEvent(line);
        if (model) return model;
      }
    } catch { /* ignore */ }
    return null;
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
      }

      if (detectedModel && !getSession(sessionId)?.model) {
        const existing = getSession(sessionId);
        if (existing) upsertSession({ ...existing, model: detectedModel });
      }

      // Update summary with the most recent user prompt in this batch
      const lastUserMsg = [...outputs].reverse().find(o => o.role === 'user' && o.type === 'message');
      if (lastUserMsg?.content) {
        const existing = getSession(sessionId);
        if (existing) {
          const summary = lastUserMsg.content.slice(0, 120);
          if (existing.summary !== summary) {
            const updated = { ...existing, summary };
            upsertSession(updated);
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