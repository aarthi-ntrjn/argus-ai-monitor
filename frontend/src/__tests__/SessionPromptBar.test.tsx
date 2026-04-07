import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SessionPromptBar from '../components/SessionPromptBar/SessionPromptBar';
import type { Session } from '../types';

vi.mock('../services/api', () => ({
  sendPrompt: vi.fn(),
  interruptSession: vi.fn(),
}));

import { sendPrompt, interruptSession } from '../services/api';

const mockSendPrompt = vi.mocked(sendPrompt);
const mockInterrupt = vi.mocked(interruptSession);

const SESSION: Session = {
  id: 'session-abc-123',
  repositoryId: 'repo-1',
  type: 'claude-code',
  launchMode: 'pty',
  pid: null,
  status: 'active',
  startedAt: new Date().toISOString(),
  endedAt: null,
  lastActivityAt: new Date().toISOString(),
  summary: null,
  expiresAt: null,
  model: null,
};

const READ_ONLY_SESSION: Session = { ...SESSION, launchMode: 'detected' };

describe('SessionPromptBar — input and send', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendPrompt.mockResolvedValue({} as any);
    mockInterrupt.mockResolvedValue({} as any);
  });

  it('renders an empty text input with the correct placeholder', () => {
    render(<SessionPromptBar session={SESSION} />);
    const input = screen.getByPlaceholderText('Send a prompt…');
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue('');
  });

  it('Enter button is disabled when the input is empty', () => {
    render(<SessionPromptBar session={SESSION} />);
    expect(screen.getByRole('button', { name: '↵' })).toBeDisabled();
  });

  it('Enter button becomes enabled once text is typed', async () => {
    render(<SessionPromptBar session={SESSION} />);
    await userEvent.type(screen.getByPlaceholderText('Send a prompt…'), 'hello');
    expect(screen.getByRole('button', { name: '↵' })).toBeEnabled();
  });

  it('Enter button stays disabled when input contains only whitespace', async () => {
    render(<SessionPromptBar session={SESSION} />);
    await userEvent.type(screen.getByPlaceholderText('Send a prompt…'), '   ');
    expect(screen.getByRole('button', { name: '↵' })).toBeDisabled();
  });

  it('calls sendPrompt with the session id and trimmed text on button click', async () => {
    render(<SessionPromptBar session={SESSION} />);
    await userEvent.type(screen.getByPlaceholderText('Send a prompt…'), '  do something  ');
    await userEvent.click(screen.getByRole('button', { name: '↵' }));
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
    await userEvent.click(screen.getByRole('button', { name: '↵' }));
    await waitFor(() => expect(input).toHaveValue(''));
  });

  it('shows an error message when sendPrompt rejects', async () => {
    mockSendPrompt.mockRejectedValue(new Error('Network error'));
    render(<SessionPromptBar session={SESSION} />);
    await userEvent.type(screen.getByPlaceholderText('Send a prompt…'), 'hello');
    await userEvent.click(screen.getByRole('button', { name: '↵' }));
    await waitFor(() => expect(screen.getByText('Network error')).toBeInTheDocument());
  });
});

describe('SessionPromptBar — actions menu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendPrompt.mockResolvedValue({} as any);
    mockInterrupt.mockResolvedValue({} as any);
  });

  it('opens the dropdown when the ⋮ button is clicked', async () => {
    render(<SessionPromptBar session={SESSION} />);
    await userEvent.click(screen.getByRole('button', { name: /session actions menu/i }));
    expect(screen.getByRole('button', { name: 'Esc' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Exit' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Merge' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Pull latest' })).toBeVisible();
  });

  it('closes the dropdown when Escape is pressed', async () => {
    render(<SessionPromptBar session={SESSION} />);
    await userEvent.click(screen.getByRole('button', { name: /session actions menu/i }));
    expect(screen.getByRole('button', { name: 'Esc' })).toBeVisible();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('button', { name: 'Esc' })).not.toBeInTheDocument();
  });

  it('runs interrupt immediately without showing a confirmation modal', async () => {
    render(<SessionPromptBar session={SESSION} />);
    await userEvent.click(screen.getByRole('button', { name: /session actions menu/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Esc' }));
    expect(mockInterrupt).toHaveBeenCalledWith(SESSION.id);
    expect(screen.queryByRole('button', { name: 'Confirm' })).not.toBeInTheDocument();
  });

  it('shows a confirmation modal when Exit is clicked', async () => {
    render(<SessionPromptBar session={SESSION} />);
    await userEvent.click(screen.getByRole('button', { name: /session actions menu/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Exit' }));
    expect(screen.getByText(/send \/exit/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('shows a confirmation modal when Merge is clicked', async () => {
    render(<SessionPromptBar session={SESSION} />);
    await userEvent.click(screen.getByRole('button', { name: /session actions menu/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Merge' }));
    expect(screen.getByText(/merge current branch/i)).toBeInTheDocument();
  });

  it('shows a confirmation modal when Pull latest is clicked', async () => {
    render(<SessionPromptBar session={SESSION} />);
    await userEvent.click(screen.getByRole('button', { name: /session actions menu/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Pull latest' }));
    expect(screen.getByText(/pull latest/i)).toBeInTheDocument();
  });

  it('dismisses the confirmation modal when Cancel is clicked without sending', async () => {
    render(<SessionPromptBar session={SESSION} />);
    await userEvent.click(screen.getByRole('button', { name: /session actions menu/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Exit' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('button', { name: 'Confirm' })).not.toBeInTheDocument();
    expect(mockSendPrompt).not.toHaveBeenCalled();
  });

  it('executes the Exit command when Confirm is clicked in the modal', async () => {
    render(<SessionPromptBar session={SESSION} />);
    await userEvent.click(screen.getByRole('button', { name: /session actions menu/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Exit' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(mockSendPrompt).toHaveBeenCalledWith(SESSION.id, '/exit'));
  });

  it('executes the Merge command with the correct prompt text', async () => {
    render(<SessionPromptBar session={SESSION} />);
    await userEvent.click(screen.getByRole('button', { name: /session actions menu/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Merge' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(mockSendPrompt).toHaveBeenCalledWith(SESSION.id, 'merge current branch with main'));
  });

  it('executes the Pull command with the correct prompt text', async () => {
    render(<SessionPromptBar session={SESSION} />);
    await userEvent.click(screen.getByRole('button', { name: /session actions menu/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Pull latest' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(mockSendPrompt).toHaveBeenCalledWith(SESSION.id, 'pull latest changes from main branch'));
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
    expect(screen.queryByRole('button', { name: '↵' })).not.toBeInTheDocument();
  });

  it('hides the actions menu when session is not PTY-launched', () => {
    render(<SessionPromptBar session={READ_ONLY_SESSION} />);
    expect(screen.queryByRole('button', { name: /session actions menu/i })).not.toBeInTheDocument();
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
