import { existsSync } from 'fs';
import * as logger from '../utils/logger.js';
import { open as fsOpen, stat as fsStat } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';

import chokidar, { type FSWatcher } from 'chokidar';
import { getSession, upsertSession } from '../db/database.js';
import { outputStore } from './output-store.js';
import { broadcast } from '../api/ws/event-dispatcher.js';
import { parseClaudeJsonlLine, parseModel } from './claude-code-jsonl-parser.js';

function claudeProjectDirName(repoPath: string): string {
  return repoPath.replace(/[:\\/]/g, '-');
}

export class ClaudeJsonlWatcher {
  private watchers = new Map<string, FSWatcher>();
  private filePositions = new Map<string, number>();
  private sequenceCounters = new Map<string, number>();

  async watchFile(sessionId: string, repoPath: string): Promise<void> {
    if (this.watchers.has(sessionId)) return;
    const jsonlPath = join(
      homedir(), '.claude', 'projects',
      claudeProjectDirName(repoPath),
      `${sessionId}.jsonl`,
    );
    if (!existsSync(jsonlPath)) return;

    this.filePositions.set(sessionId, 0);
    this.sequenceCounters.set(sessionId, 0);
    await this.readNewLines(sessionId, jsonlPath, { skipNotifications: true });

    const watcher = chokidar.watch(jsonlPath, { persistent: false, usePolling: false });
    watcher.on('change', () => { this.readNewLines(sessionId, jsonlPath).catch(() => {}); });
    this.watchers.set(sessionId, watcher);
  }

  private async readNewLines(sessionId: string, filePath: string, options?: { skipNotifications?: boolean }): Promise<void> {
    try {
      const { size: currentSize } = await fsStat(filePath);
      const lastPos = this.filePositions.get(sessionId) ?? 0;
      if (currentSize <= lastPos) return;

      const fh = await fsOpen(filePath, 'r');
      const buffer = Buffer.alloc(currentSize - lastPos);
      await fh.read(buffer, 0, buffer.length, lastPos);
      await fh.close();
      this.filePositions.set(sessionId, currentSize);

      const lines = buffer.toString('utf-8').split('\n').filter(l => l.trim());
      let seq = this.sequenceCounters.get(sessionId) ?? 0;
      const outputs = [];
      let needsModel = !(getSession(sessionId)?.model);

      for (const line of lines) {
        seq++;
        const items = parseClaudeJsonlLine(line, sessionId, seq);
        outputs.push(...items);
        if (needsModel) {
          const model = parseModel(line);
          if (model) {
            this.applyModelUpdate(sessionId, model);
            needsModel = false;
          }
        }
      }

      this.sequenceCounters.set(sessionId, seq);
      if (outputs.length > 0) {
        outputStore.insertOutput(sessionId, outputs, options);
        this.applyActivityUpdate(sessionId);
      }
      this.applySummaryUpdate(sessionId, outputs);
    } catch { /* ignore */ }
  }

  private applyModelUpdate(sessionId: string, model: string): void {
    const existing = getSession(sessionId);
    if (!existing) return;
    logger.info(`[ClaudeDetector] model detected sessionId=${sessionId} model=${model}`);
    const updated = { ...existing, model };
    upsertSession(updated);
    broadcast({ type: 'session.updated', timestamp: new Date().toISOString(), data: updated as unknown as Record<string, unknown> });
  }

  private applyActivityUpdate(sessionId: string): void {
    const now = new Date().toISOString();
    const active = getSession(sessionId);
    if (!active) return;
    const updated = { ...active, lastActivityAt: now };
    upsertSession(updated);
    broadcast({ type: 'session.updated', timestamp: now, data: updated as unknown as Record<string, unknown> });
  }

  private applySummaryUpdate(sessionId: string, outputs: ReturnType<typeof parseClaudeJsonlLine>): void {
    const lastUserMsg = [...outputs].reverse().find(o => o.role === 'user' && o.type === 'message' && !o.isMeta);
    if (!lastUserMsg?.content) return;
    const existing = getSession(sessionId);
    if (!existing) return;
    const summary = lastUserMsg.content.slice(0, 120);
    if (existing.summary === summary) return;
    logger.info(`[ClaudeDetector] summary updated sessionId=${sessionId}`);
    const updated = { ...existing, summary };
    upsertSession(updated);
    broadcast({ type: 'session.updated', timestamp: new Date().toISOString(), data: updated as unknown as Record<string, unknown> });
  }

  closeWatcher(sessionId: string): void {
    this.watchers.get(sessionId)?.close().catch(() => { /* ignore */ });
    this.watchers.delete(sessionId);
    this.filePositions.delete(sessionId);
    this.sequenceCounters.delete(sessionId);
  }

  stopAll(): void {
    for (const watcher of this.watchers.values()) {
      watcher.close().catch(() => { /* ignore */ });
    }
    this.watchers.clear();
    this.filePositions.clear();
    this.sequenceCounters.clear();
  }
}

