const TOKEN_ENDPOINT_BASE = 'https://login.microsoftonline.com';
const GRAPH_SCOPE = 'https://graph.microsoft.com/.default';

export class TeamsBotAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TeamsBotAuthError';
  }
}

export class TeamsBotAuthService {
  async getAccessToken(config: { botAppId: string; botAppSecret: string; tenantId: string }): Promise<string> {
    const url = `${TOKEN_ENDPOINT_BASE}/${config.tenantId}/oauth2/v2.0/token`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.botAppId,
        client_secret: config.botAppSecret,
        grant_type: 'client_credentials',
        scope: GRAPH_SCOPE,
      }).toString(),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new TeamsBotAuthError(`Token request failed (${res.status}): ${text}`);
    }
    const data = await res.json() as { access_token: string };
    return data.access_token;
  }
}
