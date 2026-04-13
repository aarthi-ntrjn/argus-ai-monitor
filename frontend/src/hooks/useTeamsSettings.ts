import { useState, useEffect, useCallback } from 'react';
import { getTeamsSettings, patchTeamsSettings, type TeamsSettings } from '../services/api.js';

export function useTeamsSettings() {
  const [config, setConfig] = useState<TeamsSettings | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getTeamsSettings().then(setConfig).catch(e => setError(e.message));
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

  return { config, isSaving, error, save };
}
