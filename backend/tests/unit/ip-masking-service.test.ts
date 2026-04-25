import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('lan-network', () => ({
  lanNetwork: vi.fn(),
}));

import { lanNetwork } from 'lan-network';
import { IpMaskingService } from '../../src/services/ip-masking-service.js';

const mockLanNetwork = vi.mocked(lanNetwork);

const makeAssignment = (address: string, internal = false) => ({
  iname: 'eth0',
  address,
  netmask: '255.255.255.0',
  mac: 'aa:bb:cc:dd:ee:ff',
  internal,
  cidr: `${address}/24`,
  family: 'IPv4' as const,
  gateway: '192.168.1.1',
});

describe('IpMaskingService', () => {
  let service: IpMaskingService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new IpMaskingService();
  });

  afterEach(() => {
    service.destroy();
  });

  describe('getMaskedIp before initialize', () => {
    it('returns null before initialize() is called', () => {
      expect(service.getMaskedIp()).toBeNull();
    });
  });

  describe('initialize — successful detection', () => {
    it('sets maskedIp to x.x.x.0 after successful detection', async () => {
      mockLanNetwork.mockResolvedValue(makeAssignment('192.168.1.100'));
      await service.initialize();
      expect(service.getMaskedIp()).toBe('192.168.1.0');
    });

    it('zeros the last octet for any valid IPv4', async () => {
      mockLanNetwork.mockResolvedValue(makeAssignment('10.0.25.87'));
      await service.initialize();
      expect(service.getMaskedIp()).toBe('10.0.25.0');
    });

    it('zeros the last octet at the boundary (last octet 255)', async () => {
      mockLanNetwork.mockResolvedValue(makeAssignment('172.16.0.255'));
      await service.initialize();
      expect(service.getMaskedIp()).toBe('172.16.0.0');
    });
  });

  describe('initialize — failed detection', () => {
    it('leaves maskedIp null when lan-network returns an internal (loopback) address', async () => {
      mockLanNetwork.mockResolvedValue(makeAssignment('127.0.0.1', true));
      await service.initialize();
      expect(service.getMaskedIp()).toBeNull();
    });

    it('leaves maskedIp null when lan-network throws', async () => {
      mockLanNetwork.mockRejectedValue(new Error('no network'));
      await service.initialize();
      expect(service.getMaskedIp()).toBeNull();
    });
  });

  describe('destroy', () => {
    it('can be called before initialize without throwing', () => {
      expect(() => service.destroy()).not.toThrow();
    });

    it('can be called multiple times without throwing', async () => {
      mockLanNetwork.mockResolvedValue(makeAssignment('192.168.1.1'));
      await service.initialize();
      expect(() => {
        service.destroy();
        service.destroy();
      }).not.toThrow();
    });

    it('clears the refresh interval so getMaskedIp still returns cached value', async () => {
      mockLanNetwork.mockResolvedValue(makeAssignment('192.168.1.50'));
      await service.initialize();
      service.destroy();
      expect(service.getMaskedIp()).toBe('192.168.1.0');
    });
  });
});
