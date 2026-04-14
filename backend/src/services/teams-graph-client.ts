const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

export class TeamsGraphError extends Error {
  constructor(public readonly code: string, message: string, public readonly statusCode: number) {
    super(message);
    this.name = 'TeamsGraphError';
  }
}

export interface GraphReply {
  id: string;
  from: { user: { id: string; displayName: string } };
  body: { content: string };
  createdDateTime: string;
}

async function graphFetch(url: string, accessToken: string, options?: RequestInit): Promise<Response> {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new TeamsGraphError('TEAMS_GRAPH_ERROR', `Graph API error ${res.status}: ${text}`, res.status);
  }
  return res;
}

export class TeamsGraphClient {
  async createThreadPost(teamId: string, channelId: string, accessToken: string, text: string): Promise<{ messageId: string }> {
    const url = `${GRAPH_BASE}/teams/${encodeURIComponent(teamId)}/channels/${encodeURIComponent(channelId)}/messages`;
    const res = await graphFetch(url, accessToken, {
      method: 'POST',
      body: JSON.stringify({ body: { contentType: 'html', content: text } }),
    });
    const data = await res.json() as { id: string };
    return { messageId: data.id };
  }

  async postReply(teamId: string, channelId: string, threadId: string, accessToken: string, text: string): Promise<{ messageId: string }> {
    const url = `${GRAPH_BASE}/teams/${encodeURIComponent(teamId)}/channels/${encodeURIComponent(channelId)}/messages/${encodeURIComponent(threadId)}/replies`;
    const res = await graphFetch(url, accessToken, {
      method: 'POST',
      body: JSON.stringify({ body: { contentType: 'html', content: `<pre>${text}</pre>` } }),
    });
    const data = await res.json() as { id: string };
    return { messageId: data.id };
  }

  async updateReply(teamId: string, channelId: string, threadId: string, replyId: string, accessToken: string, text: string): Promise<void> {
    const url = `${GRAPH_BASE}/teams/${encodeURIComponent(teamId)}/channels/${encodeURIComponent(channelId)}/messages/${encodeURIComponent(threadId)}/replies/${encodeURIComponent(replyId)}`;
    await graphFetch(url, accessToken, {
      method: 'PATCH',
      body: JSON.stringify({ body: { contentType: 'html', content: `<pre>${text}</pre>` } }),
    });
  }

  async pollReplies(teamId: string, channelId: string, threadId: string, accessToken: string, deltaLink?: string | null): Promise<{ replies: GraphReply[]; nextDeltaLink: string }> {
    const url = deltaLink ?? `${GRAPH_BASE}/teams/${encodeURIComponent(teamId)}/channels/${encodeURIComponent(channelId)}/messages/${encodeURIComponent(threadId)}/replies/delta`;
    const res = await graphFetch(url, accessToken);
    const data = await res.json() as { value: GraphReply[]; '@odata.deltaLink'?: string; '@odata.nextLink'?: string };
    const nextDeltaLink = data['@odata.deltaLink'] ?? data['@odata.nextLink'] ?? url;
    return { replies: data.value ?? [], nextDeltaLink };
  }

  async getMe(accessToken: string): Promise<{ id: string; displayName: string }> {
    const res = await graphFetch(`${GRAPH_BASE}/me`, accessToken);
    return res.json() as Promise<{ id: string; displayName: string }>;
  }
}
