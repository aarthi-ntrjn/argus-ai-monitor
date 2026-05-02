import { promises as fs, existsSync } from 'fs';
import { join, basename } from 'path';
import { randomUUID } from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getRepositories, insertRepository, getRepositoryByPath } from '../db/database.js';
import type { Repository } from '../models/index.js';
import { broadcast } from '../api/ws/event-dispatcher.js';

const execAsync = promisify(exec);

const branchCache = new Map<string, { value: string | null; timestamp: number }>();
const BRANCH_CACHE_TTL_MS = 30_000;

export async function getCurrentBranch(repoPath: string): Promise<string | null> {
  const cached = branchCache.get(repoPath);
  if (cached && Date.now() - cached.timestamp < BRANCH_CACHE_TTL_MS) {
    return cached.value;
  }
  try {
    const { stdout } = await execAsync('git branch --show-current', { cwd: repoPath });
    const value = stdout.trim() || null;
    branchCache.set(repoPath, { value, timestamp: Date.now() });
    return value;
  } catch {
    return null;
  }
}

export async function getRemoteUrl(repoPath: string): Promise<string | null> {
  try {
    const { stdout } = await execAsync('git remote get-url origin', { cwd: repoPath });
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

const DEFAULT_BRANCHES = new Set(['master', 'main']);

export function buildGitHubCompareUrl(remoteUrl: string | null | undefined, branch: string | null | undefined): string | null {
  if (!remoteUrl || !branch) return null;

  let baseUrl: string | null = null;

  if (remoteUrl.startsWith('https://github.com/')) {
    baseUrl = remoteUrl.replace(/\.git$/, '');
  } else if (remoteUrl.startsWith('git@github.com:')) {
    const path = remoteUrl.slice('git@github.com:'.length).replace(/\.git$/, '');
    baseUrl = `https://github.com/${path}`;
  }

  if (!baseUrl) return null;

  if (DEFAULT_BRANCHES.has(branch)) {
    return `${baseUrl}/compare`;
  }
  const defaultBase = 'master';
  return `${baseUrl}/compare/${defaultBase}...${branch}`;
}

export class RepositoryScanner {
  constructor(private watchDirectories: string[]) {}

  async scan(): Promise<Repository[]> {
    const found: Repository[] = [];
    for (const dir of this.watchDirectories) {
      if (!existsSync(dir)) continue;
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
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

  async registerPath(repoPath: string): Promise<Repository> {
    if (!this.hasGit(repoPath)) {
      throw new Error(`No .git directory found at: ${repoPath}`);
    }
    return this.registerIfNew(repoPath, 'ui');
  }

  private async registerIfNew(repoPath: string, source: 'config' | 'ui'): Promise<Repository> {
    const existing = getRepositoryByPath(repoPath);
    if (existing) return existing;

    const [branch, remoteUrl] = await Promise.all([
      getCurrentBranch(repoPath),
      getRemoteUrl(repoPath),
    ]);

    const repo: Repository = {
      id: randomUUID(),
      path: repoPath,
      name: basename(repoPath),
      source,
      addedAt: new Date().toISOString(),
      lastScannedAt: new Date().toISOString(),
      branch,
      remoteUrl,
    };
    insertRepository(repo);
    broadcast({ type: 'repository.added', timestamp: new Date().toISOString(), data: repo });
    return repo;
  }
}
