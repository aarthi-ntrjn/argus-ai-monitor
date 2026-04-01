import { useState } from 'react';
import type { DashboardSettings } from '../types';
import { DEFAULT_SETTINGS } from '../types';

const SETTINGS_KEY = 'argus:settings';

function loadSettings(): DashboardSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (!stored) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function useSettings(): [DashboardSettings, <K extends keyof DashboardSettings>(key: K, value: DashboardSettings[K]) => void] {
  const [settings, setSettings] = useState<DashboardSettings>(loadSettings);

  function updateSetting<K extends keyof DashboardSettings>(key: K, value: DashboardSettings[K]) {
    setSettings(prev => {
      const next = { ...prev, [key]: value };
      try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }

  return [settings, updateSetting];
}
