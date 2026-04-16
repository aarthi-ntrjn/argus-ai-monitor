import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SettingsPanel } from '../components/SettingsPanel/SettingsPanel';
import type { DashboardSettings } from '../types';
import * as api from '../services/api';

vi.mock('../services/api', () => ({
  getArgusSettings: vi.fn().mockResolvedValue({ autoRegisterRepos: false, yoloMode: false }),
  patchArgusSettings: vi.fn().mockResolvedValue({ autoRegisterRepos: false, yoloMode: false }),
  getTeamsSettings: vi.fn().mockResolvedValue({ enabled: false, connectionStatus: 'unconfigured' }),
  getSlackSettings: vi.fn().mockRejectedValue(new Error('not configured')),
}));

function renderWithQuery(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<MemoryRouter><QueryClientProvider client={qc}>{ui}</QueryClientProvider></MemoryRouter>);
}

const baseSettings: DashboardSettings = {
  hideEndedSessions: false,
  hideReposWithNoActiveSessions: false,
  hideInactiveSessions: false,
  outputDisplayMode: 'focused',
  hideTodoPanel: false,
};

describe('SettingsPanel - Slack integration section', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getArgusSettings).mockResolvedValue({ autoRegisterRepos: false, yoloMode: false } as any);
    vi.mocked(api.getTeamsSettings).mockResolvedValue({ enabled: false, connectionStatus: 'unconfigured' });
    vi.mocked(api.getSlackSettings).mockRejectedValue(new Error('not configured'));
  });

  it('renders the Slack section heading', async () => {
    renderWithQuery(<SettingsPanel settings={baseSettings} onToggle={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText(/^slack$/i)).toBeInTheDocument();
    });
  });

  it('shows "configured via environment variables" note', async () => {
    renderWithQuery(<SettingsPanel settings={baseSettings} onToggle={vi.fn()} />);
    await waitFor(() => {
      const notes = screen.getAllByText(/configured via environment variables/i);
      expect(notes.length).toBeGreaterThan(0);
    });
  });

  it('shows field labels for Bot Token, App Token, Channel ID', async () => {
    vi.mocked(api.getSlackSettings).mockResolvedValue({
      botToken: '***',
      channelId: 'C01234ABCDE',
      enabled: true,
    });
    renderWithQuery(<SettingsPanel settings={baseSettings} onToggle={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('Bot Token')).toBeInTheDocument();
      expect(screen.getByText('App Token')).toBeInTheDocument();
      // Channel ID appears in both Slack and Teams sections
      expect(screen.getAllByText('Channel ID').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows connected badge when enabled is true', async () => {
    vi.mocked(api.getSlackSettings).mockResolvedValue({
      botToken: '***',
      channelId: 'C01234ABCDE',
      enabled: true,
    });
    renderWithQuery(<SettingsPanel settings={baseSettings} onToggle={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('connected')).toBeInTheDocument();
    });
  });

  it('displays channel ID value read-only', async () => {
    vi.mocked(api.getSlackSettings).mockResolvedValue({
      botToken: '***',
      channelId: 'C09876ZYXWV',
      enabled: true,
    });
    renderWithQuery(<SettingsPanel settings={baseSettings} onToggle={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('C09876ZYXWV')).toBeInTheDocument();
    });
  });

  it('shows "not set" for appToken when absent', async () => {
    vi.mocked(api.getSlackSettings).mockResolvedValue({
      botToken: '***',
      channelId: 'C01234',
      enabled: true,
    });
    renderWithQuery(<SettingsPanel settings={baseSettings} onToggle={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getAllByText(/not set/i).length).toBeGreaterThan(0);
    });
  });

  it('does not render a save or edit button for Slack', async () => {
    vi.mocked(api.getSlackSettings).mockResolvedValue({
      botToken: '***',
      channelId: 'C01234',
      enabled: true,
    });
    renderWithQuery(<SettingsPanel settings={baseSettings} onToggle={vi.fn()} />);
    await waitFor(() => screen.getByText(/^slack$/i));
    expect(screen.queryByRole('button', { name: /save slack/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /edit slack/i })).not.toBeInTheDocument();
  });
});
