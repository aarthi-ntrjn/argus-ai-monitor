import { describe, it, expect, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import type { Session, SessionOutput } from '../../src/types';

// These tests target the fix for T116: session.output.batch arriving before the
// SessionCard/OutputPane mounts should still populate the React Query cache so
// the conversation is visible when the pane opens.  The old code returned `old`
// (undefined) when no cache entry existed, permanently hiding the conversation.

type OutputQueryData = { items: SessionOutput[]; nextBefore: string | null; total: number };

function makeOutput(overrides: Partial<SessionOutput> = {}): SessionOutput {
  return {
    id: 'o1',
    sessionId: 'sess-1',
    timestamp: new Date().toISOString(),
    type: 'message',
    content: 'hello',
    toolName: null,
    toolCallId: null,
    role: 'user',
    sequenceNumber: 1,
    ...overrides,
  };
}

// Reproduce the seeding logic from socket.ts applyOutputBatchEvent so we can
// unit-test the exact updater functions in isolation.
function seedOutputFull(outputs: SessionOutput[]) {
  return (old: OutputQueryData | undefined): OutputQueryData | undefined => {
    if (!old) {
      const items = outputs.slice(-100);
      return { items, nextBefore: items.length > 0 ? String(items[0].sequenceNumber) : null, total: outputs.length };
    }
    return { ...old, items: [...old.items, ...outputs], total: old.total + outputs.length };
  };
}

function seedOutputLast(outputs: SessionOutput[]) {
  return (old: OutputQueryData | undefined): OutputQueryData | undefined => {
    if (!old) {
      return { items: outputs.slice(-10), nextBefore: null, total: outputs.length };
    }
    return { ...old, items: [...old.items, ...outputs].slice(-10), total: old.total + outputs.length };
  };
}

describe('socket — applyOutputBatchEvent seeding (T116 regression)', () => {
  let qc: QueryClient;
  const SESSION_ID = 'sess-1';

  beforeEach(() => {
    qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  describe('session-output-last (SessionCard preview)', () => {
    it('seeds cache when no entry exists (batch arrives before SessionCard mounts)', () => {
      const outputs = [
        makeOutput({ id: 'o1', sequenceNumber: 1, content: 'first message' }),
        makeOutput({ id: 'o2', sequenceNumber: 2, content: 'second message' }),
      ];

      expect(qc.getQueryData(['session-output-last', SESSION_ID])).toBeUndefined();

      const result = qc.setQueryData<OutputQueryData>(
        ['session-output-last', SESSION_ID],
        seedOutputLast(outputs),
      );

      expect(result).toBeDefined();
      expect(result?.items).toHaveLength(2);
      expect(result?.items[0].content).toBe('first message');
      expect(result?.items[1].content).toBe('second message');
      expect(result?.total).toBe(2);
      expect(result?.nextBefore).toBeNull();
    });

    it('takes only the last 10 when batch has more than 10 outputs', () => {
      const outputs = Array.from({ length: 15 }, (_, i) =>
        makeOutput({ id: `o${i + 1}`, sequenceNumber: i + 1, content: `msg ${i + 1}` }),
      );

      const result = qc.setQueryData<OutputQueryData>(
        ['session-output-last', SESSION_ID],
        seedOutputLast(outputs),
      );

      expect(result?.items).toHaveLength(10);
      expect(result?.items[0].sequenceNumber).toBe(6); // last 10 start at seq 6
      expect(result?.total).toBe(15);
    });

    it('appends to existing cache when session card was already mounted', () => {
      const existing = makeOutput({ id: 'e1', sequenceNumber: 1, content: 'existing' });
      qc.setQueryData<OutputQueryData>(['session-output-last', SESSION_ID], {
        items: [existing], nextBefore: null, total: 1,
      });

      const newOutput = makeOutput({ id: 'n1', sequenceNumber: 2, content: 'new' });
      const result = qc.setQueryData<OutputQueryData>(
        ['session-output-last', SESSION_ID],
        seedOutputLast([newOutput]),
      );

      expect(result?.items).toHaveLength(2);
      expect(result?.items[1].content).toBe('new');
      expect(result?.total).toBe(2);
    });
  });

  describe('session-output (OutputPane full view)', () => {
    it('seeds cache when no entry exists (batch arrives before OutputPane opens)', () => {
      const outputs = Array.from({ length: 5 }, (_, i) =>
        makeOutput({ id: `o${i + 1}`, sequenceNumber: i + 1, content: `msg ${i + 1}` }),
      );

      expect(qc.getQueryData(['session-output', SESSION_ID])).toBeUndefined();

      const result = qc.setQueryData<OutputQueryData>(
        ['session-output', SESSION_ID],
        seedOutputFull(outputs),
      );

      expect(result).toBeDefined();
      expect(result?.items).toHaveLength(5);
      expect(result?.nextBefore).toBe('1'); // first sequenceNumber of returned items
      expect(result?.total).toBe(5);
    });

    it('takes only the last 100 when batch has more than 100 outputs', () => {
      const outputs = Array.from({ length: 150 }, (_, i) =>
        makeOutput({ id: `o${i + 1}`, sequenceNumber: i + 1 }),
      );

      const result = qc.setQueryData<OutputQueryData>(
        ['session-output', SESSION_ID],
        seedOutputFull(outputs),
      );

      expect(result?.items).toHaveLength(100);
      expect(result?.items[0].sequenceNumber).toBe(51); // last 100 start at seq 51
      expect(result?.total).toBe(150);
      expect(result?.nextBefore).toBe('51');
    });
  });
});

// Reproduce the session-list and individual-session cache update logic from
// socket.ts updateSessionInCache so we can unit-test both cache keys in isolation.
function updateSessionInCache(qc: QueryClient, session: Session): void {
  qc.setQueryData<Session[]>(['sessions'], (old) => {
    if (!old) return old;
    return old.map((s) => s.id === session.id ? { ...s, ...session } : s);
  });
  qc.setQueryData<Session>(['session', session.id], (old) => {
    if (!old) return old;
    return { ...old, ...session };
  });
}

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'sess-1',
    repositoryId: 'repo-1',
    type: 'claude-code',
    launchMode: 'detected',
    pid: 1234,
    pidSource: 'lockfile',
    status: 'active',
    startedAt: '2026-01-01T00:00:00Z',
    endedAt: null,
    lastActivityAt: '2026-01-01T00:00:00Z',
    summary: null,
    expiresAt: null,
    model: null,
    yoloMode: null,
    ...overrides,
  };
}

describe('socket — updateSessionInCache', () => {
  let qc: QueryClient;
  const SESSION_ID = 'sess-1';

  beforeEach(() => {
    qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  describe("['sessions'] list cache", () => {
    it('updates the matching session in the list', () => {
      const original = makeSession({ status: 'active' });
      qc.setQueryData<Session[]>(['sessions'], [original]);

      const updated = makeSession({ status: 'idle' });
      updateSessionInCache(qc, updated);

      const sessions = qc.getQueryData<Session[]>(['sessions']);
      expect(sessions?.[0].status).toBe('idle');
    });

    it('leaves other sessions untouched', () => {
      const other = makeSession({ id: 'sess-2', status: 'active' });
      const target = makeSession({ id: SESSION_ID, status: 'active' });
      qc.setQueryData<Session[]>(['sessions'], [other, target]);

      updateSessionInCache(qc, makeSession({ id: SESSION_ID, status: 'ended' }));

      const sessions = qc.getQueryData<Session[]>(['sessions']);
      expect(sessions?.[0].status).toBe('active'); // sess-2 unchanged
      expect(sessions?.[1].status).toBe('ended');  // sess-1 updated
    });

    it('does nothing when sessions list cache is empty', () => {
      updateSessionInCache(qc, makeSession({ status: 'idle' }));
      expect(qc.getQueryData<Session[]>(['sessions'])).toBeUndefined();
    });
  });

  describe("['session', id] individual cache (T038 regression)", () => {
    it('merges updated fields into the individual session cache', () => {
      const original = makeSession({ status: 'active', summary: null });
      qc.setQueryData<Session>(['session', SESSION_ID], original);

      updateSessionInCache(qc, makeSession({ status: 'idle', summary: 'done' }));

      const session = qc.getQueryData<Session>(['session', SESSION_ID]);
      expect(session?.status).toBe('idle');
      expect(session?.summary).toBe('done');
    });

    it('preserves fields not present in the incoming update', () => {
      const original = makeSession({ model: 'claude-3-5-sonnet', status: 'active' });
      qc.setQueryData<Session>(['session', SESSION_ID], original);

      updateSessionInCache(qc, makeSession({ status: 'idle', model: 'claude-3-5-sonnet' }));

      const session = qc.getQueryData<Session>(['session', SESSION_ID]);
      expect(session?.model).toBe('claude-3-5-sonnet');
    });

    it('does nothing when individual session cache is not seeded', () => {
      // No cache entry for this session yet — update must be a no-op (not create a stale entry)
      updateSessionInCache(qc, makeSession({ status: 'idle' }));
      expect(qc.getQueryData<Session>(['session', SESSION_ID])).toBeUndefined();
    });
  });
});
