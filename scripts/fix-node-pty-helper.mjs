#!/usr/bin/env node
import { chmodSync, existsSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';

const EXECUTE_BITS = 0o111;
const MODE_MASK = 0o777;
const LOG_TAG = '[Postinstall]';
const SPAWN_HELPER_BASENAME = 'spawn-helper';

if (process.platform === 'win32') {
  process.exit(0);
}

const require = createRequire(import.meta.url);

try {
  const unixTerminalPath = require.resolve('node-pty/lib/unixTerminal.js');
  const { loadNativeModule } = require('node-pty/lib/utils');
  const native = loadNativeModule('pty');
  const helperPath = resolve(dirname(unixTerminalPath), native.dir, SPAWN_HELPER_BASENAME);

  if (!existsSync(helperPath)) {
    throw new Error(`node-pty spawn-helper not found at ${helperPath}`);
  }

  const currentMode = statSync(helperPath).mode & MODE_MASK;
  if ((currentMode & EXECUTE_BITS) !== 0) {
    process.exit(0);
  }

  chmodSync(helperPath, currentMode | EXECUTE_BITS);
  console.log(`${LOG_TAG} Marked node-pty spawn-helper executable: ${helperPath}`);
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`${LOG_TAG} Failed to fix node-pty spawn-helper: ${message}`);
  process.exit(1);
}
