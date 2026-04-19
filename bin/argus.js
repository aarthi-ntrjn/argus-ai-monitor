#!/usr/bin/env node

import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { version } = require('../package.json');

const args = process.argv.slice(2);
if (args.includes('--version') || args.includes('-v')) {
  console.log(version);
  process.exit(0);
}

import { startServer } from '../backend/dist/server.js';

startServer().catch((err) => {
  console.error('Failed to start Argus:', err);
  process.exit(1);
});
