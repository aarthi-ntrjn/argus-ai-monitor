import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Session } from '../types';

vi.mock('react-router-dom', () => ({
  Link: ({ children, ...props }: React.PropsWithChildren<{ to: string }>) => <a {...props}>{children}</a>,
}));

vi.mock('../hooks/useArgusSettings', () => ({
  useArgusSettings: vi.fn().mockReturnValue({
    settings: { restingThresholdMinutes: 20, yoloMode: false, autoRegisterRepos: false },
    isLoading: false,
    patchSetting: vi.fn(),
  }),
}));

import SessionMetaRow from '../components/SessionMetaRow/SessionMetaRow';

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'test-session-id-full-length',
    repositoryId: 'repo-1',
    type: 'claude-code',
    launchMode: 'pty',
    pid: 12345,
    pidSource: 'pty_registry',
    status: 'active',
    startedAt: new Date().toISOString(),
    endedAt: null,
    lastActivityAt: new Date().toISOString(),
    summary: null,
    expiresAt: null,
    model: null,
    yoloMode: false,
    ...overrides,
  };
}

describe('SessionMetaRow — kill button', () => {
  it('renders kill button when onKill is provided and session is killable', () => {
    render(<SessionMetaRow session={makeSession()} onKill={vi.fn()} />);
    expect(screen.getByLabelText('Kill session')).toBeInTheDocument();
  });

  it('does not render kill button when onKill is not provided', () => {
    render(<SessionMetaRow session={makeSession()} />);
    expect(screen.queryByLabelText('Kill session')).not.toBeInTheDocument();
  });

  it('does not render kill button when session has no PID', () => {
    render(<SessionMetaRow session={makeSession({ pid: null })} onKill={vi.fn()} />);
    expect(screen.queryByLabelText('Kill session')).not.toBeInTheDocument();
  });

  it('does not render kill button when session status is ended', () => {
    render(<SessionMetaRow session={makeSession({ status: 'ended' })} onKill={vi.fn()} />);
    expect(screen.queryByLabelText('Kill session')).not.toBeInTheDocument();
  });

  it('does not render kill button when session status is completed', () => {
    render(<SessionMetaRow session={makeSession({ status: 'completed' })} onKill={vi.fn()} />);
    expect(screen.queryByLabelText('Kill session')).not.toBeInTheDocument();
  });

  it('calls onKill with session id when kill button is clicked', async () => {
    const onKill = vi.fn();
    render(<SessionMetaRow session={makeSession()} onKill={onKill} />);
    await userEvent.click(screen.getByLabelText('Kill session'));
    expect(onKill).toHaveBeenCalledWith('test-session-id-full-length');
  });

  it('disables kill button when killPending is true', () => {
    render(<SessionMetaRow session={makeSession()} onKill={vi.fn()} killPending={true} />);
    expect(screen.getByLabelText('Kill session')).toBeDisabled();
  });
});
