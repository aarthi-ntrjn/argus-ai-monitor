import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

const testRepoId = randomUUID();
const testRepoCwd = join(tmpdir(), `argus-repo-${randomUUID()}`);
const testSessionId = randomUUID();

// Mock the database module to avoid DB dependency in this unit-style integration test
vi.mock('../../src/db/database.js', () => ({
  getRepositoryByPath: (path: string) => {
    if (path === testRepoCwd) {
      return { id: testRepoId, path: testRepoCwd, name: 'test-repo', source: 'config', addedAt: new Date().toISOString(), lastScannedAt: null };
    }
    return undefined;
  },
  getSession: () => undefined,
  upsertSession: vi.fn(),
}));

import { CopilotCliDetector } from '../../src/services/copilot-cli-detector.js';

describe('CopilotCliDetector', () => {
  let testDir: string;
  let sessionDir: string;
  const testPid = 99999; // unlikely to exist

  beforeAll(() => {
    testDir = join(tmpdir(), `argus-test-${randomUUID()}`);
    sessionDir = join(testDir, testSessionId);
    mkdirSync(sessionDir, { recursive: true });

    // Create workspace.yaml
    writeFileSync(join(sessionDir, 'workspace.yaml'), `id: ${testSessionId}
cwd: ${testRepoCwd}
summary: Test session
created_at: ${new Date().toISOString()}
updated_at: ${new Date().toISOString()}
`);

    // Create inuse lock file
    writeFileSync(join(sessionDir, `inuse.${testPid}.lock`), '');
  });

  afterAll(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('detects session directory with lock file', async () => {
    const detector = new CopilotCliDetector(testDir);
    const sessions = await detector.scan();
    expect(sessions.length).toBeGreaterThanOrEqual(1);
    const session = sessions.find((s) => s.id === testSessionId);
    expect(session).toBeDefined();
    expect(session?.pid).toBe(testPid);
  });

  it('marks session as ended when PID not running', async () => {
    const detector = new CopilotCliDetector(testDir);
    const sessions = await detector.scan();
    const session = sessions.find((s) => s.id === testSessionId);
    // PID 99999 should not be running, so status should be 'ended'
    expect(session?.status).toBe('ended');
  });
});