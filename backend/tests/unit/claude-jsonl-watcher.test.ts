import { describe, it, expect, vi } from 'vitest';
import { homedir } from 'os';
import { join } from 'path';

// Capture the path passed to chokidar.watch
const mockWatch = vi.fn(() => ({ on: vi.fn(), close: vi.fn().mockResolvedValue(undefined) }));
vi.mock('chokidar', () => ({ default: { watch: mockWatch } }));

// Make existsSync return true so attachWatcher does not bail out early
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return { ...actual, existsSync: vi.fn(() => true) };
});

// Stub fsStat so attachWatcher can read the file size
vi.mock('fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs/promises')>();
  return { ...actual, stat: vi.fn().mockResolvedValue({ size: 0 }), open: vi.fn().mockResolvedValue({ read: vi.fn().mockResolvedValue({ bytesRead: 0 }), close: vi.fn() }) };
});

vi.mock('../../src/db/database.js', () => ({ getMaxSequenceNumber: vi.fn(() => 0) }));
vi.mock('../../src/services/output-store.js', () => ({
  OutputStore: vi.fn().mockImplementation(() => ({ insertOutput: vi.fn() })),
}));
vi.mock('../../src/services/watcher-session-helpers.js', () => ({
  applyActivityUpdate: vi.fn(),
  applyModelUpdate: vi.fn(),
  applySummaryUpdate: vi.fn(),
}));

describe('ClaudeJsonlWatcher — claudeProjectDirName', () => {
  it('replaces spaces in repo path with hyphens when building the JSONL file path', async () => {
    const { ClaudeJsonlWatcher } = await import('../../src/services/claude-jsonl-watcher.js');
    const watcher = new ClaudeJsonlWatcher();
    await watcher.watchFile('session-abc', '/home/my user/my project');

    expect(mockWatch).toHaveBeenCalled();
    const watchedPath: string = mockWatch.mock.calls[0][0] as string;
    const expectedDir = join(homedir(), '.claude', 'projects', '-home-my-user-my-project');
    expect(watchedPath).toContain(expectedDir);
    expect(watchedPath).toContain('session-abc.jsonl');
  });

  it('replaces path separators with hyphens', async () => {
    mockWatch.mockClear();
    const { ClaudeJsonlWatcher } = await import('../../src/services/claude-jsonl-watcher.js');
    const watcher = new ClaudeJsonlWatcher();
    await watcher.watchFile('session-def', '/home/user/myrepo');

    const watchedPath: string = mockWatch.mock.calls[0][0] as string;
    const expectedDir = join(homedir(), '.claude', 'projects', '-home-user-myrepo');
    expect(watchedPath).toContain(expectedDir);
  });
});
