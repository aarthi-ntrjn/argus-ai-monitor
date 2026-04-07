import { describe, it, expect } from 'vitest';
import { resolveLaunchCommand } from '../src/cli/launch-command-resolver.js';

describe('resolveLaunchCommand', () => {
  it('resolves "claude" to claude-code session type', () => {
    const result = resolveLaunchCommand(['claude']);
    expect(result).toEqual({ sessionType: 'claude-code', cmd: 'claude', cmdArgs: [] });
  });

  it('resolves "claude" with extra args', () => {
    const result = resolveLaunchCommand(['claude', '--dangerously-skip-permissions']);
    expect(result).toEqual({
      sessionType: 'claude-code',
      cmd: 'claude',
      cmdArgs: ['--dangerously-skip-permissions'],
    });
  });

  it('resolves "gh copilot" to copilot-cli session type', () => {
    const result = resolveLaunchCommand(['gh', 'copilot', 'suggest']);
    expect(result).toEqual({
      sessionType: 'copilot-cli',
      cmd: 'gh',
      cmdArgs: ['copilot', 'suggest'],
    });
  });

  it('resolves "gh copilot" without subcommand', () => {
    const result = resolveLaunchCommand(['gh', 'copilot']);
    expect(result).toEqual({ sessionType: 'copilot-cli', cmd: 'gh', cmdArgs: ['copilot'] });
  });

  it('defaults to claude-code for unknown commands', () => {
    const result = resolveLaunchCommand(['mycli', '--some-flag']);
    expect(result).toEqual({ sessionType: 'claude-code', cmd: 'mycli', cmdArgs: ['--some-flag'] });
  });

  it('throws for empty args', () => {
    expect(() => resolveLaunchCommand([])).toThrow(/no command/i);
  });
});
