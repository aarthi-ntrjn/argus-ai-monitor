// test-pty-copilot-v1.mjs — original PTY test for copilot input injection
// Run from repo root: node scripts/test-pty-copilot-v1.mjs
import { spawn } from 'node-pty';

const pty = spawn('powershell.exe', ['-NoProfile', '-Command', 'copilot'], {
  name: 'xterm-256color',
  cols: 120,
  rows: 30,
  cwd: process.cwd(),
  env: process.env,
});

let outputLog = '';

pty.onData((data) => {
  process.stdout.write(data);
  outputLog += data;
});

pty.onExit(({ exitCode }) => {
  console.error(`\n[test] PTY exited with code ${exitCode}`);
  process.exit(exitCode ?? 0);
});

const PROMPT = 'list files in current directory';
const DELAY_MS = 10000;

console.error(`[test] Waiting ${DELAY_MS}ms for copilot to start...`);
setTimeout(() => {
  console.error(`[test] Writing prompt: "${PROMPT}"`);
  outputLog = '';
  pty.write(PROMPT);  
  pty.write('\r');

  setTimeout(() => {
    console.error(`\n[test] Output captured after write:\n${outputLog}`);
    pty.kill();
  }, 10000);
}, DELAY_MS);
