import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SettingsPanel } from '../components/SettingsPanel/SettingsPanel';
import type { DashboardSettings } from '../types';
import * as api from '../services/api';

vi.mock('../services/api', () => ({
  getArgusSettings: vi.fn().mockResolvedValue({ autoRegisterRepos: false, yoloMode: false }),
  patchArgusSettings: vi.fn().mockResolvedValue({ autoRegisterRepos: false, yoloMode: false }),
}));

function renderWithQuery(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

const allOff: DashboardSettings = {
  hideEndedSessions: false,
  hideReposWithNoActiveSessions: false,
  hideInactiveSessions: false,
  outputDisplayMode: 'focused',
};

const allOn: DashboardSettings = {
  hideEndedSessions: true,
  hideReposWithNoActiveSessions: true,
  hideInactiveSessions: true,
  outputDisplayMode: 'focused',
};

describe('SettingsPanel', () => {
  it('renders all three setting checkboxes', () => {
    renderWithQuery(<SettingsPanel settings={allOff} onToggle={vi.fn()} />);
    expect(screen.getByRole('checkbox', { name: /hide ended sessions/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /hide repos with no active sessions/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /hide inactive sessions/i })).toBeInTheDocument();
  });

  it('shows unchecked checkboxes when all settings are false', () => {
    renderWithQuery(<SettingsPanel settings={allOff} onToggle={vi.fn()} />);
    expect(screen.getByRole('checkbox', { name: /hide ended sessions/i })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: /hide repos with no active sessions/i })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: /hide inactive sessions/i })).not.toBeChecked();
  });

  it('shows checked checkboxes when all settings are true', () => {
    renderWithQuery(<SettingsPanel settings={allOn} onToggle={vi.fn()} />);
    expect(screen.getByRole('checkbox', { name: /hide ended sessions/i })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /hide repos with no active sessions/i })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /hide inactive sessions/i })).toBeChecked();
  });

  it('calls onToggle with "hideEndedSessions" and true when that checkbox is checked', async () => {
    const onToggle = vi.fn();
    renderWithQuery(<SettingsPanel settings={allOff} onToggle={onToggle} />);
    await userEvent.click(screen.getByRole('checkbox', { name: /hide ended sessions/i }));
    expect(onToggle).toHaveBeenCalledWith('hideEndedSessions', true);
  });

  it('calls onToggle with "hideEndedSessions" and false when that checkbox is unchecked', async () => {
    const onToggle = vi.fn();
    renderWithQuery(<SettingsPanel settings={allOn} onToggle={onToggle} />);
    await userEvent.click(screen.getByRole('checkbox', { name: /hide ended sessions/i }));
    expect(onToggle).toHaveBeenCalledWith('hideEndedSessions', false);
  });

  it('calls onToggle with "hideReposWithNoActiveSessions" when that checkbox is toggled', async () => {
    const onToggle = vi.fn();
    renderWithQuery(<SettingsPanel settings={allOff} onToggle={onToggle} />);
    await userEvent.click(screen.getByRole('checkbox', { name: /hide repos with no active sessions/i }));
    expect(onToggle).toHaveBeenCalledWith('hideReposWithNoActiveSessions', true);
  });

  it('calls onToggle with "hideInactiveSessions" when that checkbox is toggled', async () => {
    const onToggle = vi.fn();
    renderWithQuery(<SettingsPanel settings={allOff} onToggle={onToggle} />);
    await userEvent.click(screen.getByRole('checkbox', { name: /hide inactive sessions/i }));
    expect(onToggle).toHaveBeenCalledWith('hideInactiveSessions', true);
  });

  it('each toggle fires exactly once per click', async () => {
    const onToggle = vi.fn();
    renderWithQuery(<SettingsPanel settings={allOff} onToggle={onToggle} />);
    await userEvent.click(screen.getByRole('checkbox', { name: /hide ended sessions/i }));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  describe('yolo mode toggle', () => {
    it('renders the yolo mode checkbox', async () => {
      renderWithQuery(<SettingsPanel settings={allOff} onToggle={vi.fn()} />);
      await waitFor(() => {
        expect(screen.getByRole('checkbox', { name: /yolo mode/i })).toBeInTheDocument();
      });
    });

    it('shows warning dialog when toggling yolo mode on', async () => {
      vi.mocked(api.getArgusSettings).mockResolvedValue({ autoRegisterRepos: false, yoloMode: false } as any);
      renderWithQuery(<SettingsPanel settings={allOff} onToggle={vi.fn()} />);
      await waitFor(() => screen.getByRole('checkbox', { name: /yolo mode/i }));
      await userEvent.click(screen.getByRole('checkbox', { name: /yolo mode/i }));
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('calls patchArgusSettings with yoloMode: true when dialog is confirmed', async () => {
      vi.mocked(api.getArgusSettings).mockResolvedValue({ autoRegisterRepos: false, yoloMode: false } as any);
      vi.mocked(api.patchArgusSettings).mockResolvedValue({ autoRegisterRepos: false, yoloMode: true } as any);
      renderWithQuery(<SettingsPanel settings={allOff} onToggle={vi.fn()} />);
      await waitFor(() => screen.getByRole('checkbox', { name: /yolo mode/i }));
      await userEvent.click(screen.getByRole('checkbox', { name: /yolo mode/i }));
      await userEvent.click(screen.getByRole('button', { name: /enable yolo mode/i }));
      expect(api.patchArgusSettings).toHaveBeenCalledWith({ yoloMode: true });
    });

    it('does not call patchArgusSettings when dialog is cancelled', async () => {
      vi.mocked(api.getArgusSettings).mockResolvedValue({ autoRegisterRepos: false, yoloMode: false } as any);
      const patchSpy = vi.mocked(api.patchArgusSettings);
      patchSpy.mockClear();
      renderWithQuery(<SettingsPanel settings={allOff} onToggle={vi.fn()} />);
      await waitFor(() => screen.getByRole('checkbox', { name: /yolo mode/i }));
      await userEvent.click(screen.getByRole('checkbox', { name: /yolo mode/i }));
      await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
      expect(patchSpy).not.toHaveBeenCalled();
    });

    it('calls patchArgusSettings with yoloMode: false when toggled off (no dialog)', async () => {
      vi.mocked(api.getArgusSettings).mockResolvedValue({ autoRegisterRepos: false, yoloMode: true } as any);
      vi.mocked(api.patchArgusSettings).mockResolvedValue({ autoRegisterRepos: false, yoloMode: false } as any);
      renderWithQuery(<SettingsPanel settings={allOff} onToggle={vi.fn()} />);
      await waitFor(() => screen.getByRole('checkbox', { name: /yolo mode/i }));
      await userEvent.click(screen.getByRole('checkbox', { name: /yolo mode/i }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(api.patchArgusSettings).toHaveBeenCalledWith({ yoloMode: false });
    });

    it('shows warning label when yolo mode is on', async () => {
      vi.mocked(api.getArgusSettings).mockResolvedValue({ autoRegisterRepos: false, yoloMode: true } as any);
      renderWithQuery(<SettingsPanel settings={allOff} onToggle={vi.fn()} />);
      await waitFor(() => {
        expect(screen.getByText(/all permission checks disabled/i)).toBeInTheDocument();
      });
    });

    it('does not show warning label when yolo mode is off', async () => {
      vi.mocked(api.getArgusSettings).mockResolvedValue({ autoRegisterRepos: false, yoloMode: false } as any);
      renderWithQuery(<SettingsPanel settings={allOff} onToggle={vi.fn()} />);
      await waitFor(() => screen.getByRole('checkbox', { name: /yolo mode/i }));
      expect(screen.queryByText(/all permission checks disabled/i)).not.toBeInTheDocument();
    });
  });
});
