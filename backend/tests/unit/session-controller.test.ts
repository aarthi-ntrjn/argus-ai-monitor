import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database module
vi.mock('../../src/db/database.js', () => ({
  getSession: vi.fn(),
  insertControlAction: vi.fn(),
  updateControlAction: vi.fn(),
}));

vi.mock('../../src/api/ws/event-dispatcher.js', () => ({
  broadcast: vi.fn(),
}));

describe('SessionController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns not_supported action for copilot-cli sendPrompt', async () => {
    const { getSession } = await import('../../src/db/database.js');
    const { SessionController } = await import('../../src/services/session-controller.js');

    const mockSession = {
      id: 'test-session',
      repositoryId: 'repo-1',
      type: 'copilot-cli',
      pid: 1234,
      status: 'active',
      startedAt: new Date().toISOString(),
      endedAt: null,
      lastActivityAt: new Date().toISOString(),
      summary: null,
      expiresAt: null,
    };
    (getSession as ReturnType<typeof vi.fn>).mockReturnValue(mockSession);

    const controller = new SessionController();
    const action = await controller.sendPrompt('test-session', 'Hello!');
    expect(action.status).toBe('not_supported');
    expect(action.type).toBe('send_prompt');
  });

  it('creates control action for stopSession', async () => {
    const { getSession, insertControlAction } = await import('../../src/db/database.js');
    const { SessionController } = await import('../../src/services/session-controller.js');

    const mockSession = {
      id: 'test-session',
      repositoryId: 'repo-1',
      type: 'copilot-cli',
      pid: 99999, // unlikely PID
      status: 'active',
      startedAt: new Date().toISOString(),
      endedAt: null,
      lastActivityAt: new Date().toISOString(),
      summary: null,
      expiresAt: null,
    };
    (getSession as ReturnType<typeof vi.fn>).mockReturnValue(mockSession);
    (insertControlAction as ReturnType<typeof vi.fn>).mockImplementation(() => {});

    const controller = new SessionController();
    // This will fail to kill PID 99999 but should still create the action
    try {
      await controller.stopSession('test-session');
    } catch {
      // ignore kill errors in test
    }
    // insertControlAction should have been called
    expect(insertControlAction).toHaveBeenCalled();
  });
});
