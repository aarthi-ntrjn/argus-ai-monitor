import { resolve, sep } from 'path';

export function isPathWithinBoundary(inputPath: string, allowedBoundaries: string[]): boolean {
  const resolved = resolve(inputPath);
  return allowedBoundaries.some(
    boundary => resolved === boundary || resolved.startsWith(boundary + sep),
  );
}
