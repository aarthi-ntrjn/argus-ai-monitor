import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SettingsPanel } from '../components/SettingsPanel/SettingsPanel';
import type { DashboardSettings } from '../types';
import * as api from '../services/api';

vi.mock('../services/api', () => ({
  getArgusSettings: vi.fn().mockResolvedValue({ autoRegisterRepos: false, yoloMode: false }),
  patchArgusSettings: vi.fn().mockResolvedValue({ autoRegisterRepos: false, yoloMode: false }),
  getTeamsSettings: vi.fn().mockResolvedValue({ enabled: false, connectionStatus: 'unconfigured' }),
  patchTeamsSettings: vi.fn().mockResolvedValue({ enabled: false, connectionStatus: 'unconfigured' }),
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
  restingThresholdMinutes: 20,
  hideTodoPanel: false,
};

describe('SettingsPanel - Teams integration section', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getArgusSettings).mockResolvedValue({ autoRegisterRepos: false, yoloMode: false } as any);
    vi.mocked(api.getTeamsSettings).mockResolvedValue({ enabled: false, connectionStatus: 'unconfigured' });
    vi.mocked(api.patchTeamsSettings).mockResolvedValue({ enabled: false, connectionStatus: 'unconfigured' });
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
      botAppId: 'app-id',
      botAppPassword: '***',
      channelId: 'ch',
      serviceUrl: 'https://smba.trafficmanager.net',
      ownerTeamsUserId: 'owner',
      connectionStatus: 'connected',
    });
    renderWithQuery(<SettingsPanel settings={baseSettings} onToggle={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText(/connected/i)).toBeInTheDocument();
    });
  });

  it('renders Bot App ID input field', async () => {
    renderWithQuery(<SettingsPanel settings={baseSettings} onToggle={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByLabelText(/bot app id/i)).toBeInTheDocument();
    });
  });

  it('calls patchTeamsSettings when Save is clicked', async () => {
    vi.mocked(api.patchTeamsSettings).mockResolvedValue({
      enabled: true,
      botAppId: 'test-id',
      botAppPassword: '***',
      channelId: 'ch',
      serviceUrl: 'https://smba.trafficmanager.net',
      ownerTeamsUserId: 'owner',
      connectionStatus: 'connected',
    });
    renderWithQuery(<SettingsPanel settings={baseSettings} onToggle={vi.fn()} />);
    await waitFor(() => screen.getByLabelText(/bot app id/i));
    const botAppIdInput = screen.getByLabelText(/bot app id/i);
    await userEvent.clear(botAppIdInput);
    await userEvent.type(botAppIdInput, 'test-id');
    await userEvent.click(screen.getByRole('button', { name: /save teams/i }));
    expect(api.patchTeamsSettings).toHaveBeenCalled();
  });

  it('shows error message when save fails', async () => {
    vi.mocked(api.patchTeamsSettings).mockRejectedValue(new Error('Connection failed'));
    renderWithQuery(<SettingsPanel settings={baseSettings} onToggle={vi.fn()} />);
    await waitFor(() => screen.getByLabelText(/bot app id/i));
    await userEvent.click(screen.getByRole('button', { name: /save teams/i }));
    await waitFor(() => {
      expect(screen.getByText(/connection failed/i)).toBeInTheDocument();
    });
  });
});
