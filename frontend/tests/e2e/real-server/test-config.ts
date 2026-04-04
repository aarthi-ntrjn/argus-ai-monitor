import { tmpdir } from 'os';
import { join } from 'path';

export const TEST_PORT = 7412;
export const TEST_DB_PATH = join(tmpdir(), 'argus-e2e-real-server.db');
export const TEST_REPOS_DIR = join(tmpdir(), 'argus-e2e-repos');
export const TEST_REPO_A = join(TEST_REPOS_DIR, 'test-repo-alpha');
export const TEST_REPO_B = join(TEST_REPOS_DIR, 'test-repo-beta');
export const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;
