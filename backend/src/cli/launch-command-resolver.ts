import { SessionTypes, ToolCommands } from '../models/index.js';
import type { SessionType } from '../models/index.js';

export interface LaunchCommand {
  sessionType: SessionType;
  cmd: string;
  cmdArgs: string[];
}

export function resolveLaunchCommand(args: string[]): LaunchCommand {
  if (args.length === 0) {
    throw new Error('No command provided. Usage: argus launch <command> [args...]');
  }

  const [cmd, ...cmdArgs] = args;

  if (cmd === ToolCommands.CLAUDE) {
    return { sessionType: SessionTypes.CLAUDE_CODE, cmd, cmdArgs };
  }

  // GitHub Copilot CLI (standalone)
  if (cmd === ToolCommands.COPILOT) {
    return { sessionType: SessionTypes.COPILOT_CLI, cmd, cmdArgs };
  }

  // Default: assume claude-code for unknown commands
  return { sessionType: SessionTypes.CLAUDE_CODE, cmd, cmdArgs };
}
