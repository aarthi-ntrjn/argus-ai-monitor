import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getTeamsSettings, patchTeamsSettings, initiateDeviceCodeFlow, pollDeviceCodeFlow,
  type TeamsSettings, type DeviceCodeInfo,
} from '../services/api.js';

export type AuthState = 'idle' | 'device-code-pending' | 'authenticated';

export function useTeamsSettings() {
  const [config, setConfig] = useState<TeamsSettings | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authState, setAuthState] = useState<AuthState>('idle');
  const [deviceCodeInfo, setDeviceCodeInfo] = useState<DeviceCodeInfo | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    getTeamsSettings().then(cfg => {
      setConfig(cfg);
      if (cfg.refreshToken) setAuthState('authenticated');
    }).catch(e => setError(e.message));
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const save = useCallback(async (patch: Partial<TeamsSettings>) => {
    setIsSaving(true);
    setError(null);
    try {
      const updated = await patchTeamsSettings(patch);
      setConfig(updated);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsSaving(false);
    }
  }, []);

  const startAuth = useCallback(async (clientId: string, tenantId: string) => {
    setError(null);
    try {
      const info = await initiateDeviceCodeFlow(clientId, tenantId);
      setDeviceCodeInfo(info);
      setAuthState('device-code-pending');

      pollIntervalRef.current = setInterval(async () => {
        const result = await pollDeviceCodeFlow(clientId, tenantId).catch(() => null);
        if (!result) return;
        if (result.status === 'completed') {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          setAuthState('authenticated');
          setDeviceCodeInfo(null);
          const updated = await getTeamsSettings();
          setConfig(updated);
        } else if (result.status === 'expired') {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          setAuthState('idle');
          setDeviceCodeInfo(null);
          setError('Authentication expired. Please try again.');
        }
      }, 5000);
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  const pollAuth = useCallback(async (clientId: string, tenantId: string) => {
    const result = await pollDeviceCodeFlow(clientId, tenantId);
    if (result.status === 'completed') {
      setAuthState('authenticated');
      setDeviceCodeInfo(null);
      const updated = await getTeamsSettings();
      setConfig(updated);
    } else if (result.status === 'expired') {
      setAuthState('idle');
      setDeviceCodeInfo(null);
      setError('Authentication expired.');
    }
    return result;
  }, []);

  return { config, isSaving, error, authState, deviceCodeInfo, save, startAuth, pollAuth };
}
