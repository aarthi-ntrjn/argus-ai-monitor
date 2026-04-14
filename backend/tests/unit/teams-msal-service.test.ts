import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TeamsMsalService } from '../../src/services/teams-msal-service.js';

// Mock @azure/msal-node
vi.mock('@azure/msal-node', () => {
  return {
    PublicClientApplication: vi.fn().mockImplementation(() => ({
      acquireTokenByDeviceCode: vi.fn(),
      getTokenCache: vi.fn().mockReturnValue({
        serialize: vi.fn().mockReturnValue(JSON.stringify({ RefreshToken: {} })),
      }),
    })),
  };
});

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

import { PublicClientApplication } from '@azure/msal-node';

describe('TeamsMsalService', () => {
  let service: TeamsMsalService;

  beforeEach(() => {
    service = new TeamsMsalService();
    vi.clearAllMocks();
  });

  describe('initiateDeviceCodeFlow', () => {
    it('returns DeviceCodeInfo with userCode and verificationUrl', async () => {
      const mockPca = {
        acquireTokenByDeviceCode: vi.fn().mockImplementation(async ({ deviceCodeCallback }: { deviceCodeCallback: (r: any) => void }) => {
          deviceCodeCallback({
            userCode: 'ABCD-1234',
            verificationUri: 'https://microsoft.com/devicelogin',
            expiresIn: 900,
            message: 'Use ABCD-1234 at https://microsoft.com/devicelogin',
          });
          return { accessToken: 'at', account: { localAccountId: 'uid', name: 'Ada', homeAccountId: 'h' } };
        }),
        getTokenCache: vi.fn().mockReturnValue({
          serialize: vi.fn().mockReturnValue(JSON.stringify({
            RefreshToken: { k: { secret: 'rt-value' } },
          })),
        }),
      };
      vi.mocked(PublicClientApplication).mockImplementation(() => mockPca as any);

      const info = await service.initiateDeviceCodeFlow('client-id', 'tenant-id');
      expect(info.userCode).toBe('ABCD-1234');
      expect(info.verificationUrl).toBe('https://microsoft.com/devicelogin');
      expect(info.expiresIn).toBe(900);
    });
  });

  describe('pollDeviceCodeFlow', () => {
    it('returns pending while flow is in progress', async () => {
      const mockPca = {
        acquireTokenByDeviceCode: vi.fn().mockImplementation(async ({ deviceCodeCallback }: { deviceCodeCallback: (r: any) => void }) => {
          deviceCodeCallback({ userCode: 'CODE', verificationUri: 'https://url', expiresIn: 900, message: '' });
          return new Promise(() => {});
        }),
        getTokenCache: vi.fn().mockReturnValue({ serialize: vi.fn().mockReturnValue('{}') }),
      };
      vi.mocked(PublicClientApplication).mockImplementation(() => mockPca as any);

      await service.initiateDeviceCodeFlow('c2', 't2');
      const result = await service.pollDeviceCodeFlow('c2', 't2');
      expect(result.status).toBe('pending');
    });

    it('returns expired when no pending flow', async () => {
      const result = await service.pollDeviceCodeFlow('nonexistent', 'tenant');
      expect(result.status).toBe('expired');
    });
  });

  describe('getAccessToken', () => {
    it('returns access_token from refresh endpoint', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ access_token: 'new-access-token' }),
      });
      const token = await service.getAccessToken({ clientId: 'cid', tenantId: 'tid', refreshToken: 'rt' });
      expect(token).toBe('new-access-token');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/oauth2/v2.0/token'),
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('throws TeamsAuthError when refresh fails', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 401, text: () => Promise.resolve('Unauthorized') });
      await expect(service.getAccessToken({ clientId: 'c', tenantId: 't', refreshToken: 'bad-rt' })).rejects.toThrow('Token refresh failed');
    });
  });
});
