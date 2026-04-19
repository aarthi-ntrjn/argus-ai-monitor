#!/usr/bin/env node
// show-parent-tree.mjs — Show the ancestor process chain for a named process.
// On Windows: delegates to show-parent-tree.ps1 (CIM-based).
// On macOS/Linux: uses pgrep and ps.
//
// Usage: node scripts/show-parent-tree.mjs <process-name>

import { execSync, spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { platform } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const processName = process.argv[2];

if (!processName) {
  console.error('Usage: node scripts/show-parent-tree.mjs <process-name>');
  process.exit(1);
}

if (platform() === 'win32') {
  const ps1 = join(__dirname, 'show-parent-tree.ps1');
  const result = spawnSync('powershell', ['-ExecutionPolicy', 'Bypass', '-File', ps1, processName], { stdio: 'inherit' });
  process.exit(result.status ?? 0);
}

// macOS / Linux
let pids;
try {
  pids = execSync(`pgrep -f "${processName}"`, { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
} catch {
  console.error(`No process matching: ${processName}`);
  process.exit(1);
}

function getAncestors(startPid) {
  const chain = [];
  let current = parseInt(startPid, 10);
  const seen = new Set();
  while (current > 1 && !seen.has(current)) {
    seen.add(current);
    try {
      const line = execSync(`ps -p ${current} -o pid=,ppid=,command=`, { encoding: 'utf8' }).trim();
      if (!line) break;
      const parts = line.trim().split(/\s+/);
      const pid = parseInt(parts[0], 10);
      const ppid = parseInt(parts[1], 10);
      const command = parts.slice(2).join(' ');
      chain.push({ pid, ppid, command });
      current = ppid;
    } catch {
      break;
    }
  }
  chain.reverse();
  return chain;
}

for (const pid of pids) {
  const chain = getAncestors(pid);
  console.log('');
  chain.forEach((p, i) => {
    if (i === 0) {
      console.log(`[${p.pid}] ${p.command}`);
    } else {
      const indent = '  '.repeat(i - 1);
      console.log(`${indent}+-- [${p.pid}] ${p.command}`);
    }
  });
}
