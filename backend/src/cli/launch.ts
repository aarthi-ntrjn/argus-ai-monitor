#!/usr/bin/env node
import { spawn } from 'node-pty';
import { execSync } from 'child_process';
import { readdirSync, existsSync, readFileSync } from 'fs';
import { randomUUID } from 'crypto';
import { platform, homedir } from 'os';
import { join, normalize } from 'path';
import { load as yamlLoad } from 'js-yaml';
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
// On Windows the real tool PID is unknown until the process tree walk resolves it.
// On non-Windows pty.pid is already the tool directly (no shell wrapper).
client.setRegisterInfo({ sessionId, hostPid: pty.pid, pid: isWin ? null : pty.pid, sessionType, cwd });

// For copilot-cli: watch the session-state dir for a workspace.yaml whose cwd
// matches ours, then send its session ID to Argus for direct claim — no repoPath
// matching required, which eliminates path-normalization failures.
// Record the launch time so the watcher ignores pre-existing workspace.yaml files
// from older sessions that happen to share the same cwd.
const launchStartMs = Date.now();

let workspaceWatcher: ReturnType<typeof setInterval> | null = null;
if (sessionType === 'copilot-cli') {
  const sessionStateDir = join(homedir(), '.copilot', 'session-state');
  let watchAttempts = 0;
  workspaceWatcher = setInterval(() => {
    watchAttempts++;
    if (watchAttempts > 60) { clearInterval(workspaceWatcher!); workspaceWatcher = null; return; }
    try {
      if (!existsSync(sessionStateDir)) return;
      const entries = readdirSync(sessionStateDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const workspaceFile = join(sessionStateDir, entry.name, 'workspace.yaml');
        if (!existsSync(workspaceFile)) continue;
        try {
          const content = yamlLoad(readFileSync(workspaceFile, 'utf-8')) as { id?: string; cwd?: string; created_at?: string };
          if (!content?.cwd || !content.id) continue;
          if (normalize(content.cwd).toLowerCase() !== normalize(cwd).toLowerCase()) continue;
          // Ignore workspace.yaml files that predate this launch — they belong to sessions
          // already running before argus launch was invoked (e.g. process 42088 above).
          const createdAt = content.created_at ? new Date(content.created_at).getTime() : 0;
          if (createdAt < launchStartMs - 3000) continue;
          client.sendWorkspaceId(content.id);
          clearInterval(workspaceWatcher!);
          workspaceWatcher = null;
          break;
        } catch { /* ignore malformed yaml */ }
      }
    } catch { /* ignore fs errors */ }
  }, 500);
}

// When Argus sends a prompt, write it to the PTY.
// For copilot-cli: write the prompt text first, then wait 500ms for copilot's
// TUI to finish its echo/redraw cycle, then send Enter. Sending Enter in the
// same write as the text causes it to be discarded during the redraw.
client.onSendPrompt((actionId: string, prompt: string) => {
  process.stderr.write(`[launch] onSendPrompt actionId=${actionId} prompt=${prompt}\n`);

  try {
    pty.write(prompt + '\r');
    pty.write('\r');
    client.ackDelivered(actionId);
  } catch (err) {
    process.stderr.write(`[launch] PTY write failed: ${err}\n`);
    client.ackFailed(actionId, err instanceof Error ? err.message : 'PTY write failed');
  }
});

// On Windows, pty.pid is the powershell.exe wrapper. Walk the process tree
// to find the real tool process (claude.exe, copilot.exe, etc.) and update Argus.
if (isWin) {
  const targetExe = `${cmd}.exe`.toLowerCase(); // e.g. claude.exe or copilot.exe
  let pidAttempts = 0;
  const pidInterval = setInterval(() => {
    pidAttempts++;
    if (pidAttempts > 20) { clearInterval(pidInterval); return; } // give up after ~10s
    try {
      // Walk the process tree from pty.pid downward.
      // Stop as soon as we find the target exe; otherwise take the deepest non-conhost child.
      // powershell.exe -> conhost.exe / copilot.exe (or node.exe wrapping it)
      let currentPid = pty.pid;
      let currentName = 'powershell.exe';

      // First: ask wmic directly for a child of pty.pid with the exact target name.
      try {
        const out = execSync(
          `wmic process where (ParentProcessId=${pty.pid} and Name="${targetExe}") get ProcessId /value`,
          { encoding: 'utf-8', timeout: 3000, stdio: ['pipe', 'pipe', 'pipe'] }
        );
        const pid = parseInt(out.match(/ProcessId=(\d+)/)?.[1] ?? '', 10);
        if (pid) { currentPid = pid; currentName = targetExe; }
      } catch { /* fall through to depth walk */ }

      // Fallback: target exe not a direct child (e.g. wrapped in node.exe).
      // Walk the tree depth-first, skipping conhost.exe, until no more children.
      if (currentPid === pty.pid) {
        for (let depth = 0; depth < 5; depth++) {
          const out = execSync(
            `wmic process where (ParentProcessId=${currentPid} and Name!="conhost.exe") get ProcessId,Name /value`,
            { encoding: 'utf-8', timeout: 3000, stdio: ['pipe', 'pipe', 'pipe'] }
          );
          const blocks = out.split(/\r?\n\r?\n/).filter(b => b.trim());
          if (blocks.length === 0) break;
          const pid = parseInt(blocks[0].match(/ProcessId=(\d+)/)?.[1] ?? '', 10);
          const name = blocks[0].match(/Name=(.+)/)?.[1]?.trim().toLowerCase() ?? '';
          if (!pid) break;
          currentPid = pid;
          currentName = name;
        }
      }
      if (currentPid !== pty.pid) {
        process.stderr.write(`[launch] resolved tool process: ${currentName} PID=${currentPid}\n`);
        client.updatePid(currentPid);
        clearInterval(pidInterval);
      }
    } catch { /* retry next tick */ }
  }, 500);
}

// When the tool exits, clean up
pty.onExit(({ exitCode }: { exitCode: number }) => {
  if (workspaceWatcher) { clearInterval(workspaceWatcher); workspaceWatcher = null; }
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(false);
  }
  // Await the WebSocket flush so the backend receives the session_ended
  // message before this process exits.
  client.notifySessionEnded(sessionId, exitCode).then(() => {
    process.exit(exitCode ?? 0);
  });
});
