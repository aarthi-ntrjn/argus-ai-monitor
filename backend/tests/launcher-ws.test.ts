import { describe, it, expect, vi, beforeEach } from 'vitest';
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

describe('PtyRegistry — pending / claim flow', () => {
  let registry: PtyRegistry;

  beforeEach(() => {
    registry = new PtyRegistry();
    vi.clearAllMocks();
  });

  it('registerPending + claimForSession promotes to a live connection', async () => {
    const mockWs = { send: vi.fn(), readyState: 1 };
    registry.registerPending('temp-uuid', mockWs as any, '/repo/path', 8348);

    const claimed = registry.claimForSession('claude-session-id', '/repo/path', 'claude-code');
    expect(claimed).toMatchObject({ pid: null, hostPid: 8348 });
    expect(registry.has('claude-session-id')).toBe(true);
  });

  it('claimForSession returns null when no pending launcher for that path', () => {
    const result = registry.claimForSession('any-session', '/no/pending/here', 'claude-code');
    expect(result).toBeNull();
  });

  it('getClaimedId returns the claude session ID for a given temp UUID', () => {
    const mockWs = { send: vi.fn(), readyState: 1 };
    registry.registerPending('temp-1', mockWs as any, '/repo', 1234);
    registry.claimForSession('claude-abc', '/repo', 'claude-code');
    expect(registry.getClaimedId('temp-1')).toBe('claude-abc');
  });

  it('getClaimedId returns undefined before claim', () => {
    const mockWs = { send: vi.fn(), readyState: 1 };
    registry.registerPending('temp-2', mockWs as any, '/repo2', 999);
    expect(registry.getClaimedId('temp-2')).toBeUndefined();
  });

  it('unregisterPending cleans up without claim', () => {
    const mockWs = { send: vi.fn(), readyState: 1 };
    registry.registerPending('temp-3', mockWs as any, '/repo3', 111);
    registry.unregisterPending('/repo3', 'temp-3');
    expect(registry.claimForSession('any', '/repo3', 'claude-code')).toBeNull();
  });

  it('sendPrompt on claimed session sends to the WebSocket', async () => {
    const mockWs = { send: vi.fn(), readyState: 1 };
    registry.registerPending('temp-4', mockWs as any, '/repo4', 5678);
    registry.claimForSession('claude-xyz', '/repo4', 'claude-code');

    const p = registry.sendPrompt('claude-xyz', 'action-1', 'run tests');
    registry.handleAck('action-1', true);
    await p;

    const msg = JSON.parse(mockWs.send.mock.calls[0][0] as string);
    expect(msg).toMatchObject({ type: 'send_prompt', actionId: 'action-1', prompt: 'run tests' });
  });

  it('prompt_delivered ack resolves the pending promise', async () => {
    const mockWs = { send: vi.fn(), readyState: 1 };
    registry.registerPending('t', mockWs as any, '/r', 1);
    registry.claimForSession('s1', '/r', 'claude-code');

    const p = registry.sendPrompt('s1', 'a1', 'hello');
    registry.handleAck('a1', true);
    await expect(p).resolves.toBeUndefined();
  });

  it('prompt_failed ack rejects the pending promise with the error message', async () => {
    const mockWs = { send: vi.fn(), readyState: 1 };
    registry.registerPending('t2', mockWs as any, '/r2', 2);
    registry.claimForSession('s2', '/r2', 'claude-code');

    const p = registry.sendPrompt('s2', 'a2', 'hello');
    registry.handleAck('a2', false, 'PTY closed');
    await expect(p).rejects.toThrow('PTY closed');
  });

  it('claimByPtyLaunchId promotes pending connection to claimed by sessionId', () => {
    const mockWs = { send: vi.fn(), readyState: 1 };
    registry.registerPending('temp-copilot', mockWs as any, '/repo/copilot', 4444);
    const result = registry.claimByPtyLaunchId('temp-copilot', 'workspace-uuid-1');
    expect(result).toMatchObject({ pid: null, hostPid: 4444 });
    expect(registry.has('workspace-uuid-1')).toBe(true);
  });

  it('claimByPtyLaunchId returns null when tempId is not pending', () => {
    expect(registry.claimByPtyLaunchId('no-such-temp', 'ws-id')).toBeNull();
  });

  it('claimByPtyLaunchId allows sendPrompt after claim', async () => {
    const mockWs = { send: vi.fn(), readyState: 1 };
    registry.registerPending('temp-cp2', mockWs as any, '/repo/cp2', 5555);
    registry.claimByPtyLaunchId('temp-cp2', 'ws-session-2');
    const p = registry.sendPrompt('ws-session-2', 'act-1', 'hello');
    registry.handleAck('act-1', true);
    await expect(p).resolves.toBeUndefined();
  });

  it('claimByPtyLaunchId removes pending entry so claimForSession returns null for same path', () => {
    const mockWs = { send: vi.fn(), readyState: 1 };
    registry.registerPending('temp-cp3', mockWs as any, '/repo/cp3', 6666);
    registry.claimByPtyLaunchId('temp-cp3', 'ws-session-3');
    expect(registry.claimForSession('other', '/repo/cp3', 'claude-code')).toBeNull();
  });

  it('unregister removes the claimed session', async () => {
    const mockWs = { send: vi.fn(), readyState: 1 };
    registry.registerPending('t3', mockWs as any, '/r3', 3);
    registry.claimForSession('s3', '/r3', 'claude-code');
    registry.unregister('s3');
    await expect(registry.sendPrompt('s3', 'a3', 'hi')).rejects.toThrow(/not connected/i);
  });
});
