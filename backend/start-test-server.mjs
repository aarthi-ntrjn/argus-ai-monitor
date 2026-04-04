#!/usr/bin/env node
/**
 * Thin launcher used by playwright.real.config.ts.
 * Kills any existing process on the target port, then starts the server.
 *
 * Usage: node backend/start-test-server.mjs <port> <db-path>
 */
import { execSync } from 'child_process';

const [port, dbPath] = process.argv.slice(2);
if (port) process.env.ARGUS_PORT = port;
if (dbPath) process.env.ARGUS_DB_PATH = dbPath;

// Kill any process already listening on the port so the bind never fails.
if (port) {
  try {
    const out = execSync(`netstat -ano`, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] });
    for (const line of out.split('\n')) {
      if (line.includes(`:${port}`) && line.includes('LISTENING')) {
        const pid = line.trim().split(/\s+/).pop();
        if (pid && pid !== '0') {
          try {
            execSync(`powershell -Command "Stop-Process -Id ${pid} -Force -ErrorAction SilentlyContinue"`,
              { stdio: 'ignore' });
          } catch { /* already gone */ }
        }
      }
    }
    // Give the OS a moment to release the port
    await new Promise(r => setTimeout(r, 400));
  } catch { /* netstat not available — ignore */ }
}

const { startServer } = await import('./src/server.ts');
await startServer();
