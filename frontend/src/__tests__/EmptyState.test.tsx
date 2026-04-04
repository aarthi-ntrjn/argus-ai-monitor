import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EmptyState from '../components/EmptyState/EmptyState';

describe('EmptyState', () => {
  it('renders the title and message', () => {
    render(<EmptyState title="Nothing here" message="Add something to get started." />);
    expect(screen.getByRole('heading', { name: 'Nothing here' })).toBeInTheDocument();
    expect(screen.getByText('Add something to get started.')).toBeInTheDocument();
  });

  it('renders the default icon when no icon prop is given', () => {
    render(<EmptyState title="Empty" message="No items." />);
    expect(screen.getByText('📭')).toBeInTheDocument();
  });

  it('renders a custom icon when provided', () => {
    render(<EmptyState icon="🚀" title="Empty" message="No items." />);
    expect(screen.getByText('🚀')).toBeInTheDocument();
  });

  it('does not render an action button when action is not provided', () => {
    render(<EmptyState title="Empty" message="No items." />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders the action button with the given label when action is provided', () => {
    render(
      <EmptyState
        title="Empty"
        message="No items."
        action={{ label: 'Add Repository', onClick: vi.fn() }}
      />
    );
    expect(screen.getByRole('button', { name: 'Add Repository' })).toBeInTheDocument();
  });

  it('calls the action onClick handler when the button is clicked', async () => {
    const onClick = vi.fn();
    render(
      <EmptyState
        title="Empty"
        message="No items."
        action={{ label: 'Go', onClick }}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: 'Go' }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
