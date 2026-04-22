import { resolve, sep } from 'path';
import { homedir } from 'os';

export function expandTilde(p: string): string {
  if (p === '~' || p.startsWith('~/') || p.startsWith('~\\')) {
    return homedir() + p.slice(1);
  }
  return p;
}

export function isPathWithinBoundary(inputPath: string, allowedBoundaries: string[]): boolean {
  // On non-Windows, a path starting with a drive letter (e.g. C:\...) is not a
  // valid absolute path — reject immediately rather than letting resolve() treat
  // it as relative to CWD, which could cause it to land inside an allowed boundary.
  if (process.platform !== 'win32' && /^[a-zA-Z]:[/\\]/.test(inputPath)) {
    return false;
  }
  const resolved = resolve(inputPath);
  return allowedBoundaries.some(
    boundary => resolved === boundary || resolved.startsWith(boundary + sep),
  );
}

