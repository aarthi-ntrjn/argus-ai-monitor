import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SettingsPanel } from '../components/SettingsPanel/SettingsPanel';
import type { DashboardSettings } from '../types';
import * as api from '../services/api';

vi.mock('../services/api', () => ({
  getArgusSettings: vi.fn().mockResolvedValue({ autoRegisterRepos: false, yoloMode: false }),
  patchArgusSettings: vi.fn().mockResolvedValue({ autoRegisterRepos: false, yoloMode: false }),
  getTeamsSettings: vi.fn().mockResolvedValue({ enabled: false, connectionStatus: 'unconfigured' }),
}));

function renderWithQuery(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

const baseSettings: DashboardSettings = {
  hideEndedSessions: false,
  hideReposWithNoActiveSessions: false,
  hideInactiveSessions: false,
  outputDisplayMode: 'focused',
  hideTodoPanel: false,
};

describe('SettingsPanel - Teams integration section', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getArgusSettings).mockResolvedValue({ autoRegisterRepos: false, yoloMode: false } as any);
    vi.mocked(api.getTeamsSettings).mockResolvedValue({ enabled: false, connectionStatus: 'unconfigured' });
  });

  it('renders the Microsoft Teams section heading', async () => {
    renderWithQuery(<SettingsPanel settings={baseSettings} onToggle={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText(/microsoft teams/i)).toBeInTheDocument();
    });
  });

  it('shows connection status badge', async () => {
    renderWithQuery(<SettingsPanel settings={baseSettings} onToggle={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText(/unconfigured/i)).toBeInTheDocument();
    });
  });

  it('shows connected status when config is connected', async () => {
    vi.mocked(api.getTeamsSettings).mockResolvedValue({
      enabled: true,
      teamId: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
      channelId: '19:xxxx@thread.tacv2',
      ownerAadObjectId: 'owner-aad-id',
      connectionStatus: 'connected',
    });
    renderWithQuery(<SettingsPanel settings={baseSettings} onToggle={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText(/connected/i)).toBeInTheDocument();
    });
  });

  it('displays team ID read-only when config is loaded', async () => {
    vi.mocked(api.getTeamsSettings).mockResolvedValue({
      enabled: true,
      teamId: 'test-team-id',
      channelId: '19:xxxx@thread.tacv2',
      ownerAadObjectId: 'owner-aad-id',
      connectionStatus: 'connected',
    });
    renderWithQuery(<SettingsPanel settings={baseSettings} onToggle={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('test-team-id')).toBeInTheDocument();
    });
  });

  it('shows not set when team ID is missing', async () => {
    renderWithQuery(<SettingsPanel settings={baseSettings} onToggle={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getAllByText(/not set/i).length).toBeGreaterThan(0);
    });
  });

  it('does not render a save button', async () => {
    renderWithQuery(<SettingsPanel settings={baseSettings} onToggle={vi.fn()} />);
    await waitFor(() => screen.getByText(/microsoft teams/i));
    expect(screen.queryByRole('button', { name: /save teams settings/i })).not.toBeInTheDocument();
  });
});
