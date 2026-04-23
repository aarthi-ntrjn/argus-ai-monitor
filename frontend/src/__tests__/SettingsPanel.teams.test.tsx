import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { IntegrationConfigContent } from '../components/SettingsDialog/IntegrationConfigContent';
import * as api from '../services/api';

const notRunning = { integrationsEnabled: true, slack: { connectionStatus: 'unconfigured' as const, notifier: null, listener: null }, teams: { connectionStatus: 'unconfigured' as const, notifier: { running: false }, listener: null } };
const teamsRunning = { integrationsEnabled: true, slack: { connectionStatus: 'unconfigured' as const, notifier: null, listener: null }, teams: { connectionStatus: 'connected' as const, notifier: { running: true }, listener: null } };

vi.mock('../services/api', () => ({
  getTeamsSettings: vi.fn().mockResolvedValue({ enabled: false, connectionStatus: 'unconfigured' }),
  getSlackSettings: vi.fn().mockRejectedValue(new Error('not configured')),
  getIntegrationStatus: vi.fn().mockResolvedValue({ integrationsEnabled: true, slack: { connectionStatus: 'unconfigured', notifier: null, listener: null }, teams: { connectionStatus: 'unconfigured', notifier: { running: false }, listener: null } }),
  startIntegration: vi.fn().mockResolvedValue(undefined),
  stopIntegration: vi.fn().mockResolvedValue(undefined),
}));

function renderWithQuery(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<MemoryRouter><QueryClientProvider client={qc}>{ui}</QueryClientProvider></MemoryRouter>);
}

describe('SettingsPanel - Teams integration section', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getTeamsSettings).mockResolvedValue({ enabled: false, connectionStatus: 'unconfigured' });
    vi.mocked(api.getIntegrationStatus).mockResolvedValue(notRunning);
  });

  it('renders the Microsoft Teams section heading', async () => {
    renderWithQuery(<IntegrationConfigContent type="teams" />);
    await waitFor(() => {
      expect(screen.getByText(/microsoft teams/i)).toBeInTheDocument();
    });
  });

  it('shows connection status badge', async () => {
    renderWithQuery(<IntegrationConfigContent type="teams" />);
    await waitFor(() => {
      expect(screen.getByText(/not configured/i)).toBeInTheDocument();
    });
  });

  it('shows connected status when integration is running', async () => {
    vi.mocked(api.getTeamsSettings).mockResolvedValue({
      enabled: true,
      teamId: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
      channelId: '19:xxxx@thread.tacv2',
      ownerSenderId: 'owner-aad-id',
      connectionStatus: 'connected',
    });
    vi.mocked(api.getIntegrationStatus).mockResolvedValue(teamsRunning);
    renderWithQuery(<IntegrationConfigContent type="teams" />);
    await waitFor(() => {
      expect(screen.getByText('connected')).toBeInTheDocument();
    });
  });

  it('displays team ID read-only when config is loaded', async () => {
    vi.mocked(api.getTeamsSettings).mockResolvedValue({
      enabled: true,
      teamId: 'test-team-id',
      channelId: '19:xxxx@thread.tacv2',
      ownerSenderId: 'owner-aad-id',
      connectionStatus: 'connected',
    });
    renderWithQuery(<IntegrationConfigContent type="teams" />);
    await waitFor(() => {
      expect(screen.getByText('test-team-id')).toBeInTheDocument();
    });
  });

  it('shows not set when team ID is missing', async () => {
    renderWithQuery(<IntegrationConfigContent type="teams" />);
    await waitFor(() => {
      expect(screen.getAllByText(/not set/i).length).toBeGreaterThan(0);
    });
  });

  it('does not render a save button', async () => {
    renderWithQuery(<IntegrationConfigContent type="teams" />);
    await waitFor(() => screen.getByText(/microsoft teams/i));
    expect(screen.queryByRole('button', { name: /save teams settings/i })).not.toBeInTheDocument();
  });
});
