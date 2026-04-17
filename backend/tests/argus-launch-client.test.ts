import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ArgusLaunchClient } from '../src/cli/argus-launch-client.js';

// Mock ws so tests don't open real connections.
// send() accepts an optional callback (called when data is flushed).
// once() + close() simulate the close handshake.
const { MockWebSocket } = vi.hoisted(() => {
  const ctor = vi.fn().mockImplementation(() => {
    const listeners = new Map<string, Function[]>();
    const addListener = (event: string, cb: Function) => {
      if (!listeners.has(event)) listeners.set(event, []);
      listeners.get(event)!.push(cb);
    };
    const emit = (event: string, ...args: unknown[]) => {
      (listeners.get(event) ?? []).forEach((cb) => cb(...args));
    };
    return {
      on: vi.fn((event: string, cb: Function) => addListener(event, cb)),
      once: vi.fn((event: string, cb: Function) => addListener(event, cb)),
      send: vi.fn((_data: string, cb?: () => void) => { if (cb) cb(); }),
      close: vi.fn(function () {
        // Simulate async close: fire the 'close' listeners on next tick
        setTimeout(() => emit('close'), 0);
      }),
      readyState: 1,
      emit,
      _listeners: listeners,
    };
  });
  (ctor as unknown as { OPEN: number }).OPEN = 1;
  return { MockWebSocket: ctor };
});

vi.mock('ws', () => ({
  default: MockWebSocket,
  WebSocket: MockWebSocket,
}));

describe('ArgusLaunchClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends register message on open', async () => {
    const client = new ArgusLaunchClient('ws://127.0.0.1:7411/launcher');
    const mockWs = (client as any).ws;

    const messageHandler = mockWs.on.mock.calls.find((c: string[]) => c[0] === 'message')?.[1];
    expect(messageHandler).toBeDefined();

    const registerInfo = { sessionId: 'abc-123', hostPid: 5555, pid: null, sessionType: 'claude-code' as const, cwd: '/tmp' };
    client.setRegisterInfo(registerInfo);
    messageHandler(Buffer.from(JSON.stringify({ type: 'connected', ptyLaunchId: 'server-generated-id' })));

    expect(mockWs.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'register', ...registerInfo })
    );
  });

  it('invokes onSendPrompt callback when send_prompt message arrives', () => {
    const client = new ArgusLaunchClient('ws://127.0.0.1:7411/launcher');
    const mockWs = (client as any).ws;

    const onPrompt = vi.fn();
    client.onSendPrompt(onPrompt);

    const messageHandler = mockWs.on.mock.calls.find((c: string[]) => c[0] === 'message')?.[1];
    expect(messageHandler).toBeDefined();

    messageHandler(Buffer.from(JSON.stringify({ type: 'send_prompt', actionId: 'action-1', prompt: 'do something' })));
    expect(onPrompt).toHaveBeenCalledWith('action-1', 'do something');
  });

  it('sends prompt_delivered after successful delivery', () => {
    const client = new ArgusLaunchClient('ws://127.0.0.1:7411/launcher');
    const mockWs = (client as any).ws;
    mockWs.readyState = 1;

    client.ackDelivered('action-99');
    expect(mockWs.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'prompt_delivered', actionId: 'action-99' })
    );
  });

  it('sends prompt_failed with error message', () => {
    const client = new ArgusLaunchClient('ws://127.0.0.1:7411/launcher');
    const mockWs = (client as any).ws;
    mockWs.readyState = 1;

    client.ackFailed('action-88', 'PTY closed');
    expect(mockWs.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'prompt_failed', actionId: 'action-88', error: 'PTY closed' })
    );
  });

  it('sends session_ended and waits for WS close before resolving', async () => {
    const client = new ArgusLaunchClient('ws://127.0.0.1:7411/launcher');
    const mockWs = (client as any).ws;
    mockWs.readyState = 1;

    const promise = client.notifySessionEnded('sess-1', 0);
    expect(mockWs.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'session_ended', sessionId: 'sess-1', exitCode: 0 }),
      expect.any(Function)
    );
    expect(mockWs.close).toHaveBeenCalled();

    // Promise resolves after the close event fires (async via setTimeout)
    await promise;
  });

  it('notifySessionEnded resolves immediately if WS is not open', async () => {
    const client = new ArgusLaunchClient('ws://127.0.0.1:7411/launcher');
    const mockWs = (client as any).ws;
    mockWs.readyState = 3; // CLOSED

    await client.notifySessionEnded('sess-2', 1);
    expect(mockWs.send).not.toHaveBeenCalled();
    expect(mockWs.close).not.toHaveBeenCalled();
  });

  it('reconnects automatically after unexpected WS close and re-sends register on reconnect', async () => {
    vi.useFakeTimers();
    try {
      const client = new ArgusLaunchClient('ws://127.0.0.1:7411/launcher');
      expect(MockWebSocket).toHaveBeenCalledTimes(1);

      const registerInfo = { sessionId: 'abc', hostPid: 1, pid: 1, sessionType: 'claude-code' as const, cwd: '/tmp' };
      client.setRegisterInfo(registerInfo);

      // Trigger unexpected close on the first WS
      const firstWs = MockWebSocket.mock.results[0].value;
      firstWs.emit('close');

      // Advance timers to trigger the 2-second reconnect delay
      vi.advanceTimersByTime(2100);

      // A second WebSocket should have been created
      expect(MockWebSocket).toHaveBeenCalledTimes(2);

      // Simulate the second WS opening and server sending connected — it should re-send the register message
      const secondWs = MockWebSocket.mock.results[1].value;
      const messageHandler = secondWs.on.mock.calls.find((c: string[]) => c[0] === 'message')?.[1];
      expect(messageHandler).toBeDefined();
      messageHandler(Buffer.from(JSON.stringify({ type: 'connected', ptyLaunchId: 'server-id-2' })));

      expect(secondWs.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'register', ...registerInfo })
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('handleOpen does not send workspace_id on reconnect', () => {
    const client = new ArgusLaunchClient('ws://127.0.0.1:7411/launcher');
    const mockWs = (client as any).ws;

    const registerInfo = { sessionId: 'abc', hostPid: 1, pid: 1, sessionType: 'copilot-cli' as const, cwd: '/tmp' };
    client.setRegisterInfo(registerInfo);

    const messageHandler = mockWs.on.mock.calls.find((c: string[]) => c[0] === 'message')?.[1];
    messageHandler(Buffer.from(JSON.stringify({ type: 'connected', ptyLaunchId: 'server-id' })));

    const sent = mockWs.send.mock.calls.map((c: string[]) => JSON.parse(c[0]));
    expect(sent.every((m: { type: string }) => m.type !== 'workspace_id')).toBe(true);
  });

  it('register replay on reconnect carries the resolved pidwhen updatePid was called while WS was open', async () => {
    vi.useFakeTimers();
    try {
      const client = new ArgusLaunchClient('ws://127.0.0.1:7411/launcher');
      const firstWs = MockWebSocket.mock.results[0].value;
      firstWs.readyState = 1;

      // Initial register with pid: null (Windows — pid resolved later via update_pid)
      const registerInfo = { sessionId: 'abc', hostPid: 9000, pid: null, sessionType: 'copilot-cli' as const, cwd: '/tmp' };
      client.setRegisterInfo(registerInfo);

      // updatePid called while WS is open — sends update_pid immediately
      client.updatePid(9999);
      expect(firstWs.send).toHaveBeenCalledWith(JSON.stringify({ type: 'update_pid', pid: 9999 }));

      // Backend restarts: WS closes unexpectedly, client reconnects
      firstWs.emit('close');
      vi.advanceTimersByTime(2100);

      const secondWs = MockWebSocket.mock.results[1].value;
      const messageHandler = secondWs.on.mock.calls.find((c: string[]) => c[0] === 'message')?.[1];
      messageHandler(Buffer.from(JSON.stringify({ type: 'connected', ptyLaunchId: 'server-id-2' })));

      // register replay must include the resolved pid (9999), not the original null
      const sent = secondWs.send.mock.calls.map((c: string[]) => JSON.parse(c[0]));
      const registerMsg = sent.find((m: { type: string }) => m.type === 'register');
      expect(registerMsg).toBeDefined();
      expect(registerMsg.pid).toBe(9999);
    } finally {
      vi.useRealTimers();
    }
  });

  it('notifySessionEnded sets isClosing flag and prevents reconnect after intentional shutdown', async () => {
    vi.useFakeTimers();
    try {
      const client = new ArgusLaunchClient('ws://127.0.0.1:7411/launcher');
      expect(MockWebSocket).toHaveBeenCalledTimes(1);

      const firstWs = MockWebSocket.mock.results[0].value;
      firstWs.readyState = 1;

      // Intentional shutdown via notifySessionEnded
      const promise = client.notifySessionEnded('sess-3', 0);
      // Advance timers to fire the mock close event (setTimeout 0ms) so the promise resolves
      vi.runAllTimers();
      await promise;

      // Advance further — no reconnect should be scheduled since isClosing=true
      vi.advanceTimersByTime(5000);

      // Still only one WebSocket — reconnect was blocked by isClosing
      expect(MockWebSocket).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
