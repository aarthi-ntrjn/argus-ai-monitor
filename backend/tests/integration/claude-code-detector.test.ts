import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import { buildServer } from '../../src/server.js';

describe('ClaudeCodeDetector', () => {
  let request: ReturnType<typeof supertest>;
  let app: Awaited<ReturnType<typeof buildServer>>['app'];

  beforeAll(async () => {
    const result = await buildServer();
    app = result.app;
    await app.ready();
    request = supertest(app.server);
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /hooks/claude accepts hook payload', async () => {
    const payload = {
      hook_event_name: 'SessionStart',
      session_id: 'test-claude-session',
      cwd: 'C:\\source\\test-repo',
    };
    const res = await request.post('/hooks/claude').send(payload);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('POST /hooks/claude accepts PreToolUse payload', async () => {
    const payload = {
      hook_event_name: 'PreToolUse',
      session_id: 'test-claude-session',
      cwd: 'C:\\source\\test-repo',
      tool_name: 'bash',
      tool_input: { command: 'ls' },
    };
    const res = await request.post('/hooks/claude').send(payload);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});