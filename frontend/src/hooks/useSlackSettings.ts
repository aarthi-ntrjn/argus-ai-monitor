import { useState, useEffect, useCallback } from 'react';
import { getSlackSettings, patchSlackSettings, type SlackSettings } from '../services/api.js';

export function useSlackSettings() {
  const [config, setConfig] = useState<SlackSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    getSlackSettings().then(cfg => setConfig(cfg)).catch(e => setError(e.message));
  }, []);

  const save = useCallback(async (patch: Partial<Omit<SlackSettings, 'enabled'>>) => {
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await patchSlackSettings(patch);
      setConfig(updated);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to save Slack settings.';
      setSaveError(msg);
      throw e;
    } finally {
      setSaving(false);
    }
  }, []);

  return { config, error, saving, saveError, save };
}
