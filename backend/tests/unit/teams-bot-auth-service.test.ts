import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TeamsBotAuthService, TeamsBotAuthError } from '../../src/services/teams-bot-auth-service.js';

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('TeamsBotAuthService', () => {
  let service: TeamsBotAuthService;

  beforeEach(() => {
    service = new TeamsBotAuthService();
    mockFetch.mockReset();
  });

  it('returns access_token on successful response', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ access_token: 'test-token-abc' }),
      text: async () => '',
    });

    const token = await service.getAccessToken({ botAppId: 'app-id', botAppSecret: 'secret', tenantId: 'tenant-id' });
    expect(token).toBe('test-token-abc');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('tenant-id'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('sends client_credentials grant with correct parameters', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ access_token: 'tok' }),
      text: async () => '',
    });

    await service.getAccessToken({ botAppId: 'my-app-id', botAppSecret: 'my-secret', tenantId: 'my-tenant' });

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = new URLSearchParams(options.body as string);
    expect(body.get('grant_type')).toBe('client_credentials');
    expect(body.get('client_id')).toBe('my-app-id');
    expect(body.get('client_secret')).toBe('my-secret');
    expect(body.get('scope')).toBe('https://graph.microsoft.com/.default');
  });

  it('throws TeamsBotAuthError on non-2xx response', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({}),
      text: async () => 'Unauthorized',
    });

    await expect(
      service.getAccessToken({ botAppId: 'bad-id', botAppSecret: 'bad-secret', tenantId: 'tenant' })
    ).rejects.toThrow(TeamsBotAuthError);
  });
});
