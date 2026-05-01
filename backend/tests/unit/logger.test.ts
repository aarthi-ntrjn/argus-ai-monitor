import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Import after env setup so LOG_LEVEL changes take effect per-test via vi.stubEnv
const { createTaggedLogger, info, warn, error, debug } = await import('../../src/utils/logger.js');

describe('createTaggedLogger', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    warnSpy   = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy  = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('outputs [HH:MM:SS.mmm] bracketed timestamp', () => {
    const log = createTaggedLogger('[Test]', '');
    log.info('hello');
    const call = consoleSpy.mock.calls[0];
    expect(call[0]).toMatch(/^\[\d{2}:\d{2}:\d{2}\.\d{3}\]$/);
  });

  it('outputs INFO level label', () => {
    const log = createTaggedLogger('[Test]', '');
    log.info('hello');
    const call = consoleSpy.mock.calls[0];
    expect(call[1]).toContain('INFO');
  });

  it('outputs WARN level label via console.warn', () => {
    const log = createTaggedLogger('[Test]', '');
    log.warn('careful');
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0][1]).toContain('WARN');
  });

  it('outputs ERROR level label via console.error', () => {
    const log = createTaggedLogger('[Test]', '');
    log.error('boom');
    expect(errorSpy).toHaveBeenCalledOnce();
    expect(errorSpy.mock.calls[0][1]).toContain('ERROR');
  });

  it('includes the tag in the output', () => {
    const log = createTaggedLogger('[MyComponent]', '');
    log.info('msg');
    const call = consoleSpy.mock.calls[0];
    expect(call[2]).toContain('[MyComponent]');
  });

  it('passes message args after the tag', () => {
    const log = createTaggedLogger('[Test]', '');
    log.info('the message', 'extra');
    const call = consoleSpy.mock.calls[0];
    expect(call[3]).toBe('the message');
    expect(call[4]).toBe('extra');
  });

  it('suppresses debug output when LOG_LEVEL=info (default)', () => {
    // envLevel is read once at module load; default is 'info', so debug is suppressed
    const log = createTaggedLogger('[Test]', '');
    log.debug('hidden');
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('emits info, warn, error at default LOG_LEVEL', () => {
    const log = createTaggedLogger('[Test]', '');
    log.info('a');
    log.warn('b');
    log.error('c');
    expect(consoleSpy).toHaveBeenCalledOnce();
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(errorSpy).toHaveBeenCalledOnce();
  });
});

describe('module-level logger exports', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    warnSpy   = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy  = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('info() logs with INFO label', () => {
    info('test');
    expect(consoleSpy.mock.calls[0][1]).toContain('INFO');
  });

  it('warn() logs with WARN label via console.warn', () => {
    warn('test');
    expect(warnSpy.mock.calls[0][1]).toContain('WARN');
  });

  it('error() logs with ERROR label via console.error', () => {
    error('test');
    expect(errorSpy.mock.calls[0][1]).toContain('ERROR');
  });

  it('debug() is suppressed at default LOG_LEVEL=info', () => {
    debug('hidden');
    expect(consoleSpy).not.toHaveBeenCalled();
  });
});
