import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/db/database.js', () => ({
  getSession: vi.fn(),
  insertControlAction: vi.fn(),
  updateControlAction: vi.fn(),
}));

vi.mock('../../src/services/pty-registry.js', () => ({
  ptyRegistry: {
    has: vi.fn(),
    sendPrompt: vi.fn(),
  },
}));

vi.mock('../../src/api/ws/event-dispatcher.js', () => ({
  broadcast: vi.fn(),
}));

// Mock ps-list so PID ownership validation is controlled in tests
let mockPsListResult: Array<{ pid: number; name: string; cmd?: string }> = [];
vi.mock('ps-list', () => ({
  default: vi.fn(async () => mockPsListResult),
}));

// Mock child_process.spawnSync so we can assert it is used (not exec)
const mockSpawnSync = vi.fn(() => ({ status: 0, error: undefined }));
vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  return { ...actual, spawnSync: mockSpawnSync };
});

describe('SessionController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPsListResult = [];
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
      model: null,
    };
    (getSession as ReturnType<typeof vi.fn>).mockReturnValue(mockSession);

    const controller = new SessionController();
    const action = await controller.sendPrompt('test-session', 'Hello!');
    // copilot-cli sessions without PTY launchMode now return failed with actionable message
    expect(action.status).toBe('failed');
    expect(action.type).toBe('send_prompt');
    expect(action.result).toMatch(/argus launch/i);
  });

  it('calls spawnSync (not exec) for interruptSession on Windows',async () => {
    const { getSession, insertControlAction, updateControlAction } = await import('../../src/db/database.js');
    const { SessionController } = await import('../../src/services/session-controller.js');

    mockPsListResult = [{ pid: 6666, name: 'claude', cmd: 'claude' }];
    (getSession as ReturnType<typeof vi.fn>).mockReturnValue({
      id: 'interrupt-session',
      repositoryId: 'repo-1',
      type: 'claude-code',
      pid: 6666,
      status: 'active',
      startedAt: new Date().toISOString(),
      endedAt: null,
      lastActivityAt: new Date().toISOString(),
      summary: null,
      expiresAt: null,
      model: null,
    });
    (insertControlAction as ReturnType<typeof vi.fn>).mockImplementation(() => {});
    (updateControlAction as ReturnType<typeof vi.fn>).mockImplementation(() => {});

    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });

    const controller = new SessionController();
    await controller.interruptSession('interrupt-session');

    expect(mockSpawnSync).toHaveBeenCalledWith('taskkill', ['/PID', '6666']);

    Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
  });
});

describe('SessionController — sendPrompt PTY routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function makeSession(overrides: Record<string, unknown> = {}) {
    return {
      id: 'pty-session',
      repositoryId: 'repo-1',
      type: 'claude-code',
      launchMode: 'pty',
      pid: 1234,
      status: 'active',
      startedAt: new Date().toISOString(),
      endedAt: null,
      lastActivityAt: new Date().toISOString(),
      summary: null,
      expiresAt: null,
      model: null,
      ...overrides,
    };
  }

  it('returns failed action immediately for detected sessions', async () => {
    const { getSession, insertControlAction } = await import('../../src/db/database.js');
    const { SessionController } = await import('../../src/services/session-controller.js');
    (getSession as ReturnType<typeof vi.fn>).mockReturnValue(makeSession({ launchMode: 'detected' }));
    (insertControlAction as ReturnType<typeof vi.fn>).mockImplementation(() => {});

    const controller = new SessionController();
    const action = await controller.sendPrompt('pty-session', 'hello');

    expect(action.status).toBe('failed');
    expect(action.result).toMatch(/argus launch/i);
  });

  it('returns failed action when launchMode is null (legacy detected session)', async () => {
    const { getSession, insertControlAction } = await import('../../src/db/database.js');
    const { SessionController } = await import('../../src/services/session-controller.js');
    (getSession as ReturnType<typeof vi.fn>).mockReturnValue(makeSession({ launchMode: null }));
    (insertControlAction as ReturnType<typeof vi.fn>).mockImplementation(() => {});

    const controller = new SessionController();
    const action = await controller.sendPrompt('pty-session', 'hello');

    expect(action.status).toBe('failed');
    expect(action.result).toMatch(/argus launch/i);
  });

  it('returns failed action immediately when PTY session has no connected launcher', async () => {
    const { getSession, insertControlAction } = await import('../../src/db/database.js');
    const { ptyRegistry } = await import('../../src/services/pty-registry.js');
    const { SessionController } = await import('../../src/services/session-controller.js');
    (getSession as ReturnType<typeof vi.fn>).mockReturnValue(makeSession());
    (insertControlAction as ReturnType<typeof vi.fn>).mockImplementation(() => {});
    (ptyRegistry.has as ReturnType<typeof vi.fn>).mockReturnValue(false);

    const controller = new SessionController();
    const action = await controller.sendPrompt('pty-session', 'hello');

    expect(action.status).toBe('failed');
    expect(action.result).toMatch(/not connected/i);
  });

  it('returns pending action and fires delivery when PTY launcher is connected', async () => {
    const { getSession, insertControlAction } = await import('../../src/db/database.js');
    const { ptyRegistry } = await import('../../src/services/pty-registry.js');
    const { SessionController } = await import('../../src/services/session-controller.js');
    (getSession as ReturnType<typeof vi.fn>).mockReturnValue(makeSession());
    (insertControlAction as ReturnType<typeof vi.fn>).mockImplementation(() => {});
    (ptyRegistry.has as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (ptyRegistry.sendPrompt as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const controller = new SessionController();
    const action = await controller.sendPrompt('pty-session', 'do something');

    expect(action.status).toBe('pending');
    expect(ptyRegistry.sendPrompt).toHaveBeenCalledWith('pty-session', action.id, 'do something', undefined, false);
  });
});
