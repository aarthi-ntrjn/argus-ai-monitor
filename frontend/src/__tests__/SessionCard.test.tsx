import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Session, SessionOutput } from '../types';

vi.mock('react-router-dom', () => ({
  Link: ({ children, ...props }: React.PropsWithChildren<{ to: string }>) => <a {...props}>{children}</a>,
}));

vi.mock('../services/api');

import SessionCard from '../components/SessionCard/SessionCard';
import * as api from '../services/api';

function makeOutput(overrides: Partial<SessionOutput>): SessionOutput {
  return {
    id: 'out-1',
    sessionId: 'sess-1',
    timestamp: new Date().toISOString(),
    type: 'message',
    content: '',
    toolName: null,
    toolCallId: null,
    role: 'assistant',
    sequenceNumber: 1,
    ...overrides,
  };
}

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
    yoloMode: false,
    ...overrides,
  };
}

function renderCard(session: Session, items: SessionOutput[] = []) {
  vi.mocked(api.getSessionOutput).mockResolvedValue({ items, nextBefore: null, total: items.length });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <SessionCard session={session} />
    </QueryClientProvider>
  );
}

describe('SessionCard — prompt bar keyboard isolation', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('space key inside prompt input does not bubble up and toggle card selection', async () => {
    const onSelect = vi.fn();
    vi.mocked(api.getSessionOutput).mockResolvedValue({ items: [], nextBefore: null, total: 0 });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <SessionCard session={makeSession({ launchMode: 'pty' })} onSelect={onSelect} />
      </QueryClientProvider>
    );
    const input = screen.getByPlaceholderText('Send a prompt…');
    fireEvent.keyDown(input, { key: ' ', code: 'Space', bubbles: true });
    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe('SessionCard — launchMode badge', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('shows "connected" badge when launchMode is "pty"', () => {
    renderCard(makeSession({ launchMode: 'pty' }));
    expect(screen.getByText('connected')).toBeInTheDocument();
  });

  it('shows "read-only" badge when launchMode is "detected"', () => {
    renderCard(makeSession({ launchMode: 'detected' }));
    expect(screen.getByText('read-only')).toBeInTheDocument();
  });

  it('shows "read-only" badge when launchMode is null (legacy session)', () => {
    renderCard(makeSession({ launchMode: null }));
    expect(screen.getByText('read-only')).toBeInTheDocument();
  });
});

describe('SessionCard — ATTENTION NEEDED alert', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('shows ATTENTION NEEDED when last output is an unanswered ask_user tool_use (readonly)', async () => {
    const content = JSON.stringify({ question: 'Which option?', choices: ['A', 'B'] });
    renderCard(makeSession({ launchMode: null, status: 'active' }), [
      makeOutput({ type: 'tool_use', toolName: 'ask_user', toolCallId: 'tc-1', content, sequenceNumber: 1 }),
    ]);
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByText(/ATTENTION NEEDED/)).toBeInTheDocument();
  });

  it('shows the question text in the alert', async () => {
    const content = JSON.stringify({ question: 'Which option?', choices: ['A', 'B'] });
    renderCard(makeSession({ status: 'active' }), [
      makeOutput({ type: 'tool_use', toolName: 'ask_user', toolCallId: 'tc-1', content, sequenceNumber: 1 }),
    ]);
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByRole('alert')).toHaveTextContent('Which option?');
  });

  it('shows labelled choices in the alert', async () => {
    const content = JSON.stringify({ question: 'Pick one', choices: ['Alpha', 'Beta'] });
    renderCard(makeSession({ status: 'active' }), [
      makeOutput({ type: 'tool_use', toolName: 'ask_user', toolCallId: 'tc-1', content, sequenceNumber: 1 }),
    ]);
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('1. Alpha');
    expect(alert).toHaveTextContent('2. Beta');
  });

  it('shows ATTENTION NEEDED for connected (PTY) session with pending choice', async () => {
    const content = JSON.stringify({ question: 'Choose?', choices: ['X'] });
    renderCard(makeSession({ launchMode: 'pty', status: 'active' }), [
      makeOutput({ type: 'tool_use', toolName: 'ask_user', toolCallId: 'tc-2', content, sequenceNumber: 1 }),
    ]);
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByText(/ATTENTION NEEDED/)).toBeInTheDocument();
  });

  it('shows normal summary when there is no pending choice', async () => {
    renderCard(makeSession({ summary: 'hello', status: 'active' }), [
      makeOutput({ type: 'message', role: 'user', content: 'hello', sequenceNumber: 1 }),
    ]);
    await waitFor(() => expect(screen.getByText('hello')).toBeInTheDocument());
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('does NOT show ATTENTION NEEDED when session status is ended', async () => {
    const content = JSON.stringify({ question: 'Pick?', choices: ['A'] });
    renderCard(makeSession({ status: 'ended' }), [
      makeOutput({ type: 'tool_use', toolName: 'ask_user', toolCallId: 'tc-3', content, sequenceNumber: 1 }),
    ]);
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });

  it('does NOT show ATTENTION NEEDED when ask_user has a subsequent tool_result', async () => {
    const content = JSON.stringify({ question: 'Pick?', choices: ['A'] });
    renderCard(makeSession({ status: 'active' }), [
      makeOutput({ type: 'tool_use', toolName: 'ask_user', toolCallId: 'tc-4', content, sequenceNumber: 3 }),
      makeOutput({ type: 'tool_result', toolCallId: 'tc-4', content: 'A', sequenceNumber: 4 }),
    ]);
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });
});

describe('SessionCard — hook-aware pending choice (T016)', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('shows ATTENTION NEEDED from hook cache even when getSessionOutput returns no pending tool_use', async () => {
    const session = makeSession({ status: 'active' });
    vi.mocked(api.getSessionOutput).mockResolvedValue({ items: [], nextBefore: null, total: 0 });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    qc.setQueryData(['session-pending-choice', session.id], {
      question: 'Hook-sourced question?',
      choices: ['Option A', 'Option B'],
    });
    render(
      <QueryClientProvider client={qc}>
        <SessionCard session={session} />
      </QueryClientProvider>
    );
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByRole('alert')).toHaveTextContent('Hook-sourced question?');
    expect(screen.getByRole('alert')).toHaveTextContent('1. Option A');
    expect(screen.getByRole('alert')).toHaveTextContent('2. Option B');
  });

  it('shows ATTENTION NEEDED from JSONL fallback when hook cache is null', async () => {
    const session = makeSession({ status: 'active' });
    const content = JSON.stringify({ question: 'Fallback question?', choices: ['X', 'Y'] });
    vi.mocked(api.getSessionOutput).mockResolvedValue({
      items: [makeOutput({ type: 'tool_use', toolName: 'ask_user', toolCallId: 'fb-1', content, sequenceNumber: 1 })],
      nextBefore: null,
      total: 1,
    });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    qc.setQueryData(['session-pending-choice', session.id], null);
    render(
      <QueryClientProvider client={qc}>
        <SessionCard session={session} />
      </QueryClientProvider>
    );
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByRole('alert')).toHaveTextContent('Fallback question?');
  });

  it('does NOT show ATTENTION NEEDED when session is terminated even if hook cache is populated', async () => {
    const session = makeSession({ status: 'ended' });
    vi.mocked(api.getSessionOutput).mockResolvedValue({ items: [], nextBefore: null, total: 0 });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    qc.setQueryData(['session-pending-choice', session.id], {
      question: 'Suppressed question?',
      choices: ['A'],
    });
    render(
      <QueryClientProvider client={qc}>
        <SessionCard session={session} />
      </QueryClientProvider>
    );
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });
});
