import { useState, useEffect } from 'react';
import { getSlackSettings, type SlackSettings } from '../services/api.js';

export function useSlackSettings() {
  const [config, setConfig] = useState<SlackSettings | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSlackSettings().then(cfg => setConfig(cfg)).catch(e => setError(e.message));
  }, []);

  return { config, error };
}
