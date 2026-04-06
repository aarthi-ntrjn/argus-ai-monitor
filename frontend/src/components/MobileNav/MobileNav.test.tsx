import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import MobileNav from './MobileNav';

describe('MobileNav', () => {
  it('renders Sessions and Tasks tabs', () => {
    render(<MobileNav activeTab="sessions" onTabChange={() => {}} />);
    expect(screen.getByRole('button', { name: /sessions/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /tasks/i })).toBeInTheDocument();
  });

  it('marks the active tab with aria-pressed=true', () => {
    render(<MobileNav activeTab="sessions" onTabChange={() => {}} />);
    expect(screen.getByRole('button', { name: /sessions/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /tasks/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('marks the Tasks tab as active when activeTab is tasks', () => {
    render(<MobileNav activeTab="tasks" onTabChange={() => {}} />);
    expect(screen.getByRole('button', { name: /tasks/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /sessions/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('calls onTabChange with sessions when Sessions tab is tapped', () => {
    const handler = vi.fn();
    render(<MobileNav activeTab="tasks" onTabChange={handler} />);
    fireEvent.click(screen.getByRole('button', { name: /sessions/i }));
    expect(handler).toHaveBeenCalledWith('sessions');
  });

  it('calls onTabChange with tasks when Tasks tab is tapped', () => {
    const handler = vi.fn();
    render(<MobileNav activeTab="sessions" onTabChange={handler} />);
    fireEvent.click(screen.getByRole('button', { name: /tasks/i }));
    expect(handler).toHaveBeenCalledWith('tasks');
  });
});
