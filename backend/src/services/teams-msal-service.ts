import { PublicClientApplication } from '@azure/msal-node';

const GRAPH_BASE = 'https://login.microsoftonline.com';
const SCOPES = [
  'https://graph.microsoft.com/ChannelMessage.Send',
  'https://graph.microsoft.com/ChannelMessage.Read.All',
  'https://graph.microsoft.com/User.Read',
];

export class TeamsAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TeamsAuthError';
  }
}

export interface DeviceCodeInfo {
  userCode: string;
  verificationUrl: string;
  expiresIn: number;
  message: string;
}

export type DeviceCodeResult =
  | { status: 'pending' }
  | { status: 'completed'; accessToken: string; refreshToken: string; ownerUserId: string; displayName: string }
  | { status: 'expired'; message: string };

interface PendingFlow {
  pca: PublicClientApplication;
  resolved: boolean;
  result?: DeviceCodeResult;
}

const pendingFlows = new Map<string, PendingFlow>();

function flowKey(clientId: string, tenantId: string): string {
  return `${clientId}:${tenantId}`;
}

function extractRefreshTokenFromCache(pca: PublicClientApplication): string {
  try {
    const cache = JSON.parse(pca.getTokenCache().serialize());
    const rtMap: Record<string, { secret: string }> = cache.RefreshToken ?? {};
    const first = Object.values(rtMap)[0];
    return first?.secret ?? '';
  } catch {
    return '';
  }
}

export class TeamsMsalService {
  async initiateDeviceCodeFlow(clientId: string, tenantId: string): Promise<DeviceCodeInfo> {
    const pca = new PublicClientApplication({
      auth: { clientId, authority: `${GRAPH_BASE}/${tenantId}` },
    });

    let resolveDeviceInfo!: (info: DeviceCodeInfo) => void;
    const deviceInfoPromise = new Promise<DeviceCodeInfo>(r => { resolveDeviceInfo = r; });

    const flow: PendingFlow = { pca, resolved: false };
    pendingFlows.set(flowKey(clientId, tenantId), flow);

    pca.acquireTokenByDeviceCode({
      scopes: SCOPES,
      deviceCodeCallback: (resp) => {
        resolveDeviceInfo({
          userCode: resp.userCode,
          verificationUrl: resp.verificationUri,
          expiresIn: resp.expiresIn,
          message: resp.message,
        });
      },
    }).then(result => {
      if (!result) {
        flow.result = { status: 'expired', message: 'No result returned from device code flow.' };
      } else {
        const refreshToken = extractRefreshTokenFromCache(pca);
        flow.result = {
          status: 'completed',
          accessToken: result.accessToken,
          refreshToken,
          ownerUserId: result.account?.localAccountId ?? result.account?.homeAccountId ?? '',
          displayName: result.account?.name ?? '',
        };
      }
      flow.resolved = true;
    }).catch(err => {
      flow.result = { status: 'expired', message: (err as Error).message ?? 'Authentication failed.' };
      flow.resolved = true;
    });

    return deviceInfoPromise;
  }

  async pollDeviceCodeFlow(clientId: string, tenantId: string): Promise<DeviceCodeResult> {
    const key = flowKey(clientId, tenantId);
    const flow = pendingFlows.get(key);
    if (!flow) return { status: 'expired', message: 'No pending authentication flow. Restart the process.' };
    if (!flow.resolved) return { status: 'pending' };
    pendingFlows.delete(key);
    return flow.result!;
  }

  async getAccessToken(config: { clientId: string; tenantId: string; refreshToken: string }): Promise<string> {
    const url = `${GRAPH_BASE}/${config.tenantId}/oauth2/v2.0/token`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.clientId,
        grant_type: 'refresh_token',
        refresh_token: config.refreshToken,
        scope: SCOPES.join(' '),
      }).toString(),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new TeamsAuthError(`Token refresh failed (${res.status}): ${text}`);
    }
    const data = await res.json() as { access_token: string };
    return data.access_token;
  }
}
