import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClaudeSessionRegistry } from '../../src/services/claude-session-registry.js';

// Mock fs
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readdirSync: vi.fn(),
  readFileSync: vi.fn(),
}));

import { existsSync, readdirSync, readFileSync } from 'fs';

const mockExistsSync = vi.mocked(existsSync);
const mockReaddirSync = vi.mocked(readdirSync);
const mockReadFileSync = vi.mocked(readFileSync);

describe('ClaudeSessionRegistry', () => {
  let registry: ClaudeSessionRegistry;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = new ClaudeSessionRegistry();
  });

  it('returns entries from valid JSON files', () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue(['54428.json', '12345.json'] as unknown as ReturnType<typeof readdirSync>);
    mockReadFileSync
      .mockReturnValueOnce(JSON.stringify({
        pid: 54428,
        sessionId: 'sess-aaa',
        cwd: 'C:\\repo1',
        startedAt: 1000,
        kind: 'interactive',
        entrypoint: 'cli',
      }))
      .mockReturnValueOnce(JSON.stringify({
        pid: 12345,
        sessionId: 'sess-bbb',
        cwd: 'C:\\repo2',
        startedAt: 2000,
        kind: 'interactive',
        entrypoint: 'cli',
      }));

    const entries = registry.scanEntries();
    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual({
      pid: 54428,
      sessionId: 'sess-aaa',
      cwd: 'C:\\repo1',
      startedAt: 1000,
      kind: 'interactive',
      entrypoint: 'cli',
    });
    expect(entries[1]).toEqual({
      pid: 12345,
      sessionId: 'sess-bbb',
      cwd: 'C:\\repo2',
      startedAt: 2000,
      kind: 'interactive',
      entrypoint: 'cli',
    });
  });

  it('returns empty array when directory does not exist', () => {
    mockExistsSync.mockReturnValue(false);
    expect(registry.scanEntries()).toEqual([]);
  });

  it('returns empty array when directory is empty', () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue([] as unknown as ReturnType<typeof readdirSync>);
    expect(registry.scanEntries()).toEqual([]);
  });

  it('skips malformed JSON files', () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue(['bad.json', '99.json'] as unknown as ReturnType<typeof readdirSync>);
    mockReadFileSync
      .mockReturnValueOnce('not json')
      .mockReturnValueOnce(JSON.stringify({
        pid: 99,
        sessionId: 'sess-ccc',
        cwd: '/repo',
        startedAt: 3000,
        kind: 'interactive',
        entrypoint: 'cli',
      }));

    const entries = registry.scanEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].pid).toBe(99);
  });

  it('skips files missing required fields', () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue(['1.json'] as unknown as ReturnType<typeof readdirSync>);
    mockReadFileSync.mockReturnValue(JSON.stringify({ pid: 1 }));

    expect(registry.scanEntries()).toEqual([]);
  });

  it('only reads .json files', () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue(['54428.json', 'readme.txt', '.gitkeep'] as unknown as ReturnType<typeof readdirSync>);
    mockReadFileSync.mockReturnValue(JSON.stringify({
      pid: 54428,
      sessionId: 'sess-ddd',
      cwd: '/repo',
      startedAt: 4000,
      kind: 'interactive',
      entrypoint: 'cli',
    }));

    const entries = registry.scanEntries();
    expect(entries).toHaveLength(1);
    expect(mockReadFileSync).toHaveBeenCalledTimes(1);
  });
});
