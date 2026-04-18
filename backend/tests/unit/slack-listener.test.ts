import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/db/database.js', () => ({
  getSessions: vi.fn(),
  getSession: vi.fn(),
}));

import { SlackListener } from '../../src/integration/slack/slack-listener.js';
import { getSessions, getSession } from '../../src/db/database.js';
import type { Session } from '../../src/models/index.js';

const baseSession: Session = {
  id: 'session-abc-123',
  repositoryId: null,
  type: 'claude-code',
  launchMode: null,
  pid: 1234,
  hostPid: null,
  pidSource: null,
  status: 'active',
  startedAt: '2024-01-01T00:00:00.000Z',
  endedAt: null,
  lastActivityAt: '2024-01-01T00:00:00.000Z',
  summary: 'Doing work',
  expiresAt: null,
  model: 'claude-opus-4-5',
  reconciled: true,
  yoloMode: null,
};

const mockNotifier = {
  getSessionIdByThreadTs: vi.fn(),
} as any;

const mockWebClient = {} as any;
const mockConfig = { botToken: 'xoxb-test', channelId: 'C01234', appToken: undefined, enabled: true };

function makeListener() {
  return new SlackListener(mockConfig, mockWebClient, mockNotifier);
}

describe('SlackListener.handleArgusQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSessions).mockReturnValue([]);
    vi.mocked(getSession).mockReturnValue(undefined);
  });

  describe('sessions command', () => {
    it('returns "no active sessions" block when none exist', async () => {
      const listener = makeListener();
      const blocks = await listener.handleArgusQuery('sessions');
      expect(blocks[0].text).toMatchObject({ text: expect.stringContaining('No active sessions') });
    });

    it('lists active sessions when present', async () => {
      vi.mocked(getSessions).mockReturnValue([baseSession]);
      const listener = makeListener();
      const blocks = await listener.handleArgusQuery('sessions');
      expect(blocks[0].type).toBe('header');
      expect(blocks[1].text).toMatchObject({ text: expect.stringContaining(baseSession.id.slice(0, 8)) });
    });

    it('handles singular "session" alias', async () => {
      vi.mocked(getSessions).mockReturnValue([baseSession]);
      const listener = makeListener();
      const blocks = await listener.handleArgusQuery('session');
      expect(blocks[0].type).toBe('header');
    });

    it('strips @mentions before matching', async () => {
      const listener = makeListener();
      const blocks = await listener.handleArgusQuery('<@U12345> sessions');
      expect(blocks[0].text).toMatchObject({ text: expect.stringContaining('No active sessions') });
    });
  });

  describe('status command', () => {
    it('returns not-found block when session does not exist', async () => {
      const listener = makeListener();
      const blocks = await listener.handleArgusQuery('status unknown-id');
      expect(blocks[0].text).toMatchObject({ text: expect.stringContaining('No session found') });
    });

    it('returns session detail block when found by getSession', async () => {
      vi.mocked(getSession).mockReturnValue(baseSession);
      const listener = makeListener();
      const blocks = await listener.handleArgusQuery('status session-abc-123');
      expect(blocks[0].type).toBe('header');
      const fields = (blocks[1] as any).fields as Array<{ text: string }>;
      expect(fields.some(f => f.text.includes(baseSession.id))).toBe(true);
    });

    it('matches session by prefix via active sessions', async () => {
      vi.mocked(getSession).mockReturnValue(undefined);
      vi.mocked(getSessions).mockReturnValue([baseSession]);
      const listener = makeListener();
      const blocks = await listener.handleArgusQuery('status session-abc');
      expect(blocks[0].type).toBe('header');
    });
  });

  describe('send command', () => {
    it('returns warning when not in a thread', async () => {
      const listener = makeListener();
      const blocks = await listener.handleArgusQuery('send hello');
      expect((blocks[0].text as any).text).toContain('must be used inside a session thread');
    });
  });

  describe('help command', () => {
    it('returns help blocks for "help"', async () => {
      const listener = makeListener();
      const blocks = await listener.handleArgusQuery('help');
      expect(blocks[0].type).toBe('header');
      expect((blocks[0] as any).text.text).toContain('Help');
    });

    it('returns help blocks for unknown command', async () => {
      const listener = makeListener();
      const blocks = await listener.handleArgusQuery('foobar');
      expect(blocks[0].type).toBe('header');
    });
  });
});
