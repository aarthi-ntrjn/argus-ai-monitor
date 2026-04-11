#!/usr/bin/env node
import { spawn } from 'node-pty';
import { execSync } from 'child_process';
import { readdirSync, existsSync, readFileSync, appendFileSync, mkdirSync, statSync } from 'fs';
import { randomUUID } from 'crypto';
import { platform, homedir, tmpdir } from 'os';
import { join, normalize } from 'path';
import { load as yamlLoad } from 'js-yaml';
import { resolveLaunchCommand } from './launch-command-resolver.js';
import { ArgusLaunchClient } from './argus-launch-client.js';

const sessionId = randomUUID();
const logDir = join(tmpdir(), 'argus-logs');
mkdirSync(logDir, { recursive: true });
const logFile = join(logDir, `launch-${sessionId}.log`);
function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  appendFileSync(logFile, line);
}
process.stderr.write(`[launch] log: ${logFile}\n`);

// Parse --cwd <path> out of argv before passing the rest to resolveLaunchCommand.
// This is needed because npm --workspace changes cwd to the workspace root, so we
// cannot rely on process.cwd() to know which repo the user wants to work in.
const rawArgs = process.argv.slice(2);
let cwd = process.cwd();
const toolArgs: string[] = [];
for (let i = 0; i < rawArgs.length; i++) {
  if ((rawArgs[i] === '--cwd' || rawArgs[i] === '-cwd') && rawArgs[i + 1]) {
    cwd = rawArgs[++i];
    log(`argv: --cwd resolved to ${cwd}`);
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
log(`launch started: sessionType=${sessionType} cmd=${cmd} args=${JSON.stringify(cmdArgs)} cwd=${cwd}`);

// On Windows, node-pty's ConPTY API requires a real .exe — .cmd/.bat scripts
// (like claude.cmd, copilot.cmd) must be run through a shell.
// Spawn powershell.exe and pass the command as a -Command string.
const isWin = platform() === 'win32';
if (isWin) {
  log(`platform: windows — wrapping in powershell.exe`);
} else {
  log(`platform: ${platform()} — spawning ${cmd} directly`);
}
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

const spawnStartMs = Date.now();
log(`spawning PTY: ${ptyFile} ${JSON.stringify(ptyArgs)} at=${new Date(spawnStartMs).toISOString()}`);
const pty = spawn(ptyFile, ptyArgs, {
  name: 'xterm-256color',
  cols: process.stdout.columns || 80,
  rows: process.stdout.rows || 24,
  cwd,
  env: cleanEnv as Record<string, string>
});
log(`PTY spawned: pty.pid=${pty.pid} spawnMs=${Date.now() - spawnStartMs}`);

// Proxy PTY output to the user's terminal
pty.onData((data: string) => {  
  // This is needed. It's the display pipe: PTY output -> onData -> process.stderr -> Windows Terminal tab.
  process.stdout.write(data);
});

// Proxy user's keystrokes to PTY stdin
if (process.stdin.isTTY) {
  log(`stdin is TTY — enabling raw mode`);
  process.stdin.setRawMode(true);
} else {
  log(`stdin is not a TTY — skipping raw mode`);
}
process.stdin.resume();
process.stdin.on('data', (chunk: Buffer) => {
  log(`stdin.data len=${chunk.length} chunk=${chunk.toString('utf8')}`);
  pty.write(chunk.toString('binary'));
});

// Forward terminal resize events to the PTY
process.stdout.on('resize', () => {
  log(`terminal resized to ${process.stdout.columns}x${process.stdout.rows}`);
  pty.resize(process.stdout.columns || 80, process.stdout.rows || 24);
});

// Connect to Argus backend
log(`connecting to Argus WebSocket ws://127.0.0.1:7411/launcher`);
const client = new ArgusLaunchClient('ws://127.0.0.1:7411/launcher');
// On Windows the real tool PID is unknown until the process tree walk resolves it.
// On non-Windows pty.pid is already the tool directly (no shell wrapper).
log(`registering session: sessionId=${sessionId} hostPid=${pty.pid} pid=${isWin ? null : pty.pid} sessionType=${sessionType}`);
client.setRegisterInfo({ sessionId, hostPid: pty.pid, pid: isWin ? null : pty.pid, sessionType, cwd });

// For copilot-cli: watch the session-state dir for a workspace.yaml whose cwd
// matches ours, then send its session ID to Argus for direct claim — no repoPath
// matching required, which eliminates path-normalization failures.
// Record the launch time so the watcher ignores pre-existing workspace.yaml files
// from older sessions that happen to share the same cwd.
const launchStartMs = Date.now();

let workspaceWatcher: ReturnType<typeof setInterval> | null = null;
// if (sessionType === 'copilot-cli') {
//   log(`sessionType is copilot-cli — starting workspace.yaml watcher`);
//   const sessionStateDir = join(homedir(), '.copilot', 'session-state');
//   let watchAttempts = 0;
//   workspaceWatcher = setInterval(() => {
//     watchAttempts++;
//     if (watchAttempts > 60) {
//       log(`workspace watcher: giving up after 60 attempts`);
//       clearInterval(workspaceWatcher!); workspaceWatcher = null; return;
//     }
//     try {
//       if (!existsSync(sessionStateDir)) {
//         log(`workspace watcher: sessionStateDir not found (attempt ${watchAttempts})`);
//         return;
//       }
//       const entries = readdirSync(sessionStateDir, { withFileTypes: true });
//       for (const entry of entries) {
//         if (!entry.isDirectory()) continue;
//         const dirPath = join(sessionStateDir, entry.name);
//         const dirStat = statSync(dirPath);
//         if (dirStat.birthtimeMs < spawnStartMs) {
//           log(`workspace watcher: skipping ${entry.name} — dir created before spawn (birthtime=${new Date(dirStat.birthtimeMs).toISOString()})`);
//           continue;
//         }
//         const workspaceFile = join(dirPath, 'workspace.yaml');
//         if (!existsSync(workspaceFile)) continue;
//         try {
//           const content = yamlLoad(readFileSync(workspaceFile, 'utf-8')) as { id?: string; cwd?: string };
//           if (!content?.cwd || !content.id) {
//             log(`workspace watcher: skipping ${entry.name} — missing cwd or id`);
//             continue;
//           }
//           if (normalize(content.cwd).toLowerCase() !== normalize(cwd).toLowerCase()) {
//             log(`workspace watcher: skipping ${entry.name} — cwd mismatch (got ${content.cwd})`);
//             continue;
//           }
//           log(`workspace watcher: matched ${entry.name} workspaceId=${content.id}`);
//           client.sendWorkspaceId(content.id);
//           clearInterval(workspaceWatcher!);
//           workspaceWatcher = null;
//           break;
//         } catch (err) {
//           log(`workspace watcher: error parsing ${entry.name}/workspace.yaml — ${err}`);
//         }
//       }
//     } catch (err) {
//       log(`workspace watcher: fs error — ${err}`);
//     }
//   }, 500);
// } else {
//   log(`sessionType is ${sessionType} — skipping workspace.yaml watcher`);
// }
log(`workspace watcher: disabled`);

// When Argus sends a prompt, write it to the PTY.
// For copilot-cli: write the prompt text first, then wait 500ms for copilot's
// TUI to finish its echo/redraw cycle, then send Enter. Sending Enter in the
// same write as the text causes it to be discarded during the redraw.
client.onSendPrompt((actionId: string, prompt: string) => {
  log(`onSendPrompt actionId=${actionId} promptLen=${prompt.length}`);
  try {
    pty.write(prompt + '\r');
    client.ackDelivered(actionId);
    log(`ackDelivered actionId=${actionId}`);
  } catch (err) {
    log(`PTY write failed: ${err}`);
    client.ackFailed(actionId, err instanceof Error ? err.message : 'PTY write failed');
  }
});

// On Windows, pty.pid is the powershell.exe wrapper. Walk the process tree
// to find the real tool process (claude.exe, copilot.exe, etc.) and update Argus.
if (isWin) {
  const targetExe = `${cmd}.exe`.toLowerCase();
  log(`pid resolver: starting — looking for ${targetExe} under pty.pid=${pty.pid}`);
  let pidAttempts = 0;
  const pidInterval = setInterval(() => {
    pidAttempts++;
    if (pidAttempts > 20) {
      log(`pid resolver: giving up after 20 attempts`);
      clearInterval(pidInterval); return;
    }
    try {
      // Take one snapshot of all processes, then walk from pty.pid: for each visited
      // PID scan the list for entries whose ParentProcessId matches, check the name,
      // and push unmatched ones onto the stack.
      const out = execSync(
        `powershell -NoProfile -Command "$cutoff = [DateTimeOffset]::FromUnixTimeMilliseconds(${spawnStartMs}).LocalDateTime; Get-CimInstance Win32_Process | Where-Object { $_.CreationDate -ge $cutoff } | Select-Object ProcessId,ParentProcessId,Name,CreationDate | ConvertTo-Json -Compress"`,
        { encoding: 'utf-8', timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'] }
      );
      type ProcEntry = { ProcessId: number; ParentProcessId: number; Name: string; CreationDate: string | null };
      const all: ProcEntry[] = JSON.parse(out.trim());
      log(`pid resolver: snapshot has ${all.length} processes`);
      log(`pid resolver: snapshot=${JSON.stringify(all)}`);

      // copilot.exe spawns a wrapper that immediately forks a second copilot.exe;
      // the second one is the real process. For copilot we skip the first match and
      // only stop when we find a copilot.exe whose parent is also copilot.exe.
      const needsDoubleHop = targetExe === 'copilot.exe';
      let firstHopPid: number | null = null;
      let foundPid: number | null = null;
      const stack = [pty.pid];
      outer: while (stack.length > 0) {
        const current = stack.pop()!;
        for (const p of all) {
          if (p.ParentProcessId !== current) continue;
          const name = p.Name.trim().toLowerCase();
          log(`pid resolver: visiting ${name} PID=${p.ProcessId}`);
          if (name === targetExe) {
            if (needsDoubleHop && firstHopPid === null) {
              firstHopPid = p.ProcessId;
              stack.push(p.ProcessId); // keep walking into its children
            } else {
              foundPid = p.ProcessId;
              break outer;
            }
          } else {
            stack.push(p.ProcessId);
          }
        }
      }

      if (foundPid) {
        log(`resolved tool process: ${targetExe} PID=${foundPid}`);
        client.updatePid(foundPid);
        clearInterval(pidInterval);
      } else {
        log(`pid resolver: attempt ${pidAttempts} — ${targetExe} not yet in process tree`);
      }
    } catch (err) {
      log(`pid resolver: unexpected error on attempt ${pidAttempts} — ${err}`);
    }
  }, 500);
}

// When the tool exits, clean up
pty.onExit(({ exitCode }: { exitCode: number }) => {
  log(`PTY exited with exitCode=${exitCode}`);
  if (workspaceWatcher) {
    log(`clearing workspace watcher`);
    clearInterval(workspaceWatcher); workspaceWatcher = null;
  }
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(false);
  }
  // Await the WebSocket flush so the backend receives the session_ended
  // message before this process exits.
  log(`notifying Argus session ended`);
  client.notifySessionEnded(sessionId, exitCode).then(() => {
    log(`session_ended ack received — exiting with code ${exitCode}`);
    process.exit(exitCode ?? 0);
  });
});
