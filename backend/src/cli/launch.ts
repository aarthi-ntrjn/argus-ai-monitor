#!/usr/bin/env node
import { spawn } from 'node-pty';
import { execSync } from 'child_process';
import { randomUUID } from 'crypto';
import { platform } from 'os';
import { resolveLaunchCommand } from './launch-command-resolver.js';
import { ArgusLaunchClient } from './argus-launch-client.js';

// Parse --cwd <path> out of argv before passing the rest to resolveLaunchCommand.
// This is needed because npm --workspace changes cwd to the workspace root, so we
// cannot rely on process.cwd() to know which repo the user wants to work in.
const rawArgs = process.argv.slice(2);
let cwd = process.cwd();
const toolArgs: string[] = [];
for (let i = 0; i < rawArgs.length; i++) {
  if ((rawArgs[i] === '--cwd' || rawArgs[i] === '-cwd') && rawArgs[i + 1]) {
    cwd = rawArgs[++i];
  } else {
    toolArgs.push(rawArgs[i]);
  }
}

if (toolArgs.length === 0) {
  process.stderr.write('Usage: argus launch <command> [args...] [--cwd <path>]\n');
  process.stderr.write('Examples:\n');
  process.stderr.write('  argus launch claude\n');
  process.stderr.write('  argus launch claude --cwd /path/to/repo\n');
  process.stderr.write('  argus launch gh copilot suggest --cwd /path/to/repo\n');
  process.exit(1);
}

const { sessionType, cmd, cmdArgs } = resolveLaunchCommand(toolArgs);
const sessionId = randomUUID();

// On Windows, node-pty's ConPTY API requires a real .exe — .cmd/.bat scripts
// (like claude.cmd, copilot.cmd) must be run through a shell.
// Spawn powershell.exe and pass the command as a -Command string.
const isWin = platform() === 'win32';
const ptyFile = isWin ? 'powershell.exe' : cmd;
const ptyArgs = isWin
  ? ['-NoProfile', '-Command', [cmd, ...cmdArgs].join(' ')]
  : cmdArgs;

// Strip parent Claude Code env vars so the child session starts fresh
// instead of trying to connect to/continue the parent session.
const cleanEnv = { ...process.env };
for (const key of Object.keys(cleanEnv)) {
  if (key.startsWith('CLAUDE_CODE_') || key === 'CLAUDECODE') {
    delete cleanEnv[key];
  }
}

const pty = spawn(ptyFile, ptyArgs, {
  name: 'xterm-256color',
  cols: process.stdout.columns || 80,
  rows: process.stdout.rows || 24,
  cwd,
  env: cleanEnv as Record<string, string>,
});

// Proxy PTY output to the user's terminal
pty.onData((data: string) => {
  process.stdout.write(data);
});

// Proxy user's keystrokes to PTY stdin
if (process.stdin.isTTY) {
  process.stdin.setRawMode(true);
}
process.stdin.resume();
process.stdin.on('data', (chunk: Buffer) => {
  pty.write(chunk.toString('binary'));
});

// Forward terminal resize events to the PTY
process.stdout.on('resize', () => {
  pty.resize(process.stdout.columns || 80, process.stdout.rows || 24);
});

// Connect to Argus backend
const client = new ArgusLaunchClient('ws://127.0.0.1:7411/launcher');
client.setRegisterInfo({ sessionId, pid: pty.pid, sessionType, cwd });

// When Argus sends a prompt, write it to the PTY
client.onSendPrompt((actionId: string, prompt: string) => {
  try {
    pty.write(prompt + '\r');
    client.ackDelivered(actionId);
  } catch (err) {
    client.ackFailed(actionId, err instanceof Error ? err.message : 'PTY write failed');
  }
});

// On Windows, pty.pid is the powershell.exe wrapper. Walk the process tree
// to find the real tool process (claude.exe, node.exe, etc.) and update Argus.
if (isWin) {
  let pidAttempts = 0;
  const pidInterval = setInterval(() => {
    pidAttempts++;
    if (pidAttempts > 20) { clearInterval(pidInterval); return; } // give up after ~10s
    try {
      // Walk the process tree from pty.pid downward to find the deepest descendant.
      // powershell.exe -> cmd.exe / conhost.exe -> claude.exe / node.exe
      let currentPid = pty.pid;
      for (let depth = 0; depth < 5; depth++) {
        const out = execSync(
          `wmic process where (ParentProcessId=${currentPid}) get ProcessId /value`,
          { encoding: 'utf-8', timeout: 3000, stdio: ['pipe', 'pipe', 'pipe'] }
        );
        const childPids = [...out.matchAll(/ProcessId=(\d+)/g)].map(m => parseInt(m[1], 10));
        if (childPids.length === 0) break;
        // Prefer a child that isn't conhost.exe
        let chosen = childPids[0];
        for (const cpid of childPids) {
          try {
            const nameOut = execSync(
              `wmic process where (ProcessId=${cpid}) get Name /value`,
              { encoding: 'utf-8', timeout: 3000, stdio: ['pipe', 'pipe', 'pipe'] }
            );
            const name = nameOut.match(/Name=(.+)/)?.[1]?.trim().toLowerCase() ?? '';
            if (name !== 'conhost.exe') { chosen = cpid; break; }
          } catch { /* use first child */ }
        }
        currentPid = chosen;
      }
      if (currentPid !== pty.pid) {
        client.updatePid(currentPid);
        clearInterval(pidInterval);
      }
    } catch { /* retry next tick */ }
  }, 500);
}

// When the tool exits, clean up
pty.onExit(({ exitCode }: { exitCode: number }) => {
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(false);
  }
  client.notifySessionEnded(sessionId, exitCode);
  process.exit(exitCode ?? 0);
});
