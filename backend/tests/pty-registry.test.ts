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

  it('claimForSession finds the matching sessionType when multiple launchers are pending for the same repo', () => {
    const wsC = makeMockWs();
    const wsP = makeMockWs();
    // Register a copilot-cli launcher first (simulates a reconnecting old launcher)
    registry.registerPending('copilot-launch-1', wsP as any, '/repo', 1001, null, 'copilot-cli');
    // Register a claude-code launcher second
    registry.registerPending('claude-launch-1', wsC as any, '/repo', 2002, null, 'claude-code');

    // Claude Code hook fires: should claim the claude-code entry, not the copilot-cli one
    const claimed = registry.claimForSession('claude-session-1', '/repo', 'claude-code');
    expect(claimed).not.toBeNull();
    expect(claimed!.ptyLaunchId).toBe('claude-launch-1');
    expect(registry.has('claude-session-1')).toBe(true);

    // The copilot-cli entry should still be pending
    const copilotClaimed = registry.claimForSession('copilot-session-1', '/repo', 'copilot-cli');
    expect(copilotClaimed).not.toBeNull();
    expect(copilotClaimed!.ptyLaunchId).toBe('copilot-launch-1');
  });

  it('re-registering the same ptyLaunchId replaces its own entry, not others', () => {
    const ws1 = makeMockWs();
    const ws2 = makeMockWs();
    registry.registerPending('launch-a', ws1 as any, '/repo', 1111, null, 'claude-code');
    registry.registerPending('launch-b', ws2 as any, '/repo', 2222, null, 'claude-code');

    // Re-register launch-a (reconnect scenario)
    const ws1b = makeMockWs();
    registry.registerPending('launch-a', ws1b as any, '/repo', 3333, null, 'claude-code');

    // Both entries still present; launch-a updated
    const claimedA = registry.claimForSession('s-a', '/repo', 'claude-code');
    expect(claimedA).not.toBeNull();
    const claimedB = registry.claimForSession('s-b', '/repo', 'claude-code');
    expect(claimedB).not.toBeNull();
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
