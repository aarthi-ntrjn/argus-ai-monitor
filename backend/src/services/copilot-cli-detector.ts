import { readdirSync, existsSync, readFileSync, openSync, readSync, closeSync, statSync } from 'fs';
import { join, normalize } from 'path';
import { homedir } from 'os';
import { load as yamlLoad } from 'js-yaml';
import psList from 'ps-list';
import { randomUUID } from 'crypto';
import chokidar, { type FSWatcher } from 'chokidar';
import { upsertSession, getRepositoryByPath, deleteSessionOutput, getSession } from '../db/database.js';
import { OutputStore } from './output-store.js';
import { parseJsonlLine, parseModelFromEvent } from './events-parser.js';
import type { Session } from '../models/index.js';

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

    const repo = workspace.cwd ? getRepositoryByPath(normalize(workspace.cwd)) : null;
    if (!repo) return null;

    const sessionId = workspace.id ?? randomUUID();
    const status = isRunning ? 'active' : 'ended';

    const toIso = (val: string | Date | undefined): string =>
      val ? (val instanceof Date ? val.toISOString() : val) : new Date().toISOString();

    const session: Session = {
      id: sessionId,
      repositoryId: repo.id,
      type: 'copilot-cli',
      pid: pid,
      status,
      startedAt: toIso(workspace.created_at),
      endedAt: status === 'ended' ? toIso(workspace.updated_at) : null,
      lastActivityAt: toIso(workspace.updated_at),
      summary: workspace.summary ?? null,
      expiresAt: null,
      model: this.extractModelFromEventsFile(join(dirPath, 'events.jsonl')),
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
    } catch { /* ignore */ }
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