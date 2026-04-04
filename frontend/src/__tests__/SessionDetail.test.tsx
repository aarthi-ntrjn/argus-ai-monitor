import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SessionDetail from '../components/SessionDetail/SessionDetail';
import type { SessionOutput } from '../types';

function output(overrides: Partial<SessionOutput>): SessionOutput {
  return {
    id: 'out-1',
    sessionId: 'session-1',
    timestamp: new Date().toISOString(),
    type: 'message',
    content: 'Hello',
    toolName: null,
    role: 'user',
    sequenceNumber: 1,
    ...overrides,
  };
}

describe('SessionDetail — empty state', () => {
  it('shows a waiting message when there are no items', () => {
    render(<SessionDetail sessionId="s1" items={[]} />);
    expect(screen.getByText(/waiting for session activity/i)).toBeInTheDocument();
  });
});

describe('SessionDetail — role badges', () => {
  it('shows YOU badge for a user message', () => {
    render(<SessionDetail sessionId="s1" items={[output({ type: 'message', role: 'user', content: 'Hi' })]} />);
    expect(screen.getByText('YOU')).toBeInTheDocument();
  });

  it('shows AI badge for an assistant message', () => {
    render(<SessionDetail sessionId="s1" items={[output({ type: 'message', role: 'assistant', content: 'Hello there' })]} />);
    expect(screen.getByText('AI')).toBeInTheDocument();
  });

  it('shows MSG badge for a message with no role', () => {
    render(<SessionDetail sessionId="s1" items={[output({ type: 'message', role: null, content: 'System note' })]} />);
    expect(screen.getByText('MSG')).toBeInTheDocument();
  });
});

describe('SessionDetail — type badges', () => {
  it('shows TOOL badge for tool_use items', () => {
    render(<SessionDetail sessionId="s1" items={[output({ type: 'tool_use', role: null, content: 'run_bash()' })]} />);
    expect(screen.getByText('TOOL')).toBeInTheDocument();
  });

  it('shows RESULT badge for tool_result items', () => {
    render(<SessionDetail sessionId="s1" items={[output({ type: 'tool_result', role: null, content: 'exit 0' })]} />);
    expect(screen.getByText('RESULT')).toBeInTheDocument();
  });

  it('shows ERR badge for error items', () => {
    render(<SessionDetail sessionId="s1" items={[output({ type: 'error', role: null, content: 'Something failed' })]} />);
    expect(screen.getByText('ERR')).toBeInTheDocument();
  });

  it('shows STATUS badge for status_change items', () => {
    render(<SessionDetail sessionId="s1" items={[output({ type: 'status_change', role: null, content: 'Session became active' })]} />);
    expect(screen.getByText('STATUS')).toBeInTheDocument();
  });
});

describe('SessionDetail — tool names', () => {
  it('shows the tool name in brackets for tool_use items', () => {
    render(<SessionDetail sessionId="s1" items={[output({ type: 'tool_use', role: null, toolName: 'read_file', content: 'read_file(main.ts)' })]} />);
    expect(screen.getByText('[read_file]')).toBeInTheDocument();
  });

  it('shows the tool name in brackets for tool_result items', () => {
    render(<SessionDetail sessionId="s1" items={[output({ type: 'tool_result', role: null, toolName: 'bash', content: 'exit 0' })]} />);
    expect(screen.getByText('[bash]')).toBeInTheDocument();
  });

  it('does not show a tool name when toolName is null', () => {
    render(<SessionDetail sessionId="s1" items={[output({ type: 'tool_use', role: null, toolName: null, content: 'run()' })]} />);
    expect(screen.queryByText(/^\[/)).not.toBeInTheDocument();
  });
});

describe('SessionDetail — content rendering', () => {
  it('renders message content as markdown — bold text becomes strong', async () => {
    render(<SessionDetail sessionId="s1" items={[output({ type: 'message', role: 'assistant', content: '**bold word**' })]} />);
    expect(screen.getByText('bold word').tagName).toBe('STRONG');
  });

  it('renders non-message content as plain text without markdown processing', () => {
    render(<SessionDetail sessionId="s1" items={[output({ type: 'tool_result', role: null, content: '**not bold**', toolName: null })]} />);
    // The raw asterisks should be visible as-is
    expect(screen.getByText('**not bold**')).toBeInTheDocument();
  });

  it('renders message content as markdown — inline code becomes code element', () => {
    render(<SessionDetail sessionId="s1" items={[output({ type: 'message', role: 'user', content: 'Use `npm test`' })]} />);
    expect(screen.getByText('npm test').tagName).toBe('CODE');
  });

  it('renders all items when multiple output entries are provided', () => {
    const items = [
      output({ id: '1', type: 'message', role: 'user', content: 'First message', sequenceNumber: 1 }),
      output({ id: '2', type: 'message', role: 'assistant', content: 'Second message', sequenceNumber: 2 }),
      output({ id: '3', type: 'tool_use', role: null, content: 'run_bash()', toolName: 'bash', sequenceNumber: 3 }),
    ];
    render(<SessionDetail sessionId="s1" items={items} />);
    expect(screen.getByText('YOU')).toBeInTheDocument();
    expect(screen.getByText('AI')).toBeInTheDocument();
    expect(screen.getByText('TOOL')).toBeInTheDocument();
    expect(screen.getByText('First message')).toBeInTheDocument();
    expect(screen.getByText('Second message')).toBeInTheDocument();
  });
});

describe('SessionDetail — timestamps', () => {
  it('renders a formatted timestamp for each output item', () => {
    render(<SessionDetail sessionId="s1" items={[output({ timestamp: '2024-01-15T14:30:45.000Z' })]} />);
    // Should show time in HH:MM:SS format
    const timePattern = /\d{1,2}:\d{2}:\d{2}/;
    expect(screen.getByText(timePattern)).toBeInTheDocument();
  });
});
