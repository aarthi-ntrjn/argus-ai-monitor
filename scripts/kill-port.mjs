#!/usr/bin/env node
/**
 * Kills any process listening on the given port.
 * Usage: node scripts/kill-port.mjs <port>
 * Used as a pre-step before starting the real-server e2e test suite so that a
 * stale server from a previous run never blocks Playwright from starting fresh.
 */
import { execSync } from 'child_process';

const [port] = process.argv.slice(2);
if (!port) process.exit(0);

try {
  const out = execSync('netstat -ano', { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] });
  for (const line of out.split('\n')) {
    if (line.includes(`:${port}`) && line.includes('LISTENING')) {
      const pid = line.trim().split(/\s+/).pop();
      if (pid && pid !== '0') {
        try {
          execSync(
            `powershell -Command "Stop-Process -Id ${pid} -Force -ErrorAction SilentlyContinue"`,
            { stdio: 'ignore' },
          );
          console.log(`Killed process ${pid} on port ${port}`);
        } catch { /* already gone */ }
      }
    }
  }
  // Give the OS a moment to release the port binding
  await new Promise(r => setTimeout(r, 400));
} catch { /* netstat unavailable — ignore */ }
