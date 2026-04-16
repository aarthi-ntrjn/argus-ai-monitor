import { useState, useEffect } from 'react';
import { getTeamsSettings, type TeamsSettings } from '../services/api.js';

export function useTeamsSettings() {
  const [config, setConfig] = useState<TeamsSettings | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getTeamsSettings().then(cfg => setConfig(cfg)).catch(e => setError(e.message));
  }, []);

  return { config, error };
}
