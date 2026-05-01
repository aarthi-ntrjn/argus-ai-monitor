import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';
import { randomUUID } from 'crypto';
import type { TelemetryEventType } from '../models/index.js';
import { loadConfig } from '../config/config-loader.js';
import { createTaggedLogger } from '../utils/logger.js';

const log = createTaggedLogger('[Telemetry]', '\x1b[90m'); // dark gray

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// PostHog project API key — write-only, intentionally public (cannot read analytics data).
const POSTHOG_API_KEY = 'phc_utcNEdTjgVREGCdpmyDeMWVwjDmL9LBZSFvhrNkPUZGr';
const POSTHOG_URL = 'https://app.posthog.com/capture/';

function getIdPath(): string {
  return process.env.ARGUS_TELEMETRY_ID_PATH ?? join(homedir(), '.argus', 'telemetry-id');
}

export class TelemetryService {
  private installationId: string | null = null;
  private appVersion: string | null = null;
  private enabledCache: { value: boolean; expiresAt: number } | null = null;
  private integrationStatus: Record<string, boolean> = {};

  setIntegrationStatus(platform: string, running: boolean): void {
    this.integrationStatus[platform] = running;
  }

  private isTelemetryEnabled(): boolean {
    const now = Date.now();
    if (this.enabledCache && now < this.enabledCache.expiresAt) {
      return this.enabledCache.value;
    }
    const value = loadConfig().telemetryEnabled;
    this.enabledCache = { value, expiresAt: now + 5000 };
    return value;
  }

  loadOrCreateInstallationId(): string {
    if (this.installationId) return this.installationId;
    const idPath = getIdPath();
    try {
      const existing = readFileSync(idPath, 'utf-8').trim();
      if (UUID_RE.test(existing)) {
        this.installationId = existing;
        return existing;
      }
    } catch {
      // File missing or unreadable — generate a new one
    }
    const id = randomUUID();
    try {
      mkdirSync(dirname(idPath), { recursive: true });
      writeFileSync(idPath, id, 'utf-8');
    } catch (err) {
      log.warn('failed to persist installation ID', String(err));
    }
    log.info('generated new installation ID');
    this.installationId = id;
    return id;
  }

  readAppVersion(): string {
    if (this.appVersion) return this.appVersion;
    try {
      const pkgPath = fileURLToPath(new URL('../../../package.json', import.meta.url));
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      this.appVersion = typeof pkg.version === 'string' ? pkg.version : 'unknown';
    } catch {
      this.appVersion = 'unknown';
    }
    return this.appVersion!;
  }

  sendEvent(type: TelemetryEventType, extra?: Record<string, string | boolean | null>): void {
    if (!this.isTelemetryEnabled()) return;
    const url = process.env.TELEMETRY_URL ?? POSTHOG_URL;
    if (!url) return;

    const installationId = this.loadOrCreateInstallationId();
    const appVersion = this.readAppVersion();
    const integrationProps = Object.fromEntries(
      Object.entries(this.integrationStatus).map(([k, v]) => [`${k}_enabled`, v]),
    );
    const payload = {
      api_key: POSTHOG_API_KEY,
      distinct_id: installationId,
      event: type,
      properties: { appVersion, ...integrationProps, ...extra },
      timestamp: new Date().toISOString(),
    };

    log.info(`sendEvent type=${type} appVersion=${appVersion}`);

    void (async () => {
      try {
        await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(2000),
        });
      } catch {
        // Silent — telemetry must never affect product behaviour
      }
    })();
  }
}

export const telemetryService = new TelemetryService();
