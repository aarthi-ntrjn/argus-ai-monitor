import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { dump as yamlDump } from 'js-yaml';
import { resolveSessionIdByPid } from '../src/services/session-pid-resolver.js';

function makeTmpDir(): string {
  return mkdtempSync(join(tmpdir(), 'argus-resolver-test-'));
}

describe('resolveSessionIdByPid', () => {
  describe('claude-code', () => {
    it('returns sessionId when pid matches a session file', () => {
      const dir = makeTmpDir();
      writeFileSync(join(dir, 'abc.json'), JSON.stringify({ pid: 1234, sessionId: 'session-abc', cwd: '/repo' }));

      const result = resolveSessionIdByPid(1234, 'claude-code', { claude: dir });
      expect(result).toBe('session-abc');
    });

    it('returns null when no file matches the pid', () => {
      const dir = makeTmpDir();
      writeFileSync(join(dir, 'abc.json'), JSON.stringify({ pid: 9999, sessionId: 'session-abc', cwd: '/repo' }));

      expect(resolveSessionIdByPid(1234, 'claude-code', { claude: dir })).toBeNull();
    });

    it('returns null when sessions dir does not exist', () => {
      expect(resolveSessionIdByPid(1234, 'claude-code', { claude: '/no/such/dir' })).toBeNull();
    });

    it('skips malformed JSON files', () => {
      const dir = makeTmpDir();
      writeFileSync(join(dir, 'bad.json'), 'not json');
      writeFileSync(join(dir, 'good.json'), JSON.stringify({ pid: 1234, sessionId: 'session-good', cwd: '/repo' }));

      expect(resolveSessionIdByPid(1234, 'claude-code', { claude: dir })).toBe('session-good');
    });
  });

  describe('copilot-cli', () => {
    it('returns sessionId when inuse.<pid>.lock exists alongside workspace.yaml', () => {
      const stateDir = makeTmpDir();
      const sessionDir = join(stateDir, 'some-session-dir');
      mkdirSync(sessionDir);
      writeFileSync(join(sessionDir, 'inuse.5678.lock'), '');
      writeFileSync(join(sessionDir, 'workspace.yaml'), yamlDump({ id: 'copilot-session-1', cwd: '/repo' }));

      expect(resolveSessionIdByPid(5678, 'copilot-cli', { copilot: stateDir })).toBe('copilot-session-1');
    });

    it('returns null when pid does not match any lock file', () => {
      const stateDir = makeTmpDir();
      const sessionDir = join(stateDir, 'some-session-dir');
      mkdirSync(sessionDir);
      writeFileSync(join(sessionDir, 'inuse.9999.lock'), '');
      writeFileSync(join(sessionDir, 'workspace.yaml'), yamlDump({ id: 'copilot-session-1', cwd: '/repo' }));

      expect(resolveSessionIdByPid(5678, 'copilot-cli', { copilot: stateDir })).toBeNull();
    });

    it('returns null when state dir does not exist', () => {
      expect(resolveSessionIdByPid(5678, 'copilot-cli', { copilot: '/no/such/dir' })).toBeNull();
    });
  });

  it('returns null for an unknown sessionType', () => {
    expect(resolveSessionIdByPid(1234, 'unknown' as any)).toBeNull();
  });
});
