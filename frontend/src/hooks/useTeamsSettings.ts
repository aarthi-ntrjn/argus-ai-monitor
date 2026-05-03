import { useState, useEffect, useCallback } from 'react';
import { getTeamsSettings, patchTeamsSettings, type TeamsSettings } from '../services/api.js';

export function useTeamsSettings() {
  const [config, setConfig] = useState<TeamsSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    getTeamsSettings().then(cfg => setConfig(cfg)).catch(e => setError(e.message));
  }, []);

  const save = useCallback(async (patch: Partial<Omit<TeamsSettings, 'enabled' | 'connectionStatus'>>) => {
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await patchTeamsSettings(patch);
      setConfig(updated);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to save Teams settings.';
      setSaveError(msg);
      throw e;
    } finally {
      setSaving(false);
    }
  }, []);

  return { config, error, saving, saveError, save };
}
