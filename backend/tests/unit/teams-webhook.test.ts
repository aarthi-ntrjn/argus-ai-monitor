import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock jose to avoid real JWKS network calls
vi.mock('jose', () => ({
  createRemoteJWKSet: vi.fn(() => 'mock-keyset'),
  jwtVerify: vi.fn(),
}));

// Mock fetch for OIDC config
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { validateBotFrameworkToken } from '../../src/api/routes/teams-webhook.js';
import { jwtVerify } from 'jose';

describe('validateBotFrameworkToken', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      json: async () => ({ jwks_uri: 'https://login.botframework.com/v1/.well-known/keys' }),
    });
  });

  it('returns false when no Authorization header', async () => {
    expect(await validateBotFrameworkToken(undefined)).toBe(false);
  });

  it('returns false when header does not start with Bearer', async () => {
    expect(await validateBotFrameworkToken('Basic sometoken')).toBe(false);
  });

  it('returns true when jwtVerify succeeds', async () => {
    vi.mocked(jwtVerify).mockResolvedValue({} as any);
    expect(await validateBotFrameworkToken('Bearer validtoken')).toBe(true);
  });

  it('returns false when jwtVerify throws (expired/invalid)', async () => {
    vi.mocked(jwtVerify).mockRejectedValue(new Error('expired'));
    expect(await validateBotFrameworkToken('Bearer invalidtoken')).toBe(false);
  });
});
