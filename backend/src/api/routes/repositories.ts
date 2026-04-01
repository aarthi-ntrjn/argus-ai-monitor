import type { FastifyPluginAsync } from 'fastify';
import { randomUUID } from 'crypto';
import { basename } from 'path';
import { existsSync } from 'fs';
import { join } from 'path';
import {
  getRepositories,
  getRepository,
  insertRepository,
  deleteRepository,
  getRepositoryByPath,
} from '../../db/database.js';
import { broadcast } from '../ws/event-dispatcher.js';
import { ClaudeCodeDetector } from '../../services/claude-code-detector.js';

const repositoriesRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/v1/repositories', async (_req, reply) => {
    const repos = getRepositories();
    return reply.send(repos);
  });

  app.post<{ Body: { path?: string } }>('/api/v1/repositories', async (req, reply) => {
    const { path: repoPath } = req.body ?? {};
    if (!repoPath) return reply.status(400).send({ error: 'MISSING_PATH', message: 'path is required', requestId: req.id });

    if (!existsSync(join(repoPath, '.git'))) {
      return reply.status(400).send({ error: 'NOT_GIT_REPO', message: `The selected folder is not a git repository. To add all repos inside a parent folder, select the parent with "Add Repository".`, requestId: req.id });
    }

    const existing = getRepositoryByPath(repoPath);
    if (existing) return reply.status(409).send({ error: 'DUPLICATE', message: 'Repository already registered', repository: existing, requestId: req.id });

    const repo = {
      id: randomUUID(),
      path: repoPath,
      name: basename(repoPath),
      source: 'ui' as const,
      addedAt: new Date().toISOString(),
      lastScannedAt: null,
    };
    insertRepository(repo);
    broadcast({ type: 'repository.added', timestamp: new Date().toISOString(), data: repo as unknown as Record<string, unknown> });
    return reply.status(201).send(repo);
  });

  app.delete<{ Params: { id: string } }>('/api/v1/repositories/:id', async (req, reply) => {
    const { id } = req.params;
    const existing = getRepository(id);
    if (!existing) return reply.status(404).send({ error: 'NOT_FOUND', message: `Repository ${id} not found`, requestId: req.id });

    deleteRepository(id);

    // Remove Claude hooks if no repositories remain
    const remaining = getRepositories();
    if (remaining.length === 0) {
      new ClaudeCodeDetector().removeAllHooks();
    }

    broadcast({ type: 'repository.removed', timestamp: new Date().toISOString(), data: { id } });
    return reply.status(204).send();
  });
};

export default repositoriesRoutes;