import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import OutputPane from '../components/OutputPane/OutputPane';
import type { Session } from '../types';
import * as api from '../services/api';

vi.mock('../services/api');

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'session-abc',
    repositoryId: 'repo-1',
    type: 'claude-code',
    launchMode: 'detected',
    pid: 1234,
    pidSource: 'session_registry',
    status: 'active',
    startedAt: new Date().toISOString(),
    endedAt: null,
    lastActivityAt: new Date().toISOString(),
    summary: null,
    expiresAt: null,
    model: null,
    yoloMode: false,
    hostPid: null,
    reconciled: false,
    ...overrides,
  };
}

function renderOutputPane(session: Session) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.mocked(api.getSessionOutput).mockResolvedValue({ items: [], nextBefore: null, total: 0 });
  return render(
    <QueryClientProvider client={qc}>
      <OutputPane session={session} onClose={vi.fn()} />
    </QueryClientProvider>
  );
}

describe('OutputPane — mode toggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('shows a mode toggle button in the header', async () => {
    renderOutputPane(makeSession());
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /focused|verbose/i })).toBeInTheDocument();
    });
  });

  it('toggle button shows Focused as default label', async () => {
    renderOutputPane(makeSession());
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /focused/i })).toBeInTheDocument();
    });
  });

  it('clicking toggle switches to Verbose mode', async () => {
    const user = userEvent.setup();
    renderOutputPane(makeSession());
    await waitFor(() => screen.getByRole('button', { name: /focused/i }));
    await user.click(screen.getByRole('button', { name: /focused/i }));
    expect(screen.getByRole('button', { name: /verbose/i })).toBeInTheDocument();
  });
});
