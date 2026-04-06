import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DashboardPage from '../pages/DashboardPage';

// Mock useIsMobile to simulate mobile viewport
vi.mock('../hooks/useIsMobile', () => ({ useIsMobile: vi.fn() }));

// Mock all API calls
vi.mock('../services/api', () => ({
  getRepositories: vi.fn().mockResolvedValue([]),
  getSessions: vi.fn().mockResolvedValue([]),
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
    addError: null, addInfo: null, adding: false, showFolderInput: false, folderInputPath: '',
    removeConfirmId: null, removing: false, skipConfirm: false,
    setFolderInputPath: vi.fn(), setRemoveConfirmId: vi.fn(), setSkipConfirm: vi.fn(),
    handleAddRepo: vi.fn(), handleFolderSubmit: vi.fn(),
    handleRemoveRepoById: vi.fn(), handleRemoveRepo: vi.fn(),
    clearAddError: vi.fn(), clearAddInfo: vi.fn(),
  }),
}));

vi.mock('../components/Onboarding', () => ({
  OnboardingTour: () => null,
}));

vi.mock('../config/dashboardTourSteps', () => ({ DASHBOARD_TOUR_STEPS: [] }));

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

  it('renders the MobileNav with Sessions and Tasks tabs on mobile', () => {
    renderDashboard();
    expect(screen.getByRole('navigation', { name: /mobile navigation/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sessions/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /tasks/i })).toBeInTheDocument();
  });

  it('shows the sessions list by default on mobile', () => {
    renderDashboard();
    // Sessions tab is active
    expect(screen.getByRole('button', { name: /sessions/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('switches to TodoPanel when Tasks tab is tapped', () => {
    renderDashboard();
    fireEvent.click(screen.getByRole('button', { name: /tasks/i }));
    // TodoPanel heading should be visible
    expect(screen.getByText('To Tackle')).toBeInTheDocument();
  });

  it('does not render MobileNav on desktop', () => {
    mockUseIsMobile.mockReturnValue(false);
    renderDashboard();
    expect(screen.queryByRole('navigation', { name: /mobile navigation/i })).not.toBeInTheDocument();
  });
});
