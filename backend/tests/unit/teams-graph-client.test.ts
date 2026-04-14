import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TeamsGraphClient, TeamsGraphError } from '../../src/services/teams-graph-client.js';

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

function okJson(data: unknown, status = 200) {
  return Promise.resolve({
    ok: true,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  } as Response);
}

function errResponse(status: number, text = 'Error') {
  return Promise.resolve({
    ok: false,
    status,
    json: () => Promise.reject(new Error()),
    text: () => Promise.resolve(text),
  } as unknown as Response);
}

describe('TeamsGraphClient', () => {
  let client: TeamsGraphClient;

  beforeEach(() => {
    client = new TeamsGraphClient();
    mockFetch.mockReset();
  });

  describe('createThreadPost', () => {
    it('sends POST to correct Graph URL and returns messageId', async () => {
      mockFetch.mockReturnValue(okJson({ id: 'msg-123' }, 201));
      const result = await client.createThreadPost('team-1', 'channel-1', 'token-abc', 'Hello');
      expect(result).toEqual({ messageId: 'msg-123' });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/teams/team-1/channels/channel-1/messages'),
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('throws TeamsGraphError on non-2xx', async () => {
      mockFetch.mockReturnValue(errResponse(403, 'Forbidden'));
      await expect(client.createThreadPost('t', 'c', 'tok', 'x')).rejects.toThrow(TeamsGraphError);
    });
  });

  describe('postReply', () => {
    it('sends POST to replies endpoint', async () => {
      mockFetch.mockReturnValue(okJson({ id: 'reply-1' }, 201));
      const result = await client.postReply('team-1', 'channel-1', 'thread-1', 'token-abc', 'Reply text');
      expect(result).toEqual({ messageId: 'reply-1' });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/replies'),
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  describe('updateReply', () => {
    it('sends PATCH to correct URL', async () => {
      mockFetch.mockReturnValue(Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}), text: () => Promise.resolve('') } as Response));
      await client.updateReply('team-1', 'channel-1', 'thread-1', 'reply-1', 'token-abc', 'Updated');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/replies/reply-1'),
        expect.objectContaining({ method: 'PATCH' }),
      );
    });
  });

  describe('pollReplies', () => {
    it('uses deltaLink on subsequent calls', async () => {
      const deltaUrl = 'https://graph.microsoft.com/v1.0/delta?token=xyz';
      mockFetch.mockReturnValue(okJson({
        value: [{ id: 'r1', from: { user: { id: 'u1', displayName: 'User' } }, body: { content: 'cmd' }, createdDateTime: '2024-01-01T00:00:00Z' }],
        '@odata.deltaLink': deltaUrl,
      }));
      const result = await client.pollReplies('team-1', 'channel-1', 'thread-1', 'token-abc', 'https://old-delta-link');
      expect(mockFetch).toHaveBeenCalledWith('https://old-delta-link', expect.any(Object));
      expect(result.nextDeltaLink).toBe(deltaUrl);
      expect(result.replies).toHaveLength(1);
    });

    it('constructs initial delta URL when no deltaLink provided', async () => {
      mockFetch.mockReturnValue(okJson({ value: [], '@odata.deltaLink': 'https://delta-link-new' }));
      await client.pollReplies('team-1', 'channel-1', 'thread-1', 'token-abc');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/replies/delta'),
        expect.any(Object),
      );
    });

    it('throws TeamsGraphError on non-2xx', async () => {
      mockFetch.mockReturnValue(errResponse(429, 'Rate limited'));
      await expect(client.pollReplies('t', 'c', 'tid', 'tok')).rejects.toThrow(TeamsGraphError);
    });
  });

  describe('getMe', () => {
    it('returns id and displayName', async () => {
      mockFetch.mockReturnValue(okJson({ id: 'user-id-123', displayName: 'Ada Lovelace' }));
      const result = await client.getMe('token-abc');
      expect(result).toEqual({ id: 'user-id-123', displayName: 'Ada Lovelace' });
    });
  });
});
