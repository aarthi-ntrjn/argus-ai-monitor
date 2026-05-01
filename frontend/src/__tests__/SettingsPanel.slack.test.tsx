import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { IntegrationConfigContent } from '../components/SettingsDialog/IntegrationConfigContent';
import * as api from '../services/api';

const notRunning = { integrationsEnabled: true, slack: { connectionStatus: 'unconfigured' as const, notifier: null, listener: null }, teams: { connectionStatus: 'unconfigured' as const, notifier: null, listener: null } };
const slackRunning = { integrationsEnabled: true, slack: { connectionStatus: 'connected' as const, notifier: { running: true }, listener: null }, teams: { connectionStatus: 'unconfigured' as const, notifier: null, listener: null } };

vi.mock('../services/api', () => ({
  getTeamsSettings: vi.fn().mockResolvedValue({ enabled: false, connectionStatus: 'unconfigured' }),
  getSlackSettings: vi.fn().mockRejectedValue(new Error('not configured')),
  getIntegrationStatus: vi.fn().mockResolvedValue({ integrationsEnabled: true, slack: { connectionStatus: 'unconfigured', notifier: null, listener: null }, teams: { connectionStatus: 'unconfigured', notifier: null, listener: null } }),
  startIntegration: vi.fn().mockResolvedValue(undefined),
  stopIntegration: vi.fn().mockResolvedValue(undefined),
}));

function renderWithQuery(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<MemoryRouter><QueryClientProvider client={qc}>{ui}</QueryClientProvider></MemoryRouter>);
}

describe('SettingsPanel - Slack integration section', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getSlackSettings).mockRejectedValue(new Error('not configured'));
    vi.mocked(api.getIntegrationStatus).mockResolvedValue(notRunning);
  });

  it('renders the Slack section heading', async () => {
    renderWithQuery(<IntegrationConfigContent type="slack" />);
    await waitFor(() => {
      expect(screen.getByText(/^slack$/i)).toBeInTheDocument();
    });
  });

  it('shows not-configured badge when slack config missing', async () => {
    vi.mocked(api.getSlackSettings).mockRejectedValue(new Error('not configured'));
    renderWithQuery(<IntegrationConfigContent type="slack" />);
    await waitFor(() => {
      expect(screen.getByText(/not configured/i)).toBeInTheDocument();
    });
  });

  it('shows field labels for Bot Token, App Token, Channel ID', async () => {
    vi.mocked(api.getSlackSettings).mockResolvedValue({ botToken: '***', channelId: 'C01234ABCDE', enabled: true });
    renderWithQuery(<IntegrationConfigContent type="slack" />);
    await waitFor(() => {
      expect(screen.getByText('Bot Token')).toBeInTheDocument();
      expect(screen.getByText('App Token')).toBeInTheDocument();
      expect(screen.getByText('Channel ID')).toBeInTheDocument();
    });
  });

  it('shows connected badge when integration is running', async () => {
    vi.mocked(api.getSlackSettings).mockResolvedValue({ botToken: '***', channelId: 'C01234ABCDE', enabled: true });
    vi.mocked(api.getIntegrationStatus).mockResolvedValue(slackRunning);
    renderWithQuery(<IntegrationConfigContent type="slack" />);
    await waitFor(() => {
      expect(screen.getByText('connected')).toBeInTheDocument();
    });
  });

  it('displays channel ID value read-only', async () => {
    vi.mocked(api.getSlackSettings).mockResolvedValue({ botToken: '***', channelId: 'C09876ZYXWV', enabled: true });
    renderWithQuery(<IntegrationConfigContent type="slack" />);
    await waitFor(() => {
      expect(screen.getByText('C09876ZYXWV')).toBeInTheDocument();
    });
  });

  it('shows "not set" for appToken when absent', async () => {
    vi.mocked(api.getSlackSettings).mockResolvedValue({ botToken: '***', channelId: 'C01234', enabled: true });
    renderWithQuery(<IntegrationConfigContent type="slack" />);
    await waitFor(() => {
      expect(screen.getAllByText(/not set/i).length).toBeGreaterThan(0);
    });
  });

  it('does not render a save or edit button for Slack', async () => {
    vi.mocked(api.getSlackSettings).mockResolvedValue({ botToken: '***', channelId: 'C01234', enabled: true });
    renderWithQuery(<IntegrationConfigContent type="slack" />);
    await waitFor(() => screen.getByText(/^slack$/i));
    expect(screen.queryByRole('button', { name: /save slack/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /edit slack/i })).not.toBeInTheDocument();
  });
});
