import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SessionPromptBar from '../components/SessionPromptBar/SessionPromptBar';
import type { Session } from '../types';

vi.mock('../services/api', () => ({
  sendPrompt: vi.fn(),
}));

import { sendPrompt } from '../services/api';

const mockSendPrompt = vi.mocked(sendPrompt);

const SESSION: Session = {
  id: 'session-abc-123',
  repositoryId: 'repo-1',
  type: 'claude-code',
  launchMode: 'pty',
  pid: null,
  pidSource: null,
  status: 'active',
  startedAt: new Date().toISOString(),
  endedAt: null,
  lastActivityAt: new Date().toISOString(),
  summary: null,
  expiresAt: null,
  model: null,
  yoloMode: false,
};

const READ_ONLY_SESSION: Session = { ...SESSION, launchMode: 'detected' };

describe('SessionPromptBar — input and send', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendPrompt.mockResolvedValue({} as any);
  });

  it('renders an empty text input with the correct placeholder', () => {
    render(<SessionPromptBar session={SESSION} />);
    const input = screen.getByPlaceholderText('Send a prompt…');
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue('');
  });

  it('Enter button is disabled when the input is empty', () => {
    render(<SessionPromptBar session={SESSION} />);
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
  });

  it('Enter button becomes enabled once text is typed', async () => {
    render(<SessionPromptBar session={SESSION} />);
    await userEvent.type(screen.getByPlaceholderText('Send a prompt…'), 'hello');
    expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled();
  });

  it('Enter button stays disabled when input contains only whitespace', async () => {
    render(<SessionPromptBar session={SESSION} />);
    await userEvent.type(screen.getByPlaceholderText('Send a prompt…'), '   ');
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
  });

  it('calls sendPrompt with the session id and trimmed text on button click', async () => {
    render(<SessionPromptBar session={SESSION} />);
    await userEvent.type(screen.getByPlaceholderText('Send a prompt…'), '  do something  ');
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(mockSendPrompt).toHaveBeenCalledWith(SESSION.id, 'do something');
  });

  it('calls sendPrompt when Enter is pressed in the input', async () => {
    render(<SessionPromptBar session={SESSION} />);
    await userEvent.type(screen.getByPlaceholderText('Send a prompt…'), 'run tests{Enter}');
    expect(mockSendPrompt).toHaveBeenCalledWith(SESSION.id, 'run tests');
  });

  it('clears the input after a successful send', async () => {
    render(<SessionPromptBar session={SESSION} />);
    const input = screen.getByPlaceholderText('Send a prompt…');
    await userEvent.type(input, 'hello');
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(input).toHaveValue(''));
  });

  it('shows an error message when sendPrompt rejects', async () => {
    mockSendPrompt.mockRejectedValue(new Error('Network error'));
    render(<SessionPromptBar session={SESSION} />);
    await userEvent.type(screen.getByPlaceholderText('Send a prompt…'), 'hello');
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(screen.getByText('Network error')).toBeInTheDocument());
  });

  it('does not render a dropdown actions menu', () => {
    render(<SessionPromptBar session={SESSION} />);
    expect(screen.queryByRole('button', { name: /session actions menu/i })).not.toBeInTheDocument();
  });
});

describe('SessionPromptBar — focus restoration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendPrompt.mockResolvedValue({} as any);
  });

  it('refocuses the input after a successful send', async () => {
    render(<SessionPromptBar session={SESSION} />);
    const input = screen.getByPlaceholderText('Send a prompt…');
    await userEvent.type(input, 'hello');
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    // Wait for the input to clear (send completed) then check focus
    await waitFor(() => expect(input).toHaveValue(''));
    await waitFor(() => expect(document.activeElement).toBe(input));
  });
});

describe('SessionPromptBar — read-only mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendPrompt.mockResolvedValue({} as any);
  });

  it('hides the input when session is not PTY-launched', () => {
    render(<SessionPromptBar session={READ_ONLY_SESSION} />);
    expect(screen.queryByPlaceholderText('Send a prompt…')).not.toBeInTheDocument();
  });

  it('hides the enter button when session is not PTY-launched', () => {
    render(<SessionPromptBar session={READ_ONLY_SESSION} />);
    expect(screen.queryByRole('button', { name: 'Send' })).not.toBeInTheDocument();
  });

  it('shows a read-only message with a tooltip explaining how to enable prompts', () => {
    render(<SessionPromptBar session={READ_ONLY_SESSION} />);
    expect(screen.getByTitle(/argus launch/i)).toBeInTheDocument();
    expect(screen.getByText(/read-only/i)).toBeInTheDocument();
  });

  it('does not call sendPrompt in read-only mode', async () => {
    render(<SessionPromptBar session={READ_ONLY_SESSION} />);
    expect(mockSendPrompt).not.toHaveBeenCalled();
  });
});

