import { describe, it, expect } from 'vitest';
import { homedir } from 'os';
import { join, sep } from 'path';
import { isPathWithinBoundary } from '../../src/utils/path-sandbox.js';

const home = homedir();
const allowedBoundaries = [home, 'C:\\repos\\myproject', '/home/user/projects/myrepo'];

describe('isPathWithinBoundary', () => {
  it('allows a path equal to the boundary', () => {
    expect(isPathWithinBoundary(home, allowedBoundaries)).toBe(true);
  });

  it('allows a direct child of the boundary', () => {
    expect(isPathWithinBoundary(join(home, 'documents'), allowedBoundaries)).toBe(true);
  });

  it('allows a deeply nested path within the boundary', () => {
    expect(isPathWithinBoundary(join(home, 'documents', 'projects', 'foo'), allowedBoundaries)).toBe(true);
  });

  it('rejects a path that is a sibling of the boundary (not a child)', () => {
    // e.g. boundary is /home/user, reject /home/userother
    const sibling = home.slice(0, home.lastIndexOf(sep)) + sep + 'adversarial';
    expect(isPathWithinBoundary(sibling, allowedBoundaries)).toBe(false);
  });

  it('resolves and rejects traversal sequences that escape the boundary', () => {
    // join(home, '../../etc') resolves outside home
    const traversal = join(home, '..', '..', 'etc', 'passwd');
    expect(isPathWithinBoundary(traversal, allowedBoundaries)).toBe(false);
  });

  it('rejects a Windows system path', () => {
    expect(isPathWithinBoundary('C:\\Windows\\System32', allowedBoundaries)).toBe(false);
  });

  it('rejects an arbitrary root path', () => {
    expect(isPathWithinBoundary('/etc/shadow', allowedBoundaries)).toBe(false);
  });

  it('accepts the second boundary exactly', () => {
    expect(isPathWithinBoundary('C:\\repos\\myproject', allowedBoundaries)).toBe(true);
  });

  it('accepts a child of the second boundary', () => {
    expect(isPathWithinBoundary('C:\\repos\\myproject\\src', allowedBoundaries)).toBe(true);
  });

  it('does not allow a path that merely starts with the boundary string without a separator', () => {
    // 'C:\\repos\\myprojectextra' must NOT match boundary 'C:\\repos\\myproject'
    expect(isPathWithinBoundary('C:\\repos\\myprojectextra', allowedBoundaries)).toBe(false);
  });

  it('returns false when no boundaries are provided', () => {
    expect(isPathWithinBoundary(home, [])).toBe(false);
  });
});
