import { createSign, randomUUID } from 'crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { PublicClientApplication, InteractionRequiredAuthError, type Configuration, type TokenCacheContext } from '@azure/msal-node';

const TOKEN_ENDPOINT_BASE = 'https://login.microsoftonline.com';
const GRAPH_SCOPE_APP = 'https://graph.microsoft.com/.default';
const GRAPH_SCOPES_DELEGATED = ['https://graph.microsoft.com/ChannelMessage.Send', 'offline_access'];
const CLIENT_ASSERTION_TYPE = 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer';

export class TeamsBotAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TeamsBotAuthError';
  }
}

function buildClientAssertion(botAppId: string, tenantId: string, certPath: string, thumbprintHex: string): string {
  const now = Math.floor(Date.now() / 1000);
  const x5t = Buffer.from(thumbprintHex.replace(/:/g, ''), 'hex').toString('base64url');
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT', x5t })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    aud: `${TOKEN_ENDPOINT_BASE}/${tenantId}/oauth2/v2.0/token`,
    iss: botAppId,
    sub: botAppId,
    jti: randomUUID(),
    nbf: now,
    exp: now + 600,
  })).toString('base64url');
  const data = `${header}.${payload}`;
  const sign = createSign('RSA-SHA256');
  sign.update(data);
  const privateKeyPem = readFileSync(certPath, 'utf-8');
  const sig = sign.sign(privateKeyPem, 'base64url');
  return `${data}.${sig}`;
}

function getMsalCachePath(): string {
  return process.env.ARGUS_MSAL_CACHE_PATH ?? join(homedir(), '.argus', 'msal-token-cache.json');
}

function buildFileCachePlugin(): { beforeCacheAccess(ctx: TokenCacheContext): Promise<void>; afterCacheAccess(ctx: TokenCacheContext): Promise<void> } {
  const cachePath = getMsalCachePath();
  return {
    async beforeCacheAccess(ctx: TokenCacheContext) {
      if (existsSync(cachePath)) {
        ctx.tokenCache.deserialize(readFileSync(cachePath, 'utf-8'));
      }
    },
    async afterCacheAccess(ctx: TokenCacheContext) {
      if (ctx.cacheHasChanged) {
        mkdirSync(join(homedir(), '.argus'), { recursive: true });
        writeFileSync(cachePath, ctx.tokenCache.serialize(), 'utf-8');
      }
    },
  };
}

export class TeamsBotAuthService {
  private msalClient: PublicClientApplication | null = null;

  async getAccessToken(config: { botAppId: string; botAppSecret?: string; botCertPath?: string; botCertThumbprint?: string; tenantId: string }): Promise<string> {
    if (config.botCertPath && config.botCertThumbprint) {
      return this._getTokenWithCert(config as { botAppId: string; tenantId: string; botCertPath: string; botCertThumbprint: string });
    }
    if (config.botAppSecret) {
      return this._getTokenWithSecret(config as { botAppId: string; tenantId: string; botAppSecret: string });
    }
    return this._getTokenWithDeviceCode(config);
  }

  private async _getTokenWithCert(config: { botAppId: string; tenantId: string; botCertPath: string; botCertThumbprint: string }): Promise<string> {
    const url = `${TOKEN_ENDPOINT_BASE}/${config.tenantId}/oauth2/v2.0/token`;
    const assertion = buildClientAssertion(config.botAppId, config.tenantId, config.botCertPath, config.botCertThumbprint);
    const body = new URLSearchParams({
      client_id: config.botAppId,
      client_assertion_type: CLIENT_ASSERTION_TYPE,
      client_assertion: assertion,
      grant_type: 'client_credentials',
      scope: GRAPH_SCOPE_APP,
    });
    return this._fetchToken(url, body);
  }

  private async _getTokenWithSecret(config: { botAppId: string; tenantId: string; botAppSecret: string }): Promise<string> {
    const url = `${TOKEN_ENDPOINT_BASE}/${config.tenantId}/oauth2/v2.0/token`;
    const body = new URLSearchParams({
      client_id: config.botAppId,
      client_secret: config.botAppSecret,
      grant_type: 'client_credentials',
      scope: GRAPH_SCOPE_APP,
    });
    return this._fetchToken(url, body);
  }

  private async _getTokenWithDeviceCode(config: { botAppId: string; tenantId: string }): Promise<string> {
    if (!this.msalClient) {
      const msalConfig: Configuration = {
        auth: {
          clientId: config.botAppId,
          authority: `${TOKEN_ENDPOINT_BASE}/${config.tenantId}`,
        },
        cache: { cachePlugin: buildFileCachePlugin() },
      };
      this.msalClient = new PublicClientApplication(msalConfig);
    }

    const cache = this.msalClient.getTokenCache();
    const accounts = await cache.getAllAccounts();
    if (accounts.length > 0) {
      try {
        const result = await this.msalClient.acquireTokenSilent({ scopes: GRAPH_SCOPES_DELEGATED, account: accounts[0] });
        if (result) return result.accessToken;
      } catch (e) {
        if (!(e instanceof InteractionRequiredAuthError)) throw e;
      }
    }

    // Interactive: device code flow. Blocks until the user completes auth.
    const result = await this.msalClient.acquireTokenByDeviceCode({
      scopes: GRAPH_SCOPES_DELEGATED,
      deviceCodeCallback: (response) => {
        // Print to stdout so it's visible in any terminal
        process.stdout.write(`\n${'='.repeat(60)}\nTEAMS AUTH REQUIRED\n${response.message}\n${'='.repeat(60)}\n\n`);
      },
    });

    if (!result) throw new TeamsBotAuthError('Device code auth returned no result');
    return result.accessToken;
  }

  private async _fetchToken(url: string, body: URLSearchParams): Promise<string> {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new TeamsBotAuthError(`Token request failed (${res.status}): ${text}`);
    }
    const data = await res.json() as { access_token: string };
    return data.access_token;
  }
}
