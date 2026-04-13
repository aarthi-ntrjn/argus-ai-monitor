import type { FastifyPluginAsync } from 'fastify';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { getTeamsThreadByTeamsId, getSession, insertControlAction } from '../../db/database.js';
import { loadTeamsConfig } from '../../config/teams-config-loader.js';
import { TeamsApiClient } from '../../services/teams-api-client.js';
import { randomUUID } from 'crypto';
import type { ControlAction } from '../../models/index.js';

const BOT_FRAMEWORK_OIDC = 'https://login.botframework.com/v1/.well-known/openidconfiguration';
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

async function getJwks() {
  if (!jwks) {
    const oidcRes = await fetch(BOT_FRAMEWORK_OIDC);
    const oidc = await oidcRes.json() as { jwks_uri: string };
    jwks = createRemoteJWKSet(new URL(oidc.jwks_uri));
  }
  return jwks;
}

export async function validateBotFrameworkToken(authHeader: string | undefined): Promise<boolean> {
  if (!authHeader?.startsWith('Bearer ')) return false;
  const token = authHeader.slice(7);
  try {
    const keySet = await getJwks();
    await jwtVerify(token, keySet, { issuer: 'https://api.botframework.com' });
    return true;
  } catch {
    return false;
  }
}

// Mutable auth reference so vi.mock factories can override the validator in tests
export const _auth = { validateToken: validateBotFrameworkToken };

interface BotActivity {
  type: string;
  from?: { id: string; name?: string };
  conversation?: { id: string };
  text?: string;
  [key: string]: unknown;
}

const teamsApiClient = new TeamsApiClient();

async function handleOwnerCommand(req: any, reply: any, thread: any, activity: BotActivity, _config: any): Promise<void> {
  const action: ControlAction = {
    id: randomUUID(),
    sessionId: thread.sessionId,
    type: 'send_prompt',
    payload: { text: activity.text ?? '', source: 'Teams' },
    status: 'pending',
    createdAt: new Date().toISOString(),
    completedAt: null,
    result: null,
  };
  insertControlAction(action);
  req.log.info({ sessionId: thread.sessionId, source: 'Teams' }, 'teams.command.received');
  return reply.send({});
}

const teamsWebhookRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Body: BotActivity }>('/api/botframework/messages', async (req, reply) => {
    const valid = await _auth.validateToken(req.headers.authorization);
    if (!valid) {
      return reply.status(401).send({ error: 'UNAUTHORIZED', message: 'Bot Framework token validation failed.', requestId: req.id });
    }

    const activity = req.body;
    if (!activity?.from || !activity?.conversation?.id) {
      return reply.status(400).send({ error: 'INVALID_ACTIVITY', message: 'Activity body is missing required fields.', requestId: req.id });
    }

    if (activity.type !== 'message') return reply.send({});

    const config = loadTeamsConfig();
    const thread = getTeamsThreadByTeamsId(activity.conversation.id);
    if (!thread) return reply.send({});

    const session = getSession(thread.sessionId);
    const isActive = session && !['completed', 'ended', 'error'].includes(session.status);

    if (!isActive) {
      try {
        await teamsApiClient.postReply(config as any, thread.teamsThreadId, 'This session has ended and is no longer accepting commands.');
      } catch { /* best-effort */ }
      return reply.send({});
    }

    const isOwner = activity.from.id === config.ownerTeamsUserId;
    if (!isOwner) {
      try {
        await teamsApiClient.postReply(config as any, thread.teamsThreadId, 'Only the session owner can send commands to this session.');
        req.log.info({ fromId: activity.from.id, sessionId: thread.sessionId }, 'teams.command.rejected');
      } catch { /* best-effort */ }
      return reply.send({});
    }

    return handleOwnerCommand(req, reply, thread, activity, config);
  });
};

export default teamsWebhookRoutes;
