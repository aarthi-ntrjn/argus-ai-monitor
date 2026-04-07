import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PtyRegistry } from '../src/services/pty-registry.js';

// Unit-level tests for the launcher route logic via the PtyRegistry contract.
// These verify message routing without spinning up a Fastify server.

vi.mock('../src/db/database.js', () => ({
  getSession: vi.fn(),
  upsertSession: vi.fn(),
  updateSessionStatus: vi.fn(),
  getRepositoryByPath: vi.fn(),
  insertRepository: vi.fn(),
}));

vi.mock('../src/api/ws/event-dispatcher.js', () => ({
  broadcast: vi.fn(),
}));

describe('Launcher WebSocket message handling (PtyRegistry integration)', () => {
  let registry: PtyRegistry;

  beforeEach(() => {
    registry = new PtyRegistry();
    vi.clearAllMocks();
  });

  it('register() + sendPrompt() sends message to the registered WebSocket', async () => {
    const mockWs = { send: vi.fn(), readyState: 1 };
    registry.register('session-abc', mockWs as any);

    const p = registry.sendPrompt('session-abc', 'action-1', 'run tests');
    registry.handleAck('action-1', true);
    await p;

    const msg = JSON.parse(mockWs.send.mock.calls[0][0] as string);
    expect(msg).toMatchObject({ type: 'send_prompt', actionId: 'action-1', prompt: 'run tests' });
  });

  it('prompt_delivered ack resolves the pending promise', async () => {
    const mockWs = { send: vi.fn(), readyState: 1 };
    registry.register('s1', mockWs as any);

    const p = registry.sendPrompt('s1', 'a1', 'hello');
    registry.handleAck('a1', true);
    await expect(p).resolves.toBeUndefined();
  });

  it('prompt_failed ack rejects the pending promise with the error message', async () => {
    const mockWs = { send: vi.fn(), readyState: 1 };
    registry.register('s1', mockWs as any);

    const p = registry.sendPrompt('s1', 'a2', 'hello');
    registry.handleAck('a2', false, 'PTY closed');
    await expect(p).rejects.toThrow('PTY closed');
  });

  it('unregister() removes the session so subsequent sendPrompt() rejects', async () => {
    const mockWs = { send: vi.fn(), readyState: 1 };
    registry.register('s2', mockWs as any);
    registry.unregister('s2');
    await expect(registry.sendPrompt('s2', 'a3', 'hi')).rejects.toThrow(/not connected/i);
  });

  it('on disconnect (unregister without session_ended) registry cleans up', () => {
    const mockWs = { send: vi.fn(), readyState: 1 };
    registry.register('s3', mockWs as any);
    expect(registry.has('s3')).toBe(true);
    registry.unregister('s3');
    expect(registry.has('s3')).toBe(false);
  });
});
