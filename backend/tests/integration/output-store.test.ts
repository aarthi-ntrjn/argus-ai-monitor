import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'crypto';
import { rmSync, existsSync } from 'fs';
import { insertRepository, upsertSession, closeDb } from '../../src/db/database.js';
import { OutputStore, outputEvents } from '../../src/services/output-store.js';

const testRepoId = randomUUID();
const testSessionId = `test-${randomUUID()}`;

beforeAll(() => {
  insertRepository({
    id: testRepoId,
    path: `/tmp/test-repo-${testRepoId}`,
    name: 'test-repo',
    source: 'ui',
    addedAt: new Date().toISOString(),
    lastScannedAt: null,
  });
  upsertSession({
    id: testSessionId,
    repositoryId: testRepoId,
    type: 'copilot-cli',
    pid: null,
    status: 'ended',
    startedAt: new Date().toISOString(),
    endedAt: null,
    lastActivityAt: new Date().toISOString(),
    summary: null,
    expiresAt: null,
  });
});

afterAll(() => {
  closeDb();
  const dbPath = process.env.ARGUS_DB_PATH;
  if (dbPath && existsSync(dbPath)) rmSync(dbPath, { force: true });
});

describe('OutputStore', () => {
  it('can insert and retrieve output records', async () => {
    const { insertOutput, getOutputForSession } = await import('../../src/db/database.js');
    const sessionId = testSessionId;

    for (let i = 1; i <= 5; i++) {
      insertOutput({
        id: randomUUID(),
        sessionId,
        timestamp: new Date().toISOString(),
        type: 'message',
        content: `Message ${i}`,
        toolName: null,
        sequenceNumber: i,
      });
    }

    const results = getOutputForSession(sessionId, 10);
    expect(results.length).toBeGreaterThanOrEqual(5);
    expect(results[0].sequenceNumber).toBe(1);
  });

  it('supports pagination via before parameter', async () => {
    const { insertOutput, getOutputForSession } = await import('../../src/db/database.js');
    const sessionId = testSessionId;

    for (let i = 100; i <= 109; i++) {
      insertOutput({
        id: randomUUID(),
        sessionId,
        timestamp: new Date().toISOString(),
        type: 'message',
        content: `Message ${i}`,
        toolName: null,
        sequenceNumber: i,
      });
    }

    const page1 = getOutputForSession(sessionId, 5, '106');
    expect(page1.length).toBe(5);
    expect(page1.every((r) => r.sequenceNumber < 106)).toBe(true);
  });

  it('skipNotifications suppresses output listeners and outputEvents (historical replay guard)', () => {
    const store = new OutputStore();
    const listener = vi.fn();
    store.addOutputListener(listener);

    const eventsListener = vi.fn();
    outputEvents.on('session.output.batch', eventsListener);

    const output = {
      id: randomUUID(),
      sessionId: testSessionId,
      timestamp: new Date().toISOString(),
      type: 'message' as const,
      content: 'historical message',
      toolName: null,
      sequenceNumber: 9001,
    };

    store.insertOutput(testSessionId, [output], { skipNotifications: true });

    expect(listener).not.toHaveBeenCalled();
    expect(eventsListener).not.toHaveBeenCalled();

    outputEvents.off('session.output.batch', eventsListener);
    store.removeOutputListener(listener);
  });

  it('insertOutput without skipNotifications fires output listeners and outputEvents', () => {
    const store = new OutputStore();
    const listener = vi.fn();
    store.addOutputListener(listener);

    const eventsListener = vi.fn();
    outputEvents.on('session.output.batch', eventsListener);

    const output = {
      id: randomUUID(),
      sessionId: testSessionId,
      timestamp: new Date().toISOString(),
      type: 'message' as const,
      content: 'live message',
      toolName: null,
      sequenceNumber: 9002,
    };

    store.insertOutput(testSessionId, [output]);

    expect(listener).toHaveBeenCalledOnce();
    expect(eventsListener).toHaveBeenCalledOnce();

    outputEvents.off('session.output.batch', eventsListener);
    store.removeOutputListener(listener);
  });

  it('can prune oldest records when over limit', async () => {
    const { OutputStore } = await import('../../src/services/output-store.js');
    const store = new OutputStore();
    const sessionId = testSessionId;

    for (let i = 200; i <= 399; i++) {
      store.insertOutput(sessionId, [{
        id: randomUUID(),
        sessionId,
        timestamp: new Date().toISOString(),
        type: 'message',
        content: 'x'.repeat(1000),
        toolName: null,
        sequenceNumber: i,
      }]);
    }

    store.pruneIfNeeded(sessionId, 0.0001);
    const { getOutputForSession } = await import('../../src/db/database.js');
    const remaining = getOutputForSession(sessionId, 1000);
    expect(remaining.length).toBeLessThan(200);
  });
});
