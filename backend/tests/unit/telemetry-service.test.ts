import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { writeFileSync, rmSync, existsSync } from 'fs';

// Must set env before importing the module under test
const testIdPath = join(tmpdir(), `argus-telemetry-id-test-${randomUUID()}`);
process.env.ARGUS_TELEMETRY_ID_PATH = testIdPath;
process.env.TELEMETRY_URL = 'http://localhost:19999/capture/';

// Dynamic import so env is set first
const { TelemetryService } = await import('../../src/services/telemetry-service.js');

describe('TelemetryService', () => {
  let service: InstanceType<typeof TelemetryService>;

  beforeEach(() => {
    // Fresh instance and clean ID file for each test
    if (existsSync(testIdPath)) rmSync(testIdPath);
    service = new TelemetryService();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    if (existsSync(testIdPath)) rmSync(testIdPath);
  });

  describe('loadOrCreateInstallationId', () => {
    it('creates and persists a UUID when the file does not exist', () => {
      const id = service.loadOrCreateInstallationId();
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      expect(existsSync(testIdPath)).toBe(true);
    });

    it('returns the same ID on repeated calls (idempotent)', () => {
      const first = service.loadOrCreateInstallationId();
      const second = service.loadOrCreateInstallationId();
      expect(first).toBe(second);
    });

    it('regenerates a new ID when the file is empty', () => {
      writeFileSync(testIdPath, '', 'utf-8');
      const id = service.loadOrCreateInstallationId();
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('regenerates a new ID when the file contains invalid content', () => {
      writeFileSync(testIdPath, 'not-a-uuid', 'utf-8');
      const id = service.loadOrCreateInstallationId();
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });
  });

  describe('readAppVersion', () => {
    it('returns a non-empty string', () => {
      const version = service.readAppVersion();
      expect(typeof version).toBe('string');
      expect(version.length).toBeGreaterThan(0);
    });
  });

  describe('sendEvent', () => {
    it('returns immediately without awaiting network (fire-and-forget)', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 200 }));
      const start = Date.now();
      service.sendEvent('app_started');
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(50);
      fetchSpy.mockRestore();
    });

    it('is a no-op when TELEMETRY_URL is empty', () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      const originalUrl = process.env.TELEMETRY_URL;
      process.env.TELEMETRY_URL = '';
      service.sendEvent('app_started');
      expect(fetchSpy).not.toHaveBeenCalled();
      process.env.TELEMETRY_URL = originalUrl;
      fetchSpy.mockRestore();
    });

    it('does not throw when fetch rejects', () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network error'));
      expect(() => service.sendEvent('app_started')).not.toThrow();
    });

    it('does not throw when endpoint returns 500', () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 500 }));
      expect(() => service.sendEvent('app_started')).not.toThrow();
    });

    it('includes sessionType in payload for session_started events', () => {
      let capturedBody: string | undefined;
      vi.spyOn(globalThis, 'fetch').mockImplementation((_url, init) => {
        capturedBody = init?.body as string;
        return Promise.resolve(new Response(null, { status: 200 }));
      });
      service.sendEvent('session_started', { sessionType: 'claude-code' });
      const payload = JSON.parse(capturedBody ?? '{}');
      expect(payload.properties?.sessionType).toBe('claude-code');
    });
  });

  describe('resilience', () => {
    it('completes without throwing when URL is non-routable (simulated via rejected fetch)', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(Object.assign(new Error('ECONNREFUSED'), { name: 'AbortError' }));
      expect(() => service.sendEvent('app_started')).not.toThrow();
      // Allow microtasks to flush
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    it('does not throw when the endpoint returns 500', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 500 }));
      expect(() => service.sendEvent('app_started')).not.toThrow();
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    it('calling sendEvent 100 times in rapid succession does not throw or block', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 200 }));
      const start = Date.now();
      for (let i = 0; i < 100; i++) {
        service.sendEvent('app_started');
      }
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(200);
      // Allow promises to settle
      await new Promise(resolve => setTimeout(resolve, 50));
    });
  });
});
