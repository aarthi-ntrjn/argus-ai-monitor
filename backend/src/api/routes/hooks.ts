import type { FastifyPluginAsync } from 'fastify';

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
  app.post<{ Body: HookPayload }>('/hooks/claude', async (req, reply) => {
    const payload = req.body;
    if (_claudeDetector) {
      await _claudeDetector.handleHookPayload(payload);
    }
    return reply.send({ ok: true });
  });
};

export default hooksRoutes;