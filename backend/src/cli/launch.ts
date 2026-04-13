#!/usr/bin/env node
import { spawn } from 'node-pty';
import { execSync } from 'child_process';
import { appendFileSync, mkdirSync } from 'fs';
import { randomUUID } from 'crypto';
import { platform, tmpdir } from 'os';
import { join } from 'path';
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
const yoloActive = cmdArgs.includes('--dangerously-skip-permissions') || cmdArgs.includes('--allow-all');
log(`launch started: sessionType=${sessionType} cmd=${cmd} args=${JSON.stringify(cmdArgs)} cwd=${cwd} yoloMode=${yoloActive}`);

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
  // log(`terminal resized to ${process.stdout.columns}x${process.stdout.rows}`);
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

// Yield Win32 input mode sequences (ESC[Vk;Sc;Uc;Kd;Cs;Rc_) for a single character,
// one buffer per event: key-down first, then key-up.
function* win32InputEvents(ch: string): Generator<Buffer> {
  // [VirtualKey, ScanCode] for US QWERTY layout
  const keyInfo: Record<string, [number, number]> = {
    'a': [65, 30], 'b': [66, 48], 'c': [67, 46], 'd': [68, 32], 'e': [69, 18],
    'f': [70, 33], 'g': [71, 34], 'h': [72, 35], 'i': [73, 23], 'j': [74, 36],
    'k': [75, 37], 'l': [76, 38], 'm': [77, 50], 'n': [78, 49], 'o': [79, 24],
    'p': [80, 25], 'q': [81, 16], 'r': [82, 19], 's': [83, 31], 't': [84, 20],
    'u': [85, 22], 'v': [86, 47], 'w': [87, 17], 'x': [88, 45], 'y': [89, 21],
    'z': [90, 44], ' ': [32, 57], '\r': [13, 28],
    '0': [48, 11], '1': [49, 2], '2': [50, 3], '3': [51, 4], '4': [52, 5],
    '5': [53, 6], '6': [54, 7], '7': [55, 8], '8': [56, 9], '9': [57, 10],
    '-': [189, 12], '=': [187, 13], '[': [219, 26], ']': [221, 27],
    ';': [186, 39], "'": [222, 40], ',': [188, 51], '.': [190, 52], '/': [191, 53],
  };
  const lower = ch.toLowerCase();
  const [vk, sc] = keyInfo[lower] ?? [ch.charCodeAt(0), 0];
  const uc = ch.charCodeAt(0);
  yield Buffer.from(`\x1b[${vk};${sc};${uc};1;0;1_`); // key down
  yield Buffer.from(`\x1b[${vk};${sc};${uc};0;0;1_`); // key up
}

// Delay between Win32 keystroke pairs so Copilot CLI can process each character
// before the next arrives. Without this, all pushes land in a single event-loop
// tick and the PTY drops or merges them.
const KEYSTROKE_DELAY_MS = 10;

// Push a buffer to stdin then wait KEYSTROKE_DELAY_MS before returning.
// Every Win32 input event goes through this so the PTY sees a natural
// inter-event gap and does not drop or merge simultaneous arrivals.
const pushStdin = (buf: Buffer): Promise<void> => {
  process.stdin.push(buf);
  return new Promise<void>((resolve) => setTimeout(resolve, KEYSTROKE_DELAY_MS));
};

// When Argus sends a prompt, write it to the PTY.
// For copilot-cli: encode as Win32 input sequences pushed to process.stdin — Copilot
// reads via the Windows console API, not the PTY master, so pty.write() has no effect.
// For claude-code: write directly to the PTY master via pty.write().
client.onSendPrompt(async (actionId: string, prompt: string) => {
  log(`onSendPrompt actionId=${actionId} promptLen=${prompt.length}`);
  try {
    if (sessionType === 'copilot-cli') {
      log(`win32 focus-in`);
      await pushStdin(Buffer.from('\x1b[I'));
      for (const ch of prompt) {
        for (const buf of win32InputEvents(ch)) {
          await pushStdin(buf);
        }
      }
      for (const buf of win32InputEvents('\r')) {
        await pushStdin(buf);
      }
      await pushStdin(Buffer.from('\x1b[O'));
    } else {
      pty.write(prompt + '\r');
    }
    client.ackDelivered(actionId);
  } catch (err) {
    log(`prompt delivery failed: ${err}`);
    client.ackFailed(actionId, err instanceof Error ? err.message : 'prompt delivery failed');
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
    if (pidAttempts > 10) {
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
        log(`resolved tool process: ${targetExe} PID=${foundPid} attempt=${pidAttempts}`);
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
