import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { findGitRepos } from '../../src/api/routes/fs.js';

function makeGitRepo(base: string, ...parts: string[]): string {
  const dir = join(base, ...parts);
  mkdirSync(dir, { recursive: true });
  mkdirSync(join(dir, '.git'), { recursive: true });
  return dir;
}

describe('findGitRepos()', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'argus-test-'));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it('returns the folder itself when it is a git repo', () => {
    mkdirSync(join(tmp, '.git'));
    const results = findGitRepos(tmp);
    expect(results).toHaveLength(1);
    expect(results[0].path).toBe(tmp);
  });

  it('returns nested git repos from a parent folder', () => {
    makeGitRepo(tmp, 'repo-a');
    makeGitRepo(tmp, 'repo-b');
    const results = findGitRepos(tmp);
    expect(results).toHaveLength(2);
    expect(results.map(r => r.name).sort()).toEqual(['repo-a', 'repo-b']);
  });

  it('does not recurse inside a found git repo', () => {
    const outer = makeGitRepo(tmp, 'outer');
    mkdirSync(join(outer, 'inner', '.git'), { recursive: true });
    const results = findGitRepos(tmp);
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('outer');
  });

  it('skips node_modules entirely', () => {
    const nm = join(tmp, 'node_modules', 'some-pkg');
    mkdirSync(join(nm, '.git'), { recursive: true });
    const results = findGitRepos(tmp);
    expect(results).toHaveLength(0);
  });

  it('returns empty array when no git repos found', () => {
    mkdirSync(join(tmp, 'empty-folder'));
    const results = findGitRepos(tmp);
    expect(results).toHaveLength(0);
  });

  it('name field is the last path segment', () => {
    makeGitRepo(tmp, 'my-project');
    const results = findGitRepos(tmp);
    expect(results[0].name).toBe('my-project');
  });

  it('finds repos at multiple depths', () => {
    makeGitRepo(tmp, 'shallow');
    makeGitRepo(tmp, 'deep', 'nested', 'repo');
    const results = findGitRepos(tmp);
    expect(results).toHaveLength(2);
    const names = results.map(r => r.name).sort();
    expect(names).toContain('shallow');
    expect(names).toContain('repo');
  });
});
