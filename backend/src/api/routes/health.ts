import type { FastifyPluginAsync } from 'fastify';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/health', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            version: { type: 'string' },
            uptime: { type: 'number' },
          },
        },
      },
    },
  }, async (_req, reply) => {
    // Read version from package.json
    let version = '1.0.0';
    try {
      const require = createRequire(import.meta.url);
      const pkg = require(join(__dirname, '..', '..', '..', 'package.json'));
      version = (pkg as { version?: string }).version ?? '1.0.0';
    } catch { /* use default */ }

    return reply.send({ status: 'ok', version, uptime: process.uptime() });
  });
};

export default healthRoutes;
