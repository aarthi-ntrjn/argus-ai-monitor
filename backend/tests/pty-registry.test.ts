import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PtyRegistry } from '../src/services/pty-registry.js';

// Minimal WebSocket mock: only what PtyRegistry uses
function makeMockWs() {
  return { send: vi.fn(), readyState: 1 as const };
}

// Helper: register pending and claim in one step
function registerAndClaim(registry: PtyRegistry, claudeId: string, repoPath = '/repo', pid = 1234) {
  const ws = makeMockWs();
  registry.registerPending('temp-' + claudeId, ws as any, repoPath, pid);
  registry.claimForSession(claudeId, repoPath, 'claude-code');
  return ws;
}

describe('PtyRegistry', () => {
  let registry: PtyRegistry;

  beforeEach(() => {
    registry = new PtyRegistry();
  });

  it('has() returns false before any registration', () => {
    expect(registry.has('session-1')).toBe(false);
  });

  it('has() returns true after registerPending + claimForSession', () => {
    registerAndClaim(registry, 'session-1');
    expect(registry.has('session-1')).toBe(true);
  });

  it('has() returns false after unregister()', () => {
    registerAndClaim(registry, 'session-1');
    registry.unregister('session-1');
    expect(registry.has('session-1')).toBe(false);
  });

  it('claimForSession returns null when no pending launcher exists for that path', () => {
    expect(registry.claimForSession('any', '/no/pending', 'claude-code')).toBeNull();
  });

  it('claimForSession returns hostPid and null pid when a pending launcher exists', () => {
    const ws = makeMockWs();
    registry.registerPending('t', ws as any, '/repo', 9999);
    expect(registry.claimForSession('s', '/repo', 'claude-code')).toMatchObject({ pid: null, hostPid: 9999 });
  });

  it('getClaimedId returns the claude session ID after claim', () => {
    registerAndClaim(registry, 'claude-abc', '/r', 42);
    expect(registry.getClaimedId('temp-claude-abc')).toBe('claude-abc');
  });

  it('getClaimedId returns undefined before claim', () => {
    const ws = makeMockWs();
    registry.registerPending('temp-x', ws as any, '/r2', 1);
    expect(registry.getClaimedId('temp-x')).toBeUndefined();
  });

  it('unregisterPending cleans up so subsequent claim returns null', () => {
    const ws = makeMockWs();
    registry.registerPending('t', ws as any, '/r3', 5);
    registry.unregisterPending('/r3', 't');
    expect(registry.claimForSession('any', '/r3', 'claude-code')).toBeNull();
  });

  it('sendPrompt() sends correct JSON message on the WebSocket', async () => {
    const ws = registerAndClaim(registry, 'session-1', '/rp', 1);

    const promise = registry.sendPrompt('session-1', 'action-abc', 'do something');
    registry.handleAck('action-abc', true);
    await promise;

    expect(ws.send).toHaveBeenCalledOnce();
    const sent = JSON.parse(ws.send.mock.calls[0][0] as string);
    expect(sent).toEqual({ type: 'send_prompt', actionId: 'action-abc', prompt: 'do something' });
  });

  it('sendPrompt() resolves when handleAck(success=true) is called', async () => {
    registerAndClaim(registry, 'session-1', '/rp2', 2);
    const promise = registry.sendPrompt('session-1', 'action-ok', 'hi');
    registry.handleAck('action-ok', true);
    await expect(promise).resolves.toBeUndefined();
  });

  it('sendPrompt() rejects when handleAck(success=false) is called', async () => {
    registerAndClaim(registry, 'session-1', '/rp3', 3);
    const promise = registry.sendPrompt('session-1', 'action-fail', 'hi');
    registry.handleAck('action-fail', false, 'PTY write error');
    await expect(promise).rejects.toThrow('PTY write error');
  });

  it('sendPrompt() rejects immediately when no launcher is registered', async () => {
    await expect(
      registry.sendPrompt('no-such-session', 'action-x', 'hi')
    ).rejects.toThrow(/not connected/i);
  });

  it('handleAck() for unknown actionId is a no-op (does not throw)', () => {
    expect(() => registry.handleAck('unknown-action', true)).not.toThrow();
  });

  it('claimByPtyLaunchId returns hostPid and null pid when pending entry found', () => {
    const ws = makeMockWs();
    registry.registerPending('temp-abc', ws as any, '/repo', 7777);
    const result = registry.claimByPtyLaunchId('temp-abc', 'workspace-session-1');
    expect(result).toMatchObject({ pid: null, hostPid: 7777 });
    expect(registry.has('workspace-session-1')).toBe(true);
  });

  it('claimByPtyLaunchId returns null when tempId not found', () => {
    expect(registry.claimByPtyLaunchId('no-such-temp', 'any-session')).toBeNull();
  });

  it('claimByPtyLaunchId sets getClaimedId mapping', () => {
    const ws = makeMockWs();
    registry.registerPending('temp-xyz', ws as any, '/repo2', 8888);
    registry.claimByPtyLaunchId('temp-xyz', 'workspace-session-2');
    expect(registry.getClaimedId('temp-xyz')).toBe('workspace-session-2');
  });

  it('claimByPtyLaunchId removes pending entry so subsequent claimForSession returns null', () => {
    const ws = makeMockWs();
    registry.registerPending('temp-def', ws as any, '/repo3', 9999);
    registry.claimByPtyLaunchId('temp-def', 'workspace-session-3');
    expect(registry.claimForSession('other', '/repo3', 'claude-code')).toBeNull();
  });

  it('sendPrompt() rejects after timeout when no ack arrives', async () => {
    vi.useFakeTimers();
    registerAndClaim(registry, 'session-1', '/rp4', 4);

    const promise = registry.sendPrompt('session-1', 'action-timeout', 'hi', 100);
    vi.advanceTimersByTime(200);

    await expect(promise).rejects.toThrow(/timed out/i);
    vi.useRealTimers();
  });
});
