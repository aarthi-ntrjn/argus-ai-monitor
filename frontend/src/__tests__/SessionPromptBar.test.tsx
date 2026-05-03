import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SessionPromptBar from '../components/SessionPromptBar/SessionPromptBar';
import type { Session } from '../types';

vi.mock('../services/api', () => ({
  sendPrompt: vi.fn(),
  interruptSession: vi.fn(),
  getSessionOutput: vi.fn(),
}));

import { sendPrompt, getSessionOutput } from '../services/api';

const mockSendPrompt = vi.mocked(sendPrompt);
const mockGetSessionOutput = vi.mocked(getSessionOutput);

function renderBar(session: Session) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <SessionPromptBar session={session} />
    </QueryClientProvider>
  );
}

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
  hostPid: null,
  reconciled: false,
};

const READ_ONLY_SESSION: Session = { ...SESSION, launchMode: 'detected' };

describe('SessionPromptBar — input and send', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendPrompt.mockResolvedValue({} as any);
    mockGetSessionOutput.mockResolvedValue({ items: [], nextBefore: null, total: 0 });
  });

  it('renders an empty text input with the correct placeholder', () => {
    renderBar(SESSION);
    const input = screen.getByPlaceholderText('Send a prompt…');
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue('');
  });

  it('Enter button is disabled when the input is empty', () => {
    renderBar(SESSION);
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
  });

  it('Enter button becomes enabled once text is typed', async () => {
    renderBar(SESSION);
    await userEvent.type(screen.getByPlaceholderText('Send a prompt…'), 'hello');
    expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled();
  });

  it('Enter button stays disabled when input contains only whitespace', async () => {
    renderBar(SESSION);
    await userEvent.type(screen.getByPlaceholderText('Send a prompt…'), '   ');
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
  });

  it('calls sendPrompt with the session id and trimmed text on button click', async () => {
    renderBar(SESSION);
    await userEvent.type(screen.getByPlaceholderText('Send a prompt…'), '  do something  ');
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(mockSendPrompt).toHaveBeenCalledWith(SESSION.id, 'do something');
  });

  it('calls sendPrompt when Enter is pressed in the input', async () => {
    renderBar(SESSION);
    await userEvent.type(screen.getByPlaceholderText('Send a prompt…'), 'run tests{Enter}');
    expect(mockSendPrompt).toHaveBeenCalledWith(SESSION.id, 'run tests');
  });

  it('clears the input after a successful send', async () => {
    renderBar(SESSION);
    const input = screen.getByPlaceholderText('Send a prompt…');
    await userEvent.type(input, 'hello');
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(input).toHaveValue(''));
  });

  it('shows an error message when sendPrompt rejects', async () => {
    mockSendPrompt.mockRejectedValue(new Error('Network error'));
    renderBar(SESSION);
    await userEvent.type(screen.getByPlaceholderText('Send a prompt…'), 'hello');
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(screen.getByText('Network error')).toBeInTheDocument());
  });

  it('does not render a dropdown actions menu', () => {
    renderBar(SESSION);
    expect(screen.queryByRole('button', { name: /session actions menu/i })).not.toBeInTheDocument();
  });
});

describe('SessionPromptBar — focus restoration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendPrompt.mockResolvedValue({} as any);
    mockGetSessionOutput.mockResolvedValue({ items: [], nextBefore: null, total: 0 });
  });

  it('refocuses the input after a successful send', async () => {
    renderBar(SESSION);
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
    mockGetSessionOutput.mockResolvedValue({ items: [], nextBefore: null, total: 0 });
  });

  it('hides the input when session is not PTY-launched', () => {
    renderBar(READ_ONLY_SESSION);
    expect(screen.queryByPlaceholderText('Send a prompt…')).not.toBeInTheDocument();
  });

  it('hides the enter button when session is not PTY-launched', () => {
    renderBar(READ_ONLY_SESSION);
    expect(screen.queryByRole('button', { name: 'Send' })).not.toBeInTheDocument();
  });

  it('shows a read-only message with a tooltip explaining how to enable prompts', () => {
    renderBar(READ_ONLY_SESSION);
    expect(screen.getByTitle(/argus launch/i)).toBeInTheDocument();
    expect(screen.getByText(/read-only/i)).toBeInTheDocument();
  });

  it('does not call sendPrompt in read-only mode', async () => {
    renderBar(READ_ONLY_SESSION);
    expect(mockSendPrompt).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// History navigation — arrow keys
// ---------------------------------------------------------------------------

describe('SessionPromptBar — history navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendPrompt.mockResolvedValue({} as any);
    mockGetSessionOutput.mockResolvedValue({ items: [], nextBefore: null, total: 0 });
  });

  it('ArrowUp when no history has been sent leaves the input unchanged', async () => {
    renderBar(SESSION);
    const input = screen.getByPlaceholderText('Send a prompt…');
    await userEvent.type(input, 'draft text');
    await userEvent.keyboard('{ArrowUp}');
    expect(input).toHaveValue('draft text');
  });

  it('ArrowUp after one send shows that sent prompt in the input', async () => {
    renderBar(SESSION);
    const input = screen.getByPlaceholderText('Send a prompt…');
    await userEvent.type(input, 'first prompt');
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(input).toHaveValue(''));
    await userEvent.keyboard('{ArrowUp}');
    expect(input).toHaveValue('first prompt');
  });

  it('ArrowUp twice shows the second-most-recent prompt', async () => {
    renderBar(SESSION);
    const input = screen.getByPlaceholderText('Send a prompt…');
    await userEvent.type(input, 'first');
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(input).toHaveValue(''));
    await userEvent.type(input, 'second');
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(input).toHaveValue(''));
    await userEvent.keyboard('{ArrowUp}');
    expect(input).toHaveValue('second');
    await userEvent.keyboard('{ArrowUp}');
    expect(input).toHaveValue('first');
  });

  it('ArrowDown after navigating up moves toward the newest entry', async () => {
    renderBar(SESSION);
    const input = screen.getByPlaceholderText('Send a prompt…');
    await userEvent.type(input, 'first');
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(input).toHaveValue(''));
    await userEvent.type(input, 'second');
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(input).toHaveValue(''));
    await userEvent.keyboard('{ArrowUp}');
    await userEvent.keyboard('{ArrowUp}');
    expect(input).toHaveValue('first');
    await userEvent.keyboard('{ArrowDown}');
    expect(input).toHaveValue('second');
  });

  it('ArrowDown past the newest entry restores the draft text', async () => {
    renderBar(SESSION);
    const input = screen.getByPlaceholderText('Send a prompt…');
    await userEvent.type(input, 'sent prompt');
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(input).toHaveValue(''));
    await userEvent.type(input, 'my draft');
    await userEvent.keyboard('{ArrowUp}');
    expect(input).toHaveValue('sent prompt');
    await userEvent.keyboard('{ArrowDown}');
    expect(input).toHaveValue('my draft');
  });
});

// ---------------------------------------------------------------------------
// History mode indicator
// ---------------------------------------------------------------------------

describe('SessionPromptBar — history mode indicator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendPrompt.mockResolvedValue({} as any);
    mockGetSessionOutput.mockResolvedValue({ items: [], nextBefore: null, total: 0 });
  });

  it('does not show an indicator initially', () => {
    renderBar(SESSION);
    expect(screen.queryByText(/\d+ \/ \d+/)).not.toBeInTheDocument();
  });

  it('shows indicator after pressing ArrowUp when history exists', async () => {
    renderBar(SESSION);
    const input = screen.getByPlaceholderText('Send a prompt…');
    await userEvent.type(input, 'a prompt');
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(input).toHaveValue(''));
    await userEvent.keyboard('{ArrowUp}');
    expect(screen.getByText('1 / 1')).toBeInTheDocument();
  });

  it('indicator disappears after navigating back to draft', async () => {
    renderBar(SESSION);
    const input = screen.getByPlaceholderText('Send a prompt…');
    await userEvent.type(input, 'a prompt');
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(input).toHaveValue(''));
    await userEvent.keyboard('{ArrowUp}');
    expect(screen.getByText('1 / 1')).toBeInTheDocument();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.queryByText(/\d+ \/ \d+/)).not.toBeInTheDocument();
  });

  it('indicator disappears after sending a message', async () => {
    renderBar(SESSION);
    const input = screen.getByPlaceholderText('Send a prompt…');
    await userEvent.type(input, 'first');
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(input).toHaveValue(''));
    await userEvent.keyboard('{ArrowUp}');
    expect(screen.getByText('1 / 1')).toBeInTheDocument();
    await userEvent.type(input, 'second');
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(input).toHaveValue(''));
    expect(screen.queryByText(/\d+ \/ \d+/)).not.toBeInTheDocument();
  });
});
