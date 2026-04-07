import type { FastifyPluginAsync } from 'fastify';
import { spawnSync } from 'child_process';
import { platform } from 'os';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

// Resolve argus repo root from this file's location:
// backend/src/api/routes/tools.ts -> up 4 levels
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ARGUS_ROOT = path.resolve(__dirname, '..', '..', '..', '..', '..');

const TSX = platform() === 'win32'
  ? path.join(ARGUS_ROOT, 'node_modules', '.bin', 'tsx.cmd')
  : path.join(ARGUS_ROOT, 'node_modules', '.bin', 'tsx');

const LAUNCH_SCRIPT = path.join(ARGUS_ROOT, 'backend', 'src', 'cli', 'launch.ts');

function buildLaunchCmd(tool: 'claude' | 'copilot'): string {
  const toolArg = tool === 'copilot' ? 'gh copilot suggest' : 'claude';
  return `"${TSX}" "${LAUNCH_SCRIPT}" ${toolArg}`;
}

function isInstalled(cmd: string): boolean {
  const checker = platform() === 'win32' ? 'where' : 'which';
  const result = spawnSync(checker, [cmd], { encoding: 'utf-8', timeout: 3000 });
  return result.status === 0;
}

function openTerminalWithCommand(cmd: string, repoPath?: string): void {
  const cdCmd = repoPath
    ? (platform() === 'win32' ? `cd /d "${repoPath}" && ` : `cd '${repoPath}' && `)
    : '';
  const fullCmd = `${cdCmd}${cmd}`;

  if (platform() === 'win32') {
    const wtResult = spawnSync('where', ['wt.exe'], { encoding: 'utf-8', timeout: 2000 });
    if (wtResult.status === 0) {
      spawn('wt.exe', ['new-tab', '--', 'powershell', '-NoExit', '-Command', fullCmd], {
        detached: true, stdio: 'ignore',
      }).unref();
    } else {
      spawn('cmd.exe', ['/c', 'start', 'powershell', '-NoExit', '-Command', fullCmd], {
        detached: true, stdio: 'ignore', shell: false,
      }).unref();
    }
  } else {
    const script = `tell application "Terminal" to do script "${fullCmd.replace(/"/g, '\\"')}"`;
    spawn('osascript', ['-e', script], { detached: true, stdio: 'ignore' }).unref();
  }
}

const toolsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/v1/tools', async (_req, reply) => {
    const hasClaude = isInstalled('claude');
    const hasCopilot = isInstalled('gh');
    return reply.send({
      claude: hasClaude,
      copilot: hasCopilot,
      claudeCmd: hasClaude ? buildLaunchCmd('claude') : undefined,
      copilotCmd: hasCopilot ? buildLaunchCmd('copilot') : undefined,
    });
  });

  app.post<{ Body: { tool: 'claude' | 'copilot'; repoPath?: string } }>(
    '/api/v1/sessions/launch-terminal',
    {
      schema: {
        body: {
          type: 'object',
          required: ['tool'],
          properties: {
            tool: { type: 'string', enum: ['claude', 'copilot'] },
            repoPath: { type: 'string' },
          },
        },
      },
    },
    async (req, reply) => {
      const { tool, repoPath } = req.body;
      openTerminalWithCommand(buildLaunchCmd(tool), repoPath);
      return reply.status(202).send({ status: 'launched' });
    }
  );
};

export default toolsRoutes;
