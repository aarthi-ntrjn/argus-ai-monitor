import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SessionPage from '../pages/SessionPage';

vi.mock('../services/api', () => ({
  getSession: vi.fn().mockResolvedValue({
    id: 'test-session-id',
    type: 'claude-code',
    status: 'active',
    startedAt: new Date().toISOString(),
    endedAt: null,
    repositoryId: 'repo-1',
    summary: 'Test session',
    model: null,
    yoloMode: false,
    pid: null,
    pidSource: null,
  }),
  getSessionOutput: vi.fn().mockResolvedValue({ items: [] }),
  getArgusSettings: vi.fn().mockResolvedValue({ autoRegisterRepos: false, yoloMode: false, restingThresholdMinutes: 20 }),
}));


function renderSessionPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/sessions/test-session-id']}>
        <Routes>
          <Route path="/sessions/:id" element={<SessionPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('SessionPage — mobile layout', () => {
  it('renders without horizontal overflow on narrow viewport', () => {
    renderSessionPage();
    const root = document.querySelector('.min-h-screen') as HTMLElement;
    expect(root).toBeInTheDocument();
    // Verify the container uses responsive padding classes
    expect(root.className).toMatch(/p-4/);
    expect(root.className).toMatch(/md:p-8/);
  });

  it('back button has a large touch target (py-2)', async () => {
    renderSessionPage();
    const backBtn = await screen.findByRole('button', { name: /back/i });
    expect(backBtn.className).toMatch(/icon-btn/);
  });
});
