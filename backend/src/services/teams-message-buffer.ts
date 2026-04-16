import type { Logger } from 'pino';

export class TeamsMessageBuffer {
  private buffers = new Map<string, string[]>();
  private droppedCounts = new Map<string, number>();
  private readonly maxSize: number;
  private logger?: Logger;

  constructor(maxSize = 1000, logger?: Logger) {
    this.maxSize = maxSize;
    this.logger = logger;
  }

  enqueue(sessionId: string, text: string): void {
    if (!this.buffers.has(sessionId)) {
      this.buffers.set(sessionId, []);
      this.droppedCounts.set(sessionId, 0);
    }
    const buf = this.buffers.get(sessionId)!;
    if (buf.length >= this.maxSize) {
      buf.shift();
      this.droppedCounts.set(sessionId, (this.droppedCounts.get(sessionId) ?? 0) + 1);
      this.logger?.warn({ sessionId, dropped: this.droppedCounts.get(sessionId) }, 'teams.buffer.overflow: oldest message evicted');
    }
    buf.push(text);
  }

  flush(sessionId: string): string[] {
    const entries = this.buffers.get(sessionId) ?? [];
    this.buffers.set(sessionId, []);
    return entries;
  }

  clear(sessionId: string): void {
    this.buffers.delete(sessionId);
    this.droppedCounts.delete(sessionId);
  }

  size(sessionId: string): number {
    return this.buffers.get(sessionId)?.length ?? 0;
  }

  droppedCount(sessionId: string): number {
    return this.droppedCounts.get(sessionId) ?? 0;
  }
}
