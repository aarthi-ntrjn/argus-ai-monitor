import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { KillSessionDialog } from '../components/KillSessionDialog/KillSessionDialog';

describe('KillSessionDialog', () => {
  it('renders when open is true', () => {
    render(<KillSessionDialog open={true} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('does not render when open is false', () => {
    render(<KillSessionDialog open={false} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('calls onConfirm when the confirm button is clicked', async () => {
    const onConfirm = vi.fn();
    render(<KillSessionDialog open={true} onConfirm={onConfirm} onCancel={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /kill session/i }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('calls onCancel when the cancel button is clicked', async () => {
    const onCancel = vi.fn();
    render(<KillSessionDialog open={true} onConfirm={vi.fn()} onCancel={onCancel} />);
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('shows session type and short id in description', () => {
    render(
      <KillSessionDialog
        open={true}
        sessionType="claude-code"
        sessionId="abcdef12-3456-7890-abcd-ef1234567890"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByRole('dialog')).toHaveTextContent('claude-code');
    expect(screen.getByRole('dialog')).toHaveTextContent('abcdef12');
  });

  it('shows spinner with "Killing session" text when isPending', () => {
    render(
      <KillSessionDialog open={true} isPending={true} onConfirm={vi.fn()} onCancel={vi.fn()} />
    );
    expect(screen.getByText(/killing session/i)).toBeInTheDocument();
    expect(screen.getByText(/waiting for the process to exit/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /kill session/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument();
  });

  it('displays error message when error is provided', () => {
    render(
      <KillSessionDialog
        open={true}
        error={new Error('Session already ended')}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByText('Session already ended')).toBeInTheDocument();
  });

  it('has correct accessibility attributes', () => {
    render(<KillSessionDialog open={true} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'kill-dialog-title');
  });
});

describe('KillSessionDialog event propagation', () => {
  it('does not bubble click events to parent when confirm button is clicked', async () => {
    const parentClick = vi.fn();
    render(
      <div onClick={parentClick}>
        <KillSessionDialog open={true} onConfirm={vi.fn()} onCancel={vi.fn()} />
      </div>
    );
    await userEvent.click(screen.getByRole('button', { name: /kill session/i }));
    expect(parentClick).not.toHaveBeenCalled();
  });

  it('does not bubble click events to parent when cancel button is clicked', async () => {
    const parentClick = vi.fn();
    render(
      <div onClick={parentClick}>
        <KillSessionDialog open={true} onConfirm={vi.fn()} onCancel={vi.fn()} />
      </div>
    );
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(parentClick).not.toHaveBeenCalled();
  });
});

describe('KillSessionDialog error scenarios', () => {
  it('displays 404 not-found error message', () => {
    render(
      <KillSessionDialog
        open={true}
        error={new Error('Session not found')}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByText('Session not found')).toBeInTheDocument();
  });

  it('displays 409 already-ended error message', () => {
    render(
      <KillSessionDialog
        open={true}
        error={new Error('Session has already ended')}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByText('Session has already ended')).toBeInTheDocument();
  });

  it('displays 403 not-permitted error message', () => {
    render(
      <KillSessionDialog
        open={true}
        error={new Error('Not permitted to kill this session')}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByText('Not permitted to kill this session')).toBeInTheDocument();
  });

  it('displays generic network error message', () => {
    render(
      <KillSessionDialog
        open={true}
        error={new Error('Network Error')}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByText('Network Error')).toBeInTheDocument();
  });

  it('allows retry after error by keeping confirm button enabled', () => {
    render(
      <KillSessionDialog
        open={true}
        error={new Error('Network Error')}
        isPending={false}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: /kill session/i })).not.toBeDisabled();
  });
});
