#!/usr/bin/env node
// kill-dev.mjs — Kill whatever process holds the dev server port.
// On Windows: delegates to kill-dev.ps1 (CIM-based process-tree kill).
// On macOS/Linux: uses lsof to find and kill by port.

import { execSync, spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { platform } from 'os';

const PORT = 7411;
const __dirname = dirname(fileURLToPath(import.meta.url));

if (platform() === 'win32') {
  const ps1 = join(__dirname, 'kill-dev.ps1');
  const result = spawnSync('powershell', ['-ExecutionPolicy', 'Bypass', '-File', ps1], { stdio: 'inherit' });
  process.exit(result.status ?? 0);
} else {
  try {
    const out = execSync(`lsof -ti tcp:${PORT} 2>/dev/null`, { encoding: 'utf8' }).trim();
    if (!out) {
      console.log(`No process on port ${PORT} - nothing to kill.`);
    } else {
      const pids = out.split('\n').filter(Boolean);
      execSync(`kill -9 ${pids.join(' ')}`, { stdio: 'ignore' });
      console.log(`Stopped process on port ${PORT} (PIDs: ${pids.join(', ')})`);
    }
  } catch {
    console.log(`No process on port ${PORT} - nothing to kill.`);
  }
}
