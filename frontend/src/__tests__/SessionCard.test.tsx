import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Session } from '../types';

// SessionCard uses react-router Link and TanStack Query — mock both
vi.mock('react-router-dom', () => ({
  Link: ({ children, ...props }: React.PropsWithChildren<{ to: string }>) => <a {...props}>{children}</a>,
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: undefined }),
}));

vi.mock('../services/api', () => ({
  getSessionOutput: vi.fn().mockResolvedValue({ items: [] }),
  sendPrompt: vi.fn(),
  interruptSession: vi.fn(),
}));

import SessionCard from '../components/SessionCard/SessionCard';

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'test-session-id',
    repositoryId: 'repo-1',
    type: 'claude-code',
    launchMode: null,
    pid: null,
    pidSource: null,
    status: 'active',
    startedAt: new Date().toISOString(),
    endedAt: null,
    lastActivityAt: new Date().toISOString(),
    summary: null,
    expiresAt: null,
    model: null,
    ...overrides,
  };
}

describe('SessionCard — prompt bar keyboard isolation', () => {
  it('space key inside prompt input does not bubble up and toggle card selection', () => {
    const onSelect = vi.fn();
    render(<SessionCard session={makeSession({ launchMode: 'pty' })} onSelect={onSelect} />);
    const input = screen.getByPlaceholderText('Send a prompt…');
    fireEvent.keyDown(input, { key: ' ', code: 'Space', bubbles: true });
    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe('SessionCard — launchMode badge', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('shows "live" badge when launchMode is "pty"', () => {
    render(<SessionCard session={makeSession({ launchMode: 'pty' })} />);
    expect(screen.getByText('live')).toBeInTheDocument();
  });

  it('shows "read-only" badge when launchMode is "detected"', () => {
    render(<SessionCard session={makeSession({ launchMode: 'detected' })} />);
    expect(screen.getByText('read-only')).toBeInTheDocument();
  });

  it('shows "read-only" badge when launchMode is null (legacy session)', () => {
    render(<SessionCard session={makeSession({ launchMode: null })} />);
    expect(screen.getByText('read-only')).toBeInTheDocument();
  });
});
