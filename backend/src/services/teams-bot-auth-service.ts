import { createSign, randomUUID } from 'crypto';
import { readFileSync } from 'fs';

const TOKEN_ENDPOINT_BASE = 'https://login.microsoftonline.com';
const GRAPH_SCOPE = 'https://graph.microsoft.com/.default';
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

type AuthConfig = { botAppId: string; tenantId: string } & (
  | { botAppSecret: string; botCertPath?: never; botCertThumbprint?: never }
  | { botAppSecret?: never; botCertPath: string; botCertThumbprint: string }
);

export class TeamsBotAuthService {
  async getAccessToken(config: { botAppId: string; botAppSecret?: string; botCertPath?: string; botCertThumbprint?: string; tenantId: string }): Promise<string> {
    const url = `${TOKEN_ENDPOINT_BASE}/${config.tenantId}/oauth2/v2.0/token`;

    let body: URLSearchParams;
    if (config.botCertPath && config.botCertThumbprint) {
      const assertion = buildClientAssertion(config.botAppId, config.tenantId, config.botCertPath, config.botCertThumbprint);
      body = new URLSearchParams({
        client_id: config.botAppId,
        client_assertion_type: CLIENT_ASSERTION_TYPE,
        client_assertion: assertion,
        grant_type: 'client_credentials',
        scope: GRAPH_SCOPE,
      });
    } else if (config.botAppSecret) {
      body = new URLSearchParams({
        client_id: config.botAppId,
        client_secret: config.botAppSecret,
        grant_type: 'client_credentials',
        scope: GRAPH_SCOPE,
      });
    } else {
      throw new TeamsBotAuthError('No authentication method configured: provide botAppSecret or botCertPath + botCertThumbprint');
    }

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
