import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SessionPage from '../pages/SessionPage';

const mockStopSession = vi.fn().mockResolvedValue({});

vi.mock('../services/api', () => ({
  getSession: vi.fn(),
  getSessionOutput: vi.fn().mockResolvedValue({ items: [] }),
  stopSession: (...args: unknown[]) => mockStopSession(...args),
  getArgusSettings: vi.fn().mockResolvedValue({ autoRegisterRepos: false, yoloMode: false, restingThresholdMinutes: 20 }),
}));

import { getSession } from '../services/api';
const mockGetSession = vi.mocked(getSession);

function renderSessionPage(sessionOverrides = {}) {
  const session = {
    id: 'sess-abc123',
    type: 'claude-code' as const,
    status: 'active' as const,
    startedAt: new Date().toISOString(),
    endedAt: null,
    lastActivityAt: new Date().toISOString(),
    expiresAt: null,
    repositoryId: 'repo-1',
    summary: 'Test session',
    model: null,
    yoloMode: false,
    pid: 12345,
    hostPid: null,
    pidSource: 'pty_registry' as const,
    launchMode: null,
    reconciled: false,
    ...sessionOverrides,
  };

  mockGetSession.mockResolvedValue(session);

  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/sessions/${session.id}`]}>
        <Routes>
          <Route path="/sessions/:id" element={<SessionPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('SessionPage kill button', () => {
  it('shows kill button for active session with PID', async () => {
    renderSessionPage({ status: 'active', pid: 12345 });
    expect(await screen.findByRole('button', { name: /kill/i })).toBeInTheDocument();
  });

  it('hides kill button for ended session', async () => {
    renderSessionPage({ status: 'ended', pid: 12345 });
    await screen.findByText('Test session');
    expect(screen.queryByRole('button', { name: /kill/i })).not.toBeInTheDocument();
  });

  it('hides kill button when session has no PID', async () => {
    renderSessionPage({ status: 'active', pid: null });
    await screen.findByText('Test session');
    expect(screen.queryByRole('button', { name: /kill/i })).not.toBeInTheDocument();
  });

  it('opens confirmation dialog when kill button is clicked', async () => {
    const user = userEvent.setup();
    renderSessionPage({ status: 'active', pid: 12345 });
    const killBtn = await screen.findByRole('button', { name: /kill/i });
    await user.click(killBtn);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
  });

  it('calls stopSession API when dialog is confirmed', async () => {
    const user = userEvent.setup();
    renderSessionPage({ status: 'active', pid: 12345 });
    const killBtn = await screen.findByRole('button', { name: /kill/i });
    await user.click(killBtn);
    const dialog = screen.getByRole('dialog');
    const confirmBtn = within(dialog).getByRole('button', { name: /kill session/i });
    await user.click(confirmBtn);
    await waitFor(() => {
      expect(mockStopSession).toHaveBeenCalledWith('sess-abc123');
    });
  });

  it('closes dialog when cancel is clicked', async () => {
    const user = userEvent.setup();
    renderSessionPage({ status: 'active', pid: 12345 });
    const killBtn = await screen.findByRole('button', { name: /kill/i });
    await user.click(killBtn);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
