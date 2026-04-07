#!/usr/bin/env node
import { spawn } from 'node-pty';
import { randomUUID } from 'crypto';
import { resolveLaunchCommand } from './launch-command-resolver.js';
import { ArgusLaunchClient } from './argus-launch-client.js';

const args = process.argv.slice(2);

if (args.length === 0) {
  process.stderr.write('Usage: argus launch <command> [args...]\n');
  process.stderr.write('Examples:\n');
  process.stderr.write('  argus launch claude\n');
  process.stderr.write('  argus launch gh copilot suggest\n');
  process.exit(1);
}

const { sessionType, cmd, cmdArgs } = resolveLaunchCommand(args);
const sessionId = randomUUID();
const cwd = process.cwd();

// Spawn the tool in a PTY so it sees a real TTY on stdin and stdout
const pty = spawn(cmd, cmdArgs, {
  name: 'xterm-256color',
  cols: process.stdout.columns || 80,
  rows: process.stdout.rows || 24,
  cwd,
  env: { ...process.env } as Record<string, string>,
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

// When the tool exits, clean up
pty.onExit(({ exitCode }: { exitCode: number }) => {
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(false);
  }
  client.notifySessionEnded(sessionId, exitCode);
  process.exit(exitCode ?? 0);
});
