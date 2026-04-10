import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
    toolCallId: null,
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
    render(<SessionDetail sessionId="s1" items={[output({ type: 'tool_result', role: null, content: 'exit 0' })]} displayMode="verbose" />);
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
    render(<SessionDetail sessionId="s1" items={[output({ type: 'tool_result', role: null, toolName: 'bash', content: 'exit 0' })]} displayMode="verbose" />);
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
    render(<SessionDetail sessionId="s1" items={[output({ type: 'tool_result', role: null, content: '**not bold**', toolName: null })]} displayMode="verbose" />);
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

describe('SessionDetail — verbose mode truncation (P3)', () => {
  it('truncates tool_result content > 40 lines in verbose mode', () => {
    const longContent = Array.from({ length: 50 }, (_, i) => `line ${i + 1}`).join('\n');
    const items = [
      output({ id: '1', type: 'tool_result', role: null, content: longContent, toolName: null, sequenceNumber: 1 }),
    ];
    render(<SessionDetail sessionId="s1" items={items} displayMode="verbose" />);
    expect(screen.queryByText('line 50')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /show more/i })).toBeInTheDocument();
  });

  it('does not truncate tool_result content <= 40 lines in verbose mode', () => {
    const shortContent = Array.from({ length: 10 }, (_, i) => `line ${i + 1}`).join('\n');
    const items = [
      output({ id: '1', type: 'tool_result', role: null, content: shortContent, toolName: null, sequenceNumber: 1 }),
    ];
    render(<SessionDetail sessionId="s1" items={items} displayMode="verbose" />);
    expect(screen.getByText(/line 10/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /show more/i })).not.toBeInTheDocument();
  });

  it('reveals full content when Show more is clicked', async () => {
    const user = userEvent.setup();
    const longContent = Array.from({ length: 50 }, (_, i) => `line ${i + 1}`).join('\n');
    const items = [
      output({ id: '1', type: 'tool_result', role: null, content: longContent, toolName: null, sequenceNumber: 1 }),
    ];
    render(<SessionDetail sessionId="s1" items={items} displayMode="verbose" />);
    await user.click(screen.getByRole('button', { name: /show more/i }));
    expect(screen.getByText(/line 50/)).toBeInTheDocument();
  });
});

describe('SessionDetail — focused mode (default)', () => {
  it('hides tool_result rows in focused mode by default', () => {
    const items = [
      output({ id: '1', type: 'tool_use', toolCallId: 'call-1', toolName: 'bash', content: 'run()', sequenceNumber: 1 }),
      output({ id: '2', type: 'tool_result', toolCallId: 'call-1', content: 'file contents here', toolName: null, sequenceNumber: 2 }),
    ];
    render(<SessionDetail sessionId="s1" items={items} />);
    expect(screen.queryByText('file contents here')).not.toBeInTheDocument();
  });

  it('shows tool_result rows in verbose mode', () => {
    const items = [
      output({ id: '1', type: 'tool_result', role: null, content: 'file contents here', toolName: null, sequenceNumber: 1 }),
    ];
    render(<SessionDetail sessionId="s1" items={items} displayMode="verbose" />);
    expect(screen.getByText('file contents here')).toBeInTheDocument();
  });

  it('shows expand button for collapsed tool_result in focused mode', () => {
    const items = [
      output({ id: '1', type: 'tool_use', toolCallId: 'call-1', toolName: 'bash', content: 'run()', sequenceNumber: 1 }),
      output({ id: '2', type: 'tool_result', toolCallId: 'call-1', content: 'hidden content', toolName: null, sequenceNumber: 2 }),
    ];
    render(<SessionDetail sessionId="s1" items={items} />);
    expect(screen.getByRole('button', { name: /show result/i })).toBeInTheDocument();
  });

  it('reveals tool_result content after clicking expand button', async () => {
    const user = userEvent.setup();
    const items = [
      output({ id: '1', type: 'tool_use', toolCallId: 'call-1', toolName: 'bash', content: 'run()', sequenceNumber: 1 }),
      output({ id: '2', type: 'tool_result', toolCallId: 'call-1', content: 'revealed content', toolName: null, sequenceNumber: 2 }),
    ];
    render(<SessionDetail sessionId="s1" items={items} />);
    await user.click(screen.getByRole('button', { name: /show result/i }));
    expect(screen.getByText('revealed content')).toBeInTheDocument();
  });

  it('shows compact summary for tool_use rows — not raw JSON', () => {
    const jsonContent = JSON.stringify({ path: 'src/App.tsx', old_str: 'foo', new_str: 'bar' });
    const items = [
      output({ id: '1', type: 'tool_use', role: null, content: jsonContent, toolName: 'Edit', sequenceNumber: 1 }),
    ];
    render(<SessionDetail sessionId="s1" items={items} />);
    expect(screen.getByText('Edit: src/App.tsx')).toBeInTheDocument();
    expect(screen.queryByText(jsonContent)).not.toBeInTheDocument();
  });

  it('shows expand button for tool_use rows to reveal full JSON', () => {
    const items = [
      output({ id: '1', type: 'tool_use', role: null, content: 'src/App.tsx', toolName: 'Read', sequenceNumber: 1 }),
    ];
    render(<SessionDetail sessionId="s1" items={items} />);
    expect(screen.getByRole('button', { name: /show details/i })).toBeInTheDocument();
  });

  it('reveals tool_use full content after clicking expand', async () => {
    const user = userEvent.setup();
    const items = [
      output({ id: '1', type: 'tool_use', role: null, content: 'src/App.tsx', toolName: 'Read', sequenceNumber: 1 }),
    ];
    render(<SessionDetail sessionId="s1" items={items} />);
    await user.click(screen.getByRole('button', { name: /show details/i }));
    expect(screen.getByText('src/App.tsx')).toBeInTheDocument();
  });

  it('always shows error rows regardless of display mode', () => {
    const items = [
      output({ id: '1', type: 'error', role: null, content: 'Fatal error occurred', toolName: null, sequenceNumber: 1 }),
    ];
    render(<SessionDetail sessionId="s1" items={items} />);
    expect(screen.getByText('Fatal error occurred')).toBeInTheDocument();
  });

  it('always shows status_change rows regardless of display mode', () => {
    const items = [
      output({ id: '1', type: 'status_change', role: null, content: 'Session started', toolName: null, sequenceNumber: 1 }),
    ];
    render(<SessionDetail sessionId="s1" items={items} />);
    expect(screen.getByText('Session started')).toBeInTheDocument();
  });
});
