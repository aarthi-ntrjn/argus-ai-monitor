import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PtyRegistry } from '../src/services/pty-registry.js';

// Minimal WebSocket mock: only what PtyRegistry uses
function makeMockWs() {
  return { send: vi.fn(), readyState: 1 as const };
}

describe('PtyRegistry', () => {
  let registry: PtyRegistry;

  beforeEach(() => {
    registry = new PtyRegistry();
  });

  it('has() returns false before registration', () => {
    expect(registry.has('session-1')).toBe(false);
  });

  it('has() returns true after register()', () => {
    registry.register('session-1', makeMockWs() as any);
    expect(registry.has('session-1')).toBe(true);
  });

  it('has() returns false after unregister()', () => {
    registry.register('session-1', makeMockWs() as any);
    registry.unregister('session-1');
    expect(registry.has('session-1')).toBe(false);
  });

  it('register() overwrites an existing connection', () => {
    const ws1 = makeMockWs();
    const ws2 = makeMockWs();
    registry.register('session-1', ws1 as any);
    registry.register('session-1', ws2 as any);
    // Sending a prompt should use ws2, not ws1
    registry.sendPrompt('session-1', 'action-1', 'hello').catch(() => {});
    expect(ws2.send).toHaveBeenCalled();
    expect(ws1.send).not.toHaveBeenCalled();
  });

  it('sendPrompt() sends correct JSON message on the WebSocket', async () => {
    const ws = makeMockWs();
    registry.register('session-1', ws as any);

    const promise = registry.sendPrompt('session-1', 'action-abc', 'do something');
    registry.handleAck('action-abc', true);
    await promise;

    expect(ws.send).toHaveBeenCalledOnce();
    const sent = JSON.parse(ws.send.mock.calls[0][0] as string);
    expect(sent).toEqual({ type: 'send_prompt', actionId: 'action-abc', prompt: 'do something' });
  });

  it('sendPrompt() resolves when handleAck(success=true) is called', async () => {
    const ws = makeMockWs();
    registry.register('session-1', ws as any);

    const promise = registry.sendPrompt('session-1', 'action-ok', 'hi');
    registry.handleAck('action-ok', true);
    await expect(promise).resolves.toBeUndefined();
  });

  it('sendPrompt() rejects when handleAck(success=false) is called', async () => {
    const ws = makeMockWs();
    registry.register('session-1', ws as any);

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

  it('sendPrompt() rejects after timeout when no ack arrives', async () => {
    vi.useFakeTimers();
    const ws = makeMockWs();
    registry.register('session-1', ws as any);

    const promise = registry.sendPrompt('session-1', 'action-timeout', 'hi', 100);
    vi.advanceTimersByTime(200);

    await expect(promise).rejects.toThrow(/timed out/i);
    vi.useRealTimers();
  });
});
