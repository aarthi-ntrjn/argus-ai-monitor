import type { FastifyPluginAsync } from 'fastify';
import { getSession } from '../../db/database.js';

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HOOK_BODY_LIMIT = 64 * 1024; // 64 KB

interface HookPayload {
  hook_event_name: string;
  session_id: string;
  cwd?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_result?: unknown;
  [key: string]: unknown;
}

let _claudeDetector: { handleHookPayload(p: HookPayload): Promise<void> } | null = null;

export function setClaudeDetector(detector: { handleHookPayload(p: HookPayload): Promise<void> }): void {
  _claudeDetector = detector;
}

const hooksRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Body: HookPayload }>(
    '/hooks/claude',
    { bodyLimit: HOOK_BODY_LIMIT },
    async (req, reply) => {
      const payload = req.body;
      const sessionId = payload?.session_id;

      // FR-006: session_id must be a UUID v4
      if (typeof sessionId !== 'string' || !UUID_V4_RE.test(sessionId)) {
        return reply.status(400).send({
          error: 'INVALID_SESSION_ID',
          message: 'session_id must be a valid UUID v4',
          requestId: req.id,
        });
      }

      // FR-004: reject if payload carries a pid that conflicts with the stored session pid
      if ('pid' in payload && typeof payload.pid === 'number') {
        const existing = getSession(sessionId);
        if (existing?.pid !== null && existing?.pid !== undefined && existing.pid !== payload.pid) {
          return reply.status(409).send({
            error: 'SESSION_PID_CONFLICT',
            message: 'Session already has an established PID',
            requestId: req.id,
          });
        }
      }

      if (_claudeDetector) {
        await _claudeDetector.handleHookPayload(payload);
      }
      return reply.send({ ok: true });
    },
  );
};

export default hooksRoutes;
