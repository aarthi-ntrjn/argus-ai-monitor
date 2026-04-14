import { randomUUID } from 'crypto';
import type { FastifyPluginAsync } from 'fastify';
import { getTeamsThreadByTeamsId, insertControlAction } from '../../db/database.js';
import { loadTeamsConfig } from '../../config/teams-config-loader.js';

const BOT_FRAMEWORK_ISSUER = 'https://login.microsoftonline.com/botframework.com/v2.0';
const BOT_FRAMEWORK_AUDIENCE = 'https://api.botframework.com';

interface BotActivity {
  type: string;
  from?: { id?: string; aadObjectId?: string };
  conversation?: { id?: string };
  text?: string;
  channelData?: { teamsChannelId?: string; channel?: { id?: string } };
}

function extractThreadId(conversationId: string | undefined): string | null {
  if (!conversationId) return null;
  // Teams conversation IDs for channel messages look like: 19:xxx@thread.tacv2;messageid=<threadId>
  const match = conversationId.match(/messageid=([^;]+)/);
  return match ? match[1] : null;
}

function verifyBotAppId(authHeader: string | undefined, expectedBotAppId: string): boolean {
  if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) return false;
  try {
    const token = authHeader.slice(7);
    const [, payloadB64] = token.split('.');
    if (!payloadB64) return false;
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as Record<string, unknown>;
    return payload['appid'] === expectedBotAppId || payload['azp'] === expectedBotAppId;
  } catch {
    return false;
  }
}

const teamsWebhookRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Body: BotActivity }>('/api/v1/teams/webhook', async (req, reply) => {
    const config = loadTeamsConfig();

    if (!config.enabled || !config.botAppId) {
      return reply.status(200).send();
    }

    const authHeader = req.headers['authorization'] as string | undefined;
    if (!verifyBotAppId(authHeader, config.botAppId)) {
      req.log.warn({ source: 'teams.webhook' }, 'teams.webhook.auth.failed');
      return reply.status(401).send({ error: 'UNAUTHORIZED' });
    }

    const activity = req.body;
    if (activity.type !== 'message' || !activity.text?.trim()) {
      return reply.status(200).send();
    }

    const senderAadObjectId = activity.from?.aadObjectId;
    if (!senderAadObjectId || senderAadObjectId !== config.ownerAadObjectId) {
      req.log.info({ senderAadObjectId, source: 'teams.webhook' }, 'teams.webhook.command.rejected');
      return reply.status(200).send();
    }

    const threadId = extractThreadId(activity.conversation?.id);
    if (!threadId) {
      return reply.status(200).send();
    }

    const thread = getTeamsThreadByTeamsId(threadId);
    if (!thread) {
      req.log.warn({ threadId, source: 'teams.webhook' }, 'teams.webhook.unknown.thread');
      return reply.status(200).send();
    }

    const text = activity.text.trim();
    insertControlAction({
      id: randomUUID(),
      sessionId: thread.sessionId,
      type: 'send_prompt',
      payload: { text },
      status: 'pending',
      createdAt: new Date().toISOString(),
      completedAt: null,
      result: null,
      source: 'Teams',
    });
    req.log.info({ sessionId: thread.sessionId, source: 'Teams' }, 'teams.webhook.command.received');

    return reply.status(200).send();
  });
};

export default teamsWebhookRoutes;
