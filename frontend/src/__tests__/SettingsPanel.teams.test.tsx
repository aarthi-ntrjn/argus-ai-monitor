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
  initiateDeviceCodeFlow: vi.fn(),
  pollDeviceCodeFlow: vi.fn(),
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
      clientId: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
      tenantId: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
      teamId: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
      channelId: '19:xxxx@thread.tacv2',
      ownerUserId: 'owner-id',
      refreshToken: '***',
      connectionStatus: 'connected',
    });
    renderWithQuery(<SettingsPanel settings={baseSettings} onToggle={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText(/connected/i)).toBeInTheDocument();
    });
  });

  it('renders Client ID input field', async () => {
    renderWithQuery(<SettingsPanel settings={baseSettings} onToggle={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByLabelText(/client id/i)).toBeInTheDocument();
    });
  });

  it('calls patchTeamsSettings when Save is clicked', async () => {
    vi.mocked(api.patchTeamsSettings).mockResolvedValue({
      enabled: true,
      clientId: 'test-client-id',
      tenantId: 'test-tenant-id',
      teamId: 'test-team-id',
      channelId: '19:xxxx@thread.tacv2',
      ownerUserId: 'owner-id',
      refreshToken: '***',
      connectionStatus: 'connected',
    });
    renderWithQuery(<SettingsPanel settings={baseSettings} onToggle={vi.fn()} />);
    await waitFor(() => screen.getByLabelText(/client id/i));
    const clientIdInput = screen.getByLabelText(/client id/i);
    await userEvent.clear(clientIdInput);
    await userEvent.type(clientIdInput, 'test-client-id');
    await userEvent.click(screen.getByRole('button', { name: /save teams settings/i }));
    expect(api.patchTeamsSettings).toHaveBeenCalled();
  });

  it('shows error message when save fails', async () => {
    vi.mocked(api.patchTeamsSettings).mockRejectedValue(new Error('Connection failed'));
    renderWithQuery(<SettingsPanel settings={baseSettings} onToggle={vi.fn()} />);
    await waitFor(() => screen.getByLabelText(/client id/i));
    await userEvent.click(screen.getByRole('button', { name: /save teams settings/i }));
    await waitFor(() => {
      expect(screen.getByText(/connection failed/i)).toBeInTheDocument();
    });
  });
});
