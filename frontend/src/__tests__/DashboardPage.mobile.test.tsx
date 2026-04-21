import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DashboardPage from '../pages/DashboardPage';

// Mock useIsMobile to simulate mobile viewport
vi.mock('../hooks/useIsMobile', () => ({ useIsMobile: vi.fn() }));

// Mock all API calls
vi.mock('../services/api', () => ({
  getRepositories: vi.fn().mockResolvedValue([]),
  getSessions: vi.fn().mockResolvedValue([]),
  getTodos: vi.fn().mockResolvedValue([]),
  getArgusSettings: vi.fn().mockResolvedValue({ autoRegisterRepos: false, yoloMode: false, restingThresholdMinutes: 20 }),
  patchArgusSettings: vi.fn().mockResolvedValue({ autoRegisterRepos: false, yoloMode: false, restingThresholdMinutes: 20 }),
}));

vi.mock('../hooks/useSettings', () => ({
  useSettings: vi.fn().mockReturnValue([
    { hideEndedSessions: false, hideInactiveSessions: false, hideReposWithNoActiveSessions: false },
    vi.fn(),
  ]),
}));

vi.mock('../hooks/useOnboarding', () => ({
  useOnboarding: vi.fn().mockReturnValue({
    tourStatus: 'completed', startTour: vi.fn(), skipTour: vi.fn(), completeTour: vi.fn(),
    resetOnboarding: vi.fn(), dismissedHints: [], dismissHint: vi.fn(),
  }),
}));

vi.mock('../hooks/useRepositoryManagement', () => ({
  useRepositoryManagement: vi.fn().mockReturnValue({
    addError: null, addInfo: null, adding: false,
    showFolderInput: false, folderInputPath: '',
    removeConfirmId: null, removing: false, skipConfirm: false,
    setFolderInputPath: vi.fn(), setRemoveConfirmId: vi.fn(), setSkipConfirm: vi.fn(),
    handleAddRepo: vi.fn(), handleFolderSubmit: vi.fn(),
    handleRemoveRepoById: vi.fn(), handleRemoveRepo: vi.fn(),
    cancelFolderInput: vi.fn(), clearAddError: vi.fn(), clearAddInfo: vi.fn(),
  }),
}));

vi.mock('../components/Onboarding', () => ({
  OnboardingTour: () => null,
}));

vi.mock('../config/dashboardTourSteps', () => ({ buildDashboardTourSteps: () => [] }));

import { useIsMobile } from '../hooks/useIsMobile';
const mockUseIsMobile = vi.mocked(useIsMobile);

function renderDashboard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('DashboardPage — mobile layout', () => {
  beforeEach(() => {
    mockUseIsMobile.mockReturnValue(true);
  });

  it('renders the MobileNav with Sessions and Tasks tabs on mobile', async () => {
    renderDashboard();
    expect(await screen.findByRole('navigation', { name: /mobile navigation/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sessions/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /tasks/i })).toBeInTheDocument();
  });

  it('shows the sessions list by default on mobile', async () => {
    renderDashboard();
    // Wait for data to load, then check Sessions tab is active
    const sessionsBtn = await screen.findByRole('button', { name: /sessions/i });
    expect(sessionsBtn).toHaveAttribute('aria-pressed', 'true');
  });

  it('switches to TodoPanel when Tasks tab is tapped', async () => {
    renderDashboard();
    const tasksBtn = await screen.findByRole('button', { name: /tasks/i });
    fireEvent.click(tasksBtn);
    // TodoPanel heading should be visible
    await waitFor(() => expect(screen.getByText('To Do or Not To Do')).toBeInTheDocument());
  });

  it('does not render MobileNav on desktop', async () => {
    mockUseIsMobile.mockReturnValue(false);
    renderDashboard();
    // Wait for loading to finish
    await waitFor(() => expect(screen.queryByText('animate-pulse')).not.toBeInTheDocument());
    expect(screen.queryByRole('navigation', { name: /mobile navigation/i })).not.toBeInTheDocument();
  });

  it('toggles dashboard width from the header control on desktop', async () => {
    mockUseIsMobile.mockReturnValue(false);
    renderDashboard();

    const expandButton = await screen.findByRole('button', { name: /expand dashboard width/i });
    expect(expandButton).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(expandButton);

    const collapseButton = screen.getByRole('button', { name: /collapse dashboard width/i });
    expect(collapseButton).toHaveAttribute('aria-pressed', 'true');
  });
});
