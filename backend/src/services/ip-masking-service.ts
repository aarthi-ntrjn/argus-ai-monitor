import { networkInterfaces } from 'os';
import { lanNetwork } from 'lan-network';

const IP_REFRESH_INTERVAL_MS = 3_600_000;
const MASKED_IP_RE = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.0$/;
const LOG_TAG = '[IpMaskingService]';

export class IpMaskingService {
  private maskedIp: string | null = null;
  private interfaceSnapshot = '';
  private refreshInterval: ReturnType<typeof setInterval> | null = null;

  async initialize(): Promise<void> {
    this.interfaceSnapshot = this.snapshotInterfaces();
    await this.detectAndCache();
    this.refreshInterval = setInterval(() => {
      const current = this.snapshotInterfaces();
      if (current !== this.interfaceSnapshot) {
        this.interfaceSnapshot = current;
        void this.detectAndCache();
      }
    }, IP_REFRESH_INTERVAL_MS);
  }

  getMaskedIp(): string | null {
    return this.maskedIp;
  }

  destroy(): void {
    if (this.refreshInterval !== null) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  private async detectAndCache(): Promise<void> {
    try {
      const result = await lanNetwork();
      if (result.internal) {
        console.warn(`${LOG_TAG} outbound IP detection failed: no external network interface found`);
        return;
      }
      const masked = this.maskIpLastOctet(result.address);
      if (masked !== null) {
        this.maskedIp = masked;
        console.info(`${LOG_TAG} outbound IP detected and masked`);
      } else {
        console.warn(`${LOG_TAG} outbound IP detection failed: unexpected address format`);
      }
    } catch (err) {
      console.warn(`${LOG_TAG} outbound IP detection failed`, { error: String(err) });
    }
  }

  private maskIpLastOctet(ip: string): string | null {
    const parts = ip.split('.');
    if (parts.length === 4) {
      parts[3] = '0';
      const masked = parts.join('.');
      return MASKED_IP_RE.test(masked) ? masked : null;
    }
    return null;
  }

  private snapshotInterfaces(): string {
    const ifaces = networkInterfaces();
    const relevant = Object.entries(ifaces)
      .flatMap(([name, addresses]) =>
        (addresses ?? [])
          .filter(a => !a.internal && a.family === 'IPv4')
          .map(a => `${name}:${a.address}`)
      )
      .sort();
    return relevant.join(',');
  }
}
