import { mkdirSync } from 'fs';
import { TEST_REPO_A, TEST_REPO_B } from './test-config.js';

export default async function globalSetup() {
  // Create fake git repos so POST /api/v1/repositories passes the .git check
  mkdirSync(`${TEST_REPO_A}/.git`, { recursive: true });
  mkdirSync(`${TEST_REPO_B}/.git`, { recursive: true });
}
