import type { FastifyPluginAsync } from 'fastify';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { loadTeamsConfig } from '../../config/teams-config-loader.js';

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
            teams: {
              type: 'object',
              properties: {
                enabled: { type: 'boolean' },
                status: { type: 'string' },
              },
            },
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

    const teamsConfig = loadTeamsConfig();
    const teamsAuthenticated = teamsConfig.enabled && (
      Boolean((teamsConfig as any).botAppSecret) || Boolean((teamsConfig as any).botCertPath)
    );
    const teams = {
      enabled: teamsConfig.enabled,
      status: teamsConfig.enabled ? (teamsAuthenticated ? 'authenticated' : 'configured') : 'unconfigured',
    };
    return reply.send({ status: 'ok', version, uptime: process.uptime(), teams });
  });
};

export default healthRoutes;
