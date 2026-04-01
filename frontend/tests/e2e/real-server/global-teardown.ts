import { rmSync, existsSync } from 'fs';
import { TEST_DB_PATH, TEST_REPOS_DIR } from './test-config.js';

export default async function globalTeardown() {
  if (existsSync(TEST_REPOS_DIR)) {
    rmSync(TEST_REPOS_DIR, { recursive: true, force: true });
  }
  if (existsSync(TEST_DB_PATH)) {
    rmSync(TEST_DB_PATH, { force: true });
  }
}
