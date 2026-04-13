import type { TeamsConfig } from '../models/index.js';

export class TeamsApiError extends Error {
  constructor(public readonly code: string, message: string, public readonly statusCode?: number) {
    super(message);
    this.name = 'TeamsApiError';
  }
}

export class TeamsApiClient {
  private tokenCache: { token: string; expiresAt: number } | null = null;

  async getToken(config: Pick<TeamsConfig, 'botAppId' | 'botAppPassword' | 'tenantId'>): Promise<string> {
    const now = Date.now();
    if (this.tokenCache && this.tokenCache.expiresAt > now + 60_000) {
      return this.tokenCache.token;
    }
    const tenant = config.tenantId ?? 'botframework.com';
    const res = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: config.botAppId,
        client_secret: config.botAppPassword,
        scope: 'https://api.botframework.com/.default',
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new TeamsApiError('TEAMS_TOKEN_FAILED', `Failed to acquire Bot Framework token: ${text}`, res.status);
    }
    const data = await res.json() as { access_token: string; expires_in: number };
    this.tokenCache = { token: data.access_token, expiresAt: now + data.expires_in * 1000 };
    return data.access_token;
  }

  async createThread(config: TeamsConfig, text: string): Promise<{ threadId: string; messageId: string }> {
    const token = await this.getToken(config);
    const url = `${config.serviceUrl.replace(/\/$/, '')}/v3/conversations`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bot: { id: config.botAppId },
        isGroup: false,
        channelData: { channel: { id: config.channelId } },
        activity: { type: 'message', text },
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new TeamsApiError('TEAMS_CREATE_THREAD_FAILED', `Failed to create Teams thread: ${text}`, res.status);
    }
    const data = await res.json() as { id: string; activityId: string };
    return { threadId: data.id, messageId: data.activityId };
  }

  async updateMessage(config: TeamsConfig, threadId: string, messageId: string, text: string): Promise<void> {
    const token = await this.getToken(config);
    const url = `${config.serviceUrl.replace(/\/$/, '')}/v3/conversations/${encodeURIComponent(threadId)}/activities/${encodeURIComponent(messageId)}`;
    const res = await fetch(url, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'message', text }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new TeamsApiError('TEAMS_UPDATE_MESSAGE_FAILED', `Failed to update Teams message: ${text}`, res.status);
    }
  }

  async postReply(config: TeamsConfig, threadId: string, text: string): Promise<{ messageId: string }> {
    const token = await this.getToken(config);
    const url = `${config.serviceUrl.replace(/\/$/, '')}/v3/conversations/${encodeURIComponent(threadId)}/activities`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'message', text }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new TeamsApiError('TEAMS_POST_REPLY_FAILED', `Failed to post Teams reply: ${text}`, res.status);
    }
    const data = await res.json() as { id: string };
    return { messageId: data.id };
  }

  async validateConnection(config: TeamsConfig): Promise<void> {
    await this.getToken(config);
  }

  clearTokenCache(): void {
    this.tokenCache = null;
  }
}
