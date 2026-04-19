import { describe, it, expect, vi, beforeEach } from 'vitest';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import type { SessionOutput } from '../../src/models/index.js';

// Mock chokidar — capture the 'change' handler so tests can trigger it
let capturedChangeHandler: (() => void) | null = null;
const mockWatcherOn = vi.fn((event: string, handler: () => void) => {
  if (event === 'change') capturedChangeHandler = handler;
  return mockFsWatcher;
});
const mockWatcherClose = vi.fn().mockResolvedValue(undefined);
const mockFsWatcher = { on: mockWatcherOn, close: mockWatcherClose };
vi.mock('chokidar', () => ({
  default: { watch: vi.fn(() => mockFsWatcher) },
}));

// Mock getMaxSequenceNumber — controls the sequence counter starting point
const mockGetMaxSeq = vi.hoisted(() => vi.fn(() => 0));
vi.mock('../../src/db/database.js', () => ({
  getMaxSequenceNumber: mockGetMaxSeq,
}));

// Mock OutputStore — capture insertOutput calls and control return value
const mockInsertOutput = vi.hoisted(() => vi.fn((_id: string, _outputs: SessionOutput[]) => true));
vi.mock('../../src/services/output-store.js', () => ({
  OutputStore: vi.fn().mockImplementation(() => ({ insertOutput: mockInsertOutput })),
}));

// Mock watcher-session-helpers — observe side-effect calls
const mockApplyActivity = vi.hoisted(() => vi.fn());
const mockApplyModel = vi.hoisted(() => vi.fn());
const mockApplySummary = vi.hoisted(() => vi.fn());
vi.mock('../../src/services/watcher-session-helpers.js', () => ({
  applyActivityUpdate: mockApplyActivity,
  applyModelUpdate: mockApplyModel,
  applySummaryUpdate: mockApplySummary,
}));

import { JsonlWatcherBase, TAIL_BYTES } from '../../src/services/jsonl-watcher-base.js';

// Minimal concrete subclass — parseLine returns one output per non-empty line
class TestWatcher extends JsonlWatcherBase {
  protected readonly tag = '[Test]';
  readonly parseLineArgs: Array<{ line: string; seq: number; id: string }> = [];

  protected parseLine(
    line: string,
    sessionId: string,
    seq: number,
    makeId: (blockIndex: number) => string,
  ): SessionOutput[] {
    const id = makeId(0);
    this.parseLineArgs.push({ line, seq, id });
    if (!line.trim()) return [];
    return [{
      id,
      sessionId,
      timestamp: '2024-01-01T00:00:00.000Z',
      type: 'message',
      content: line.trim(),
      toolName: null,
      toolCallId: null,
      role: 'assistant',
      sequenceNumber: seq,
      isMeta: false,
    }];
  }

  async watch(sessionId: string, filePath: string) {
    await this.attachWatcher(sessionId, filePath);
  }

  stopAll() {
    this.stopWatchers();
  }

  hasWatcher(sessionId: string) {
    return this.watchers.has(sessionId);
  }

  getFilePosition(sessionId: string) {
    return this.filePositions.get(sessionId);
  }

  getSequenceCounter(sessionId: string) {
    return this.sequenceCounters.get(sessionId);
  }
}

function writeTempJsonl(content: string): string {
  const dir = join(tmpdir(), `argus-watcher-test-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, 'output.jsonl');
  writeFileSync(file, content, 'utf-8');
  return file;
}

beforeEach(() => {
  capturedChangeHandler = null;
  mockWatcherOn.mockClear();
  mockWatcherClose.mockClear();
  mockInsertOutput.mockClear();
  mockApplyActivity.mockClear();
  mockApplyModel.mockClear();
  mockApplySummary.mockClear();
  mockGetMaxSeq.mockReturnValue(0);
});

describe('JsonlWatcherBase — attachWatcher', () => {
  it('does nothing when the file does not exist', async () => {
    const watcher = new TestWatcher();
    await watcher.watch('s1', '/nonexistent/path/output.jsonl');
    expect(watcher.hasWatcher('s1')).toBe(false);
    expect(mockInsertOutput).not.toHaveBeenCalled();
  });

  it('does not attach twice for the same session', async () => {
    const file = writeTempJsonl('{"line":1}\n');
    const watcher = new TestWatcher();
    await watcher.watch('s1', file);
    await watcher.watch('s1', file); // second call must be ignored
    expect(mockWatcherOn).toHaveBeenCalledTimes(1);
  });

  it('reads from offset 0 when file is smaller than TAIL_BYTES', async () => {
    const file = writeTempJsonl('line1\nline2\n');
    const watcher = new TestWatcher();
    await watcher.watch('s1', file);
    // Position after reading should equal file size (all bytes consumed)
    const pos = watcher.getFilePosition('s1') ?? -1;
    expect(pos).toBeGreaterThan(0);
    // Lines were parsed
    expect(watcher.parseLineArgs.length).toBe(2);
    expect(watcher.parseLineArgs[0].line).toBe('line1');
    expect(watcher.parseLineArgs[1].line).toBe('line2');
  });

  it('reads from fileSize - TAIL_BYTES when file exceeds TAIL_BYTES', async () => {
    // Fill a buffer larger than TAIL_BYTES, then add a recognisable tail line
    const padding = 'x'.repeat(TAIL_BYTES) + '\n';
    const tailLine = 'tail-marker\n';
    const file = writeTempJsonl(padding + tailLine);
    const watcher = new TestWatcher();
    await watcher.watch('s1', file);
    // Only the tail content should have been parsed
    expect(watcher.parseLineArgs.some(a => a.line.includes('tail-marker'))).toBe(true);
    // The padding line should NOT appear (it was skipped)
    expect(watcher.parseLineArgs.some(a => a.line === 'x'.repeat(TAIL_BYTES))).toBe(false);
  });

  it('initialises sequence counter from getMaxSequenceNumber + 1', async () => {
    // Counter is initialised to maxSeq+1=42; the loop increments before use, so first entry gets 43.
    mockGetMaxSeq.mockReturnValue(41);
    const file = writeTempJsonl('line1\n');
    const watcher = new TestWatcher();
    await watcher.watch('s1', file);
    expect(watcher.parseLineArgs[0].seq).toBe(43);
  });

  it('produces stable IDs in format sessionId-byteOffset-blockIndex', async () => {
    const file = writeTempJsonl('hello\n');
    const watcher = new TestWatcher();
    await watcher.watch('s1', file);
    expect(watcher.parseLineArgs[0].id).toMatch(/^s1-\d+-0$/);
  });

  it('registers a chokidar watcher on the file', async () => {
    const file = writeTempJsonl('line1\n');
    const watcher = new TestWatcher();
    await watcher.watch('s1', file);
    expect(watcher.hasWatcher('s1')).toBe(true);
    expect(mockWatcherOn).toHaveBeenCalledWith('change', expect.any(Function));
  });
});

describe('JsonlWatcherBase — readNewLines', () => {
  it('calls applyActivityUpdate only when new outputs are inserted', async () => {
    const file = writeTempJsonl('line1\n');
    const watcher = new TestWatcher();
    mockInsertOutput.mockReturnValue(true);
    await watcher.watch('s1', file);
    expect(mockApplyActivity).toHaveBeenCalledTimes(1);
  });

  it('does NOT call applyActivityUpdate when insertOutput returns false (all duplicates)', async () => {
    const file = writeTempJsonl('line1\n');
    const watcher = new TestWatcher();
    mockInsertOutput.mockReturnValue(false);
    await watcher.watch('s1', file);
    expect(mockApplyActivity).not.toHaveBeenCalled();
  });

  it('calls applySummaryUpdate with parsed outputs', async () => {
    const file = writeTempJsonl('hello\n');
    const watcher = new TestWatcher();
    await watcher.watch('s1', file);
    expect(mockApplySummary).toHaveBeenCalledWith('s1', expect.any(Array), '[Test]');
  });

  it('detects model from Claude format (message.model)', async () => {
    const line = JSON.stringify({ type: 'assistant', message: { model: 'claude-opus-4-5' } });
    const file = writeTempJsonl(line + '\n');
    const watcher = new TestWatcher();
    await watcher.watch('s1', file);
    expect(mockApplyModel).toHaveBeenCalledWith('s1', 'claude-opus-4-5', '[Test]');
  });

  it('detects model from Copilot flat format (top-level model)', async () => {
    const line = JSON.stringify({ type: 'assistant.message', model: 'gpt-4o' });
    const file = writeTempJsonl(line + '\n');
    const watcher = new TestWatcher();
    await watcher.watch('s1', file);
    expect(mockApplyModel).toHaveBeenCalledWith('s1', 'gpt-4o', '[Test]');
  });

  it('does not call applyModelUpdate when no model is present in the JSONL', async () => {
    const file = writeTempJsonl('plain text line\n');
    const watcher = new TestWatcher();
    await watcher.watch('s1', file);
    expect(mockApplyModel).not.toHaveBeenCalled();
  });

  it('appends only newly written lines on subsequent reads via chokidar trigger', async () => {
    const file = writeTempJsonl('line1\n');
    const watcher = new TestWatcher();
    await watcher.watch('s1', file);
    expect(watcher.parseLineArgs.length).toBe(1);

    // Simulate new content being appended to the file
    const { appendFileSync } = await import('fs');
    appendFileSync(file, 'line2\n', 'utf-8');

    // Trigger the chokidar change event — the handler fires readNewLines as a floating promise,
    // so we wait a short time for the async work to settle.
    expect(capturedChangeHandler).not.toBeNull();
    capturedChangeHandler!();
    await new Promise(r => setTimeout(r, 50));

    expect(watcher.parseLineArgs.length).toBe(2);
    expect(watcher.parseLineArgs[1].line).toBe('line2');
  });
});

describe('JsonlWatcherBase — stopWatchers', () => {
  it('closes all chokidar watchers and clears internal state', async () => {
    const file1 = writeTempJsonl('a\n');
    const file2 = writeTempJsonl('b\n');
    const watcher = new TestWatcher();
    await watcher.watch('s1', file1);
    await watcher.watch('s2', file2);

    watcher.stopAll();

    expect(mockWatcherClose).toHaveBeenCalledTimes(2);
    expect(watcher.hasWatcher('s1')).toBe(false);
    expect(watcher.hasWatcher('s2')).toBe(false);
    expect(watcher.getFilePosition('s1')).toBeUndefined();
    expect(watcher.getSequenceCounter('s1')).toBeUndefined();
  });
});
