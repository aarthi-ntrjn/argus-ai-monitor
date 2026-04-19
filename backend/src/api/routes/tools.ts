import type { FastifyPluginAsync } from 'fastify';
import * as logger from '../../utils/logger.js';
import { spawnSync } from 'child_process';
import { platform } from 'os';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import { loadConfig } from '../../config/config-loader.js';
import { ToolCommands } from '../../models/index.js';
import type { ToolCommand } from '../../models/index.js';

// Resolve argus repo root from this file's location.
// Source:   backend/src/api/routes/  -> 4 levels up = repo root
// Compiled: backend/dist/api/routes/ -> 4 levels up = repo root
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ARGUS_ROOT = path.resolve(__dirname, '..', '..', '..', '..');

const YOLO_FLAGS: Record<ToolCommand, string> = {
  claude: '--dangerously-skip-permissions',
  copilot: '--allow-all',
};

// Base command (no --cwd): safe to copy and run manually from any directory.
function buildLaunchCmdBase(tool: ToolCommand, yoloMode = false): string {
  const launchScript = path.join(ARGUS_ROOT, 'backend', 'dist', 'cli', 'launch.js');
  const base = `node "${launchScript}" ${tool}`;
  return yoloMode ? `${base} ${YOLO_FLAGS[tool]}` : base;
}

// Full command with --cwd baked in: used when the backend spawns the terminal.
function buildLaunchCmdWithCwd(tool: ToolCommand, repoPath: string, yoloMode = false): string {
  return `${buildLaunchCmdBase(tool, yoloMode)} --cwd "${repoPath}"`;
}

function isInstalled(cmd: string): boolean {
  const checker = platform() === 'win32' ? 'where' : 'which';
  const result = spawnSync(checker, [cmd], { encoding: 'utf-8', timeout: 3000 });
  return result.status === 0;
}

function isCopilotInstalled(): boolean {
  return isInstalled(ToolCommands.COPILOT);
}

// Detect whether the server can open a GUI terminal window.
// Returns false in headless environments (Codespaces, SSH-only, no display server).
function canLaunchTerminal(): boolean {
  const os = platform();
  if (os === 'win32') return true;
  if (os === 'darwin') {
    // SSH session without a local display = no GUI terminal
    return !process.env.SSH_CLIENT && !process.env.SSH_TTY;
  }
  // Linux: need a display server; Codespaces is always headless
  if (process.env.CODESPACES === 'true') return false;
  return !!(process.env.DISPLAY || process.env.WAYLAND_DISPLAY);
}

function spawnDetached(file: string, args: string[]): void {
  const child = spawn(file, args, { detached: true, stdio: 'ignore' });
  child.on('error', (err) => {
    logger.warn(`[LaunchTerminal] spawn ${file} failed: ${err.message}`);
  });
  child.unref();
}

function openTerminalWithCommand(cmd: string): void {
  logger.info(`[LaunchTerminal] opening terminal with command: ${cmd}`);
  const os = platform();

  if (os === 'win32') {
    // Prefer Windows Terminal; fall back to a plain PowerShell window.
    const wtAvailable = spawnSync('where', ['wt.exe'], { encoding: 'utf-8', timeout: 2000 }).status === 0;
    if (wtAvailable) {
      spawnDetached('wt.exe', ['new-tab', '--', 'powershell', '-NoExit', '-Command', cmd]);
    } else {
      spawnDetached('cmd.exe', ['/c', 'start', 'powershell', '-NoExit', '-Command', cmd]);
    }
    return;
  }

  if (os === 'darwin') {
    // macOS: open a new Terminal window via AppleScript.
    const escaped = cmd.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const script = `tell application "Terminal"\n  do script "${escaped}"\n  activate\nend tell`;
    spawnDetached('osascript', ['-e', script]);
    return;
  }

  // Linux: try common terminal emulators in order of preference.
  const terminals = [
    { bin: 'x-terminal-emulator', args: ['-e', cmd] },
    { bin: 'gnome-terminal',      args: ['--', 'bash', '-c', `${cmd}; exec bash`] },
    { bin: 'xterm',               args: ['-e', cmd] },
    { bin: 'konsole',             args: ['--noclose', '-e', cmd] },
  ];
  for (const t of terminals) {
    if (spawnSync('which', [t.bin], { encoding: 'utf-8', timeout: 2000 }).status === 0) {
      spawnDetached(t.bin, t.args);
      return;
    }
  }

  // No GUI terminal found (e.g. headless / Codespaces).
  throw new Error(`No GUI terminal emulator found. Run this command manually in your terminal:\n${cmd}`);
}

const toolsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/v1/tools', async (_req, reply) => {
    const hasClaude = isInstalled(ToolCommands.CLAUDE);
    const hasCopilot = isCopilotInstalled();
    const { yoloMode } = loadConfig();
    return reply.send({
      claude: hasClaude,
      copilot: hasCopilot,
      terminalAvailable: canLaunchTerminal(),
      claudeCmd: hasClaude ? buildLaunchCmdBase(ToolCommands.CLAUDE, yoloMode) : undefined,
      copilotCmd: hasCopilot ? buildLaunchCmdBase(ToolCommands.COPILOT, yoloMode) : undefined,
    });
  });

  app.post<{ Body: { tool: ToolCommand; repoPath?: string } }>(
    '/api/v1/sessions/launch-terminal',
    {
      schema: {
        body: {
          type: 'object',
          required: ['tool'],
          properties: {
            tool: { type: 'string', enum: [ToolCommands.CLAUDE, ToolCommands.COPILOT] },
            repoPath: { type: 'string' },
          },
        },
      },
    },
    async (req, reply) => {
      const { tool, repoPath } = req.body;
      const { yoloMode } = loadConfig();
      const cmd = repoPath
        ? buildLaunchCmdWithCwd(tool, repoPath, yoloMode)
        : buildLaunchCmdBase(tool, yoloMode);
      try {
        openTerminalWithCommand(cmd);
        return reply.status(202).send({ status: 'launched' });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.warn(`[LaunchTerminal] ${message}`);
        return reply.status(422).send({ status: 'no-terminal', message, cmd });
      }
    }
  );
};

export default toolsRoutes;

