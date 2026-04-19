#!/usr/bin/env node
// reset-db.mjs — Delete the Argus SQLite database and its WAL/SHM files.
// Backs up files first, then deletes. Cross-platform equivalent of reset-db.ps1.
// Note: files are permanently deleted (no Recycle Bin) on macOS/Linux.

import { existsSync, mkdirSync, copyFileSync, rmSync } from 'fs';
import { createInterface } from 'readline';
import { join, dirname, basename } from 'path';
import { homedir } from 'os';

const dbFile = process.env.ARGUS_DB_PATH ?? join(homedir(), '.argus', 'argus.db');
const dbDir = dirname(dbFile);
const candidates = [dbFile, `${dbFile}-wal`, `${dbFile}-shm`];
const found = candidates.filter(f => existsSync(f));

if (found.length === 0) {
  console.log(`Nothing to delete. No database files found in ${dbDir}`);
  process.exit(0);
}

console.log('The following files will be deleted:');
found.forEach(f => console.log(`  ${f}`));
console.log('');

const rl = createInterface({ input: process.stdin, output: process.stdout });
rl.question('Proceed? (y/N): ', answer => {
  rl.close();
  if (answer.toLowerCase() !== 'y') {
    console.log('Cancelled.');
    process.exit(0);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19).replace('T', '-');
  const backupDir = join(dbDir, 'backups');
  if (!existsSync(backupDir)) mkdirSync(backupDir, { recursive: true });

  for (const f of found) {
    const name = basename(f);
    const dest = join(backupDir, `${timestamp}-${name}`);
    copyFileSync(f, dest);
    console.log(`Backed up ${f} -> ${dest}`);
  }

  for (const f of found) {
    rmSync(f);
    console.log(`Deleted: ${f}`);
  }

  console.log(`\nBackup saved to ${backupDir}`);
  console.log('Database reset complete. Restart Argus to create a fresh database.');
});
