import { readdirSync, existsSync } from 'fs';
import { join, basename } from 'path';
import { randomUUID } from 'crypto';
import { execSync } from 'child_process';
import { getRepositories, insertRepository, getRepositoryByPath } from '../db/database.js';
import type { Repository } from '../models/index.js';
import { broadcast } from '../api/ws/event-dispatcher.js';

export function getCurrentBranch(repoPath: string): string | null {
  try {
    const branch = execSync('git branch --show-current', { cwd: repoPath, encoding: 'utf8' }).trim();
    return branch || null;
  } catch {
    return null;
  }
}

export class RepositoryScanner {
  constructor(private watchDirectories: string[]) {}

  async scan(): Promise<Repository[]> {
    const found: Repository[] = [];
    for (const dir of this.watchDirectories) {
      if (!existsSync(dir)) continue;
      try {
        const entries = readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          const fullPath = join(dir, entry.name);
          if (this.hasGit(fullPath)) {
            found.push(await this.registerIfNew(fullPath, 'config'));
          }
        }
      } catch { /* ignore permission errors */ }
    }
    return found;
  }

  private hasGit(dirPath: string): boolean {
    return existsSync(join(dirPath, '.git'));
  }

  async validatePath(repoPath: string): Promise<boolean> {
    return existsSync(join(repoPath, '.git'));
  }

  async registerPath(repoPath: string): Promise<Repository> {
    if (!this.hasGit(repoPath)) {
      throw new Error(`No .git directory found at: ${repoPath}`);
    }
    return this.registerIfNew(repoPath, 'ui');
  }

  private async registerIfNew(repoPath: string, source: 'config' | 'ui'): Promise<Repository> {
    const existing = getRepositoryByPath(repoPath);
    if (existing) return existing;

    const repo: Repository = {
      id: randomUUID(),
      path: repoPath,
      name: basename(repoPath),
      source,
      addedAt: new Date().toISOString(),
      lastScannedAt: new Date().toISOString(),
      branch: getCurrentBranch(repoPath),
    };
    insertRepository(repo);
    broadcast({ type: 'repository.added', timestamp: new Date().toISOString(), data: repo as unknown as Record<string, unknown> });
    return repo;
  }
}