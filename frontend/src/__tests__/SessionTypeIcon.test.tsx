import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SessionTypeIcon from '../components/SessionTypeIcon/SessionTypeIcon';

describe('SessionTypeIcon', () => {
  it('renders the Claude icon for claude-code sessions', () => {
    render(<SessionTypeIcon type="claude-code" />);
    expect(screen.getByRole('img', { name: 'Claude' })).toBeInTheDocument();
  });

  it('renders the GitHub Copilot icon for copilot-cli sessions', () => {
    render(<SessionTypeIcon type="copilot-cli" />);
    expect(screen.getByRole('img', { name: 'GitHub Copilot' })).toBeInTheDocument();
  });

  it('renders nothing for an unknown session type', () => {
    const { container } = render(<SessionTypeIcon type="unknown-type" />);
    expect(container.firstChild).toBeNull();
  });

  it('applies the given size to the svg dimensions', () => {
    render(<SessionTypeIcon type="claude-code" size={32} />);
    const svg = screen.getByRole('img', { name: 'Claude' });
    expect(svg).toHaveAttribute('width', '32');
    expect(svg).toHaveAttribute('height', '32');
  });

  it('uses 14 as the default size', () => {
    render(<SessionTypeIcon type="copilot-cli" />);
    const svg = screen.getByRole('img', { name: 'GitHub Copilot' });
    expect(svg).toHaveAttribute('width', '14');
    expect(svg).toHaveAttribute('height', '14');
  });
});
