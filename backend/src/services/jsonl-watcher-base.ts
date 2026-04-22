import { existsSync } from 'fs';
import { open as fsOpen, stat as fsStat } from 'fs/promises';
import chokidar, { type FSWatcher } from 'chokidar';
import { getMaxSequenceNumber } from '../db/database.js';
import { OutputStore } from './output-store.js';
import { applyActivityUpdate, applyModelUpdate, applySummaryUpdate } from './watcher-session-helpers.js';
import * as logger from '../utils/logger.js';
import type { SessionOutput } from '../models/index.js';

export const TAIL_BYTES = 16 * 1024;

/** Splits a buffer into lines with their absolute byte offset in the source file. */
function splitLinesWithOffsets(buffer: Buffer, baseOffset: number): Array<{ text: string; byteOffset: number }> {
  const results: Array<{ text: string; byteOffset: number }> = [];
  let pos = 0;
  for (const part of buffer.toString('utf-8').split('\n')) {
    const byteLen = Buffer.byteLength(part, 'utf-8');
    if (part.trim()) results.push({ text: part, byteOffset: baseOffset + pos });
    pos += byteLen + 1; // +1 for '\n'
  }
  return results;
}

/** Produces a stable, unique output entry ID from session, file position, and block index. */
function makeLineId(sessionId: string, byteOffset: number, blockIndex: number): string {
  return `${sessionId}-${byteOffset}-${blockIndex}`;
}

/** Extracts the model name from any JSONL line, regardless of format. */
function parseModelFromLine(line: string): string | null {
  if (!line.trim()) return null;
  try {
    const obj = JSON.parse(line) as Record<string, unknown>;
    // Claude format: message.model on assistant entries
    const msg = obj.message as Record<string, unknown> | undefined;
    if (typeof msg?.model === 'string') return msg.model;
    // Copilot flat format: top-level model on assistant.message events
    if (typeof obj.model === 'string') return obj.model;
    // Copilot nested format: data.model on tool.execution_complete events
    const data = obj.data as Record<string, unknown> | undefined;
    if (typeof data?.model === 'string') return data.model;
    return null;
  } catch { return null; }
}

export abstract class JsonlWatcherBase {
  protected readonly watchers = new Map<string, FSWatcher>();
  protected readonly filePositions = new Map<string, number>();
  protected readonly sequenceCounters = new Map<string, number>();
  protected readonly outputStore = new OutputStore();

  protected abstract readonly tag: string;
  protected abstract parseLine(line: string, sessionId: string, seq: number, makeId: (blockIndex: number) => string): SessionOutput[];

  protected async attachWatcher(sessionId: string, filePath: string): Promise<void> {
    if (this.watchers.has(sessionId)) return;
    if (!existsSync(filePath)) return;

    let fileSize: number;
    try {
      ({ size: fileSize } = await fsStat(filePath));
    } catch { return; }

    this.filePositions.set(sessionId, Math.max(0, fileSize - TAIL_BYTES));
    this.sequenceCounters.set(sessionId, getMaxSequenceNumber(sessionId) + 1);
    await this.readNewLines(sessionId, filePath);

    const watcher = chokidar.watch(filePath, { persistent: true, usePolling: false });
    watcher.on('change', () => {
      this.readNewLines(sessionId, filePath).catch((err) => {
        logger.warn(`${this.tag} readNewLines failed for ${sessionId}: ${err}`);
      });
    });
    this.watchers.set(sessionId, watcher);
  }

  protected async readNewLines(sessionId: string, filePath: string): Promise<void> {
    try {
      const { size: currentSize } = await fsStat(filePath);
      const lastPos = this.filePositions.get(sessionId) ?? 0;
      if (currentSize <= lastPos) return;

      const fh = await fsOpen(filePath, 'r');
      const buffer = Buffer.alloc(currentSize - lastPos);
      await fh.read(buffer, 0, buffer.length, lastPos);
      await fh.close();
      this.filePositions.set(sessionId, currentSize);

      const lines = splitLinesWithOffsets(buffer, lastPos);
      let seq = this.sequenceCounters.get(sessionId) ?? 0;
      const outputs: SessionOutput[] = [];
      let detectedModel: string | null = null;

      for (const line of lines) {
        seq++;
        const makeId = (blockIndex: number) => makeLineId(sessionId, line.byteOffset, blockIndex);
        outputs.push(...this.parseLine(line.text, sessionId, seq, makeId));
        if (!detectedModel) detectedModel = parseModelFromLine(line.text);
      }

      this.sequenceCounters.set(sessionId, seq);
      if (outputs.length > 0) {
        const anyNew = this.outputStore.insertOutput(sessionId, outputs);
        if (anyNew) {
          applyActivityUpdate(sessionId);
          this.onNewOutputs(sessionId, outputs);
        }
      }
      if (detectedModel) applyModelUpdate(sessionId, detectedModel, this.tag);
      applySummaryUpdate(sessionId, outputs, this.tag);
    } catch (err) {
      logger.warn(`${this.tag} failed to read JSONL for ${sessionId}: ${err}`);
    }
  }

  stopWatchers(): void {
    for (const watcher of this.watchers.values()) {
      watcher.close().catch(() => {});
    }
    this.watchers.clear();
    this.filePositions.clear();
    this.sequenceCounters.clear();
  }

  protected onNewOutputs(_sessionId: string, _outputs: SessionOutput[]): void {}
}