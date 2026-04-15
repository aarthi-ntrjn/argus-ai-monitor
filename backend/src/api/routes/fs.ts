import { FastifyInstance } from 'fastify';
import { promises as fsPromises, existsSync } from 'fs';
import { join, normalize, basename } from 'path';

export async function findGitRepos(dirPath: string, results: Array<{ path: string; name: string }> = []): Promise<Array<{ path: string; name: string }>> {
  // If this dir is itself a git repo, add it and don't recurse into it
  if (existsSync(join(dirPath, '.git'))) {
    results.push({ path: dirPath, name: basename(dirPath) });
    return results;
  }
  let entries;
  try {
    entries = await fsPromises.readdir(dirPath, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const fullPath = join(dirPath, entry.name);
    try {
      const stat = await fsPromises.lstat(fullPath);
      // FR-010: skip symlinks to avoid loops
      if (stat.isSymbolicLink() || !stat.isDirectory()) continue;
    } catch {
      continue;
    }
    await findGitRepos(fullPath, results);
  }
  return results;
}

export async function fsRoutes(app: FastifyInstance) {
  app.post('/api/v1/fs/scan-folder', async (request, reply) => {
    const body = request.body as { path?: string };
    const scanPath = body?.path ? normalize(body.path) : null;
    if (!scanPath) {
      return reply.status(400).send({ error: 'MISSING_PATH', message: 'path is required', requestId: request.id });
    }

    if (!existsSync(scanPath)) {
      return reply.status(404).send({ error: 'PATH_NOT_FOUND', message: 'The specified folder does not exist.', requestId: request.id });
    }
    app.log.info({ scanPath }, 'Starting recursive git repo scan');
    try {
      const repos = await findGitRepos(scanPath);
      app.log.info({ scanPath, count: repos.length }, 'Scan complete');
      return reply.send({ repos });
    } catch (err) {
      app.log.error({ scanPath, err }, 'Scan failed');
      return reply.status(500).send({ error: 'SCAN_FAILED', message: 'Failed to scan folder.', requestId: request.id, repos: [] });
    }
  });
}

