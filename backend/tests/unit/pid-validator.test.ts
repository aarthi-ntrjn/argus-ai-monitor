import { describe, it, expect, vi, beforeEach } from 'vitest';

let mockProcessList: Array<{ pid: number; name: string; cmd?: string }> = [];

vi.mock('ps-list', () => ({
  default: vi.fn(async () => mockProcessList),
}));

describe('validatePidOwnership', () => {
  beforeEach(() => {
    vi.resetModules();
    mockProcessList = [];
  });

  it('rejects a non-integer pid', async () => {
    const { validatePidOwnership } = await import('../../src/services/pid-validator.js');
    const result = await validatePidOwnership(3.14, 'claude-code');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('process_not_found');
  });

  it('rejects a zero pid', async () => {
    const { validatePidOwnership } = await import('../../src/services/pid-validator.js');
    const result = await validatePidOwnership(0, 'claude-code');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('process_not_found');
  });

  it('rejects a negative pid', async () => {
    const { validatePidOwnership } = await import('../../src/services/pid-validator.js');
    const result = await validatePidOwnership(-1, 'claude-code');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('process_not_found');
  });

  it('rejects a pid not found in OS process list', async () => {
    mockProcessList = [{ pid: 1111, name: 'claude', cmd: 'claude' }];
    const { validatePidOwnership } = await import('../../src/services/pid-validator.js');
    const result = await validatePidOwnership(9999, 'claude-code');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('process_not_found');
  });

  it('rejects a pid that belongs to a non-AI-tool process (claude-code type)', async () => {
    mockProcessList = [{ pid: 5555, name: 'chrome', cmd: '/usr/bin/chrome' }];
    const { validatePidOwnership } = await import('../../src/services/pid-validator.js');
    const result = await validatePidOwnership(5555, 'claude-code');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('process_not_ai_tool');
  });

  it('rejects a pid that belongs to a non-AI-tool process (copilot-cli type)', async () => {
    mockProcessList = [{ pid: 5556, name: 'node', cmd: '/usr/bin/node index.js' }];
    const { validatePidOwnership } = await import('../../src/services/pid-validator.js');
    const result = await validatePidOwnership(5556, 'copilot-cli');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('process_not_ai_tool');
  });

  it('accepts a valid claude-code pid matched by process name', async () => {
    mockProcessList = [{ pid: 1234, name: 'claude', cmd: '/usr/local/bin/claude' }];
    const { validatePidOwnership } = await import('../../src/services/pid-validator.js');
    const result = await validatePidOwnership(1234, 'claude-code');
    expect(result.valid).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('rejects a claude-code pid when only cmd matches but name does not', async () => {
    mockProcessList = [{ pid: 2345, name: 'node', cmd: '/usr/local/bin/claude --version' }];
    const { validatePidOwnership } = await import('../../src/services/pid-validator.js');
    const result = await validatePidOwnership(2345, 'claude-code');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('process_not_ai_tool');
  });

  it('accepts a valid copilot-cli pid matched by name copilot', async () => {
    mockProcessList = [{ pid: 3456, name: 'copilot', cmd: 'copilot suggest' }];
    const { validatePidOwnership } = await import('../../src/services/pid-validator.js');
    const result = await validatePidOwnership(3456, 'copilot-cli');
    expect(result.valid).toBe(true);
  });

  it('accepts a valid copilot-cli pid matched by name copilot.exe', async () => {
    mockProcessList = [{ pid: 4567, name: 'copilot.exe', cmd: '' }];
    const { validatePidOwnership } = await import('../../src/services/pid-validator.js');
    const result = await validatePidOwnership(4567, 'copilot-cli');
    expect(result.valid).toBe(true);
  });

  it('is case-insensitive for process name matching', async () => {
    mockProcessList = [{ pid: 6789, name: 'Claude', cmd: '/Applications/Claude.app/claude' }];
    const { validatePidOwnership } = await import('../../src/services/pid-validator.js');
    const result = await validatePidOwnership(6789, 'claude-code');
    expect(result.valid).toBe(true);
  });

  it('does not cross-match session types (claude pid rejected for copilot-cli session)', async () => {
    mockProcessList = [{ pid: 7890, name: 'claude', cmd: 'claude' }];
    const { validatePidOwnership } = await import('../../src/services/pid-validator.js');
    const result = await validatePidOwnership(7890, 'copilot-cli');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('process_not_ai_tool');
  });
});
