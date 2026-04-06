import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsPanel } from '../components/SettingsPanel/SettingsPanel';
import type { DashboardSettings } from '../types';

const allOff: DashboardSettings = {
  hideEndedSessions: false,
  hideReposWithNoActiveSessions: false,
  hideInactiveSessions: false,
};

const allOn: DashboardSettings = {
  hideEndedSessions: true,
  hideReposWithNoActiveSessions: true,
  hideInactiveSessions: true,
};

describe('SettingsPanel', () => {
  it('renders all three setting checkboxes', () => {
    render(<SettingsPanel settings={allOff} onToggle={vi.fn()} />);
    expect(screen.getByRole('checkbox', { name: /hide ended sessions/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /hide repos with no active sessions/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /hide inactive sessions/i })).toBeInTheDocument();
  });

  it('shows unchecked checkboxes when all settings are false', () => {
    render(<SettingsPanel settings={allOff} onToggle={vi.fn()} />);
    expect(screen.getByRole('checkbox', { name: /hide ended sessions/i })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: /hide repos with no active sessions/i })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: /hide inactive sessions/i })).not.toBeChecked();
  });

  it('shows checked checkboxes when all settings are true', () => {
    render(<SettingsPanel settings={allOn} onToggle={vi.fn()} />);
    expect(screen.getByRole('checkbox', { name: /hide ended sessions/i })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /hide repos with no active sessions/i })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /hide inactive sessions/i })).toBeChecked();
  });

  it('calls onToggle with "hideEndedSessions" and true when that checkbox is checked', async () => {
    const onToggle = vi.fn();
    render(<SettingsPanel settings={allOff} onToggle={onToggle} />);
    await userEvent.click(screen.getByRole('checkbox', { name: /hide ended sessions/i }));
    expect(onToggle).toHaveBeenCalledWith('hideEndedSessions', true);
  });

  it('calls onToggle with "hideEndedSessions" and false when that checkbox is unchecked', async () => {
    const onToggle = vi.fn();
    render(<SettingsPanel settings={allOn} onToggle={onToggle} />);
    await userEvent.click(screen.getByRole('checkbox', { name: /hide ended sessions/i }));
    expect(onToggle).toHaveBeenCalledWith('hideEndedSessions', false);
  });

  it('calls onToggle with "hideReposWithNoActiveSessions" when that checkbox is toggled', async () => {
    const onToggle = vi.fn();
    render(<SettingsPanel settings={allOff} onToggle={onToggle} />);
    await userEvent.click(screen.getByRole('checkbox', { name: /hide repos with no active sessions/i }));
    expect(onToggle).toHaveBeenCalledWith('hideReposWithNoActiveSessions', true);
  });

  it('calls onToggle with "hideInactiveSessions" when that checkbox is toggled', async () => {
    const onToggle = vi.fn();
    render(<SettingsPanel settings={allOff} onToggle={onToggle} />);
    await userEvent.click(screen.getByRole('checkbox', { name: /hide inactive sessions/i }));
    expect(onToggle).toHaveBeenCalledWith('hideInactiveSessions', true);
  });

  it('each toggle fires exactly once per click', async () => {
    const onToggle = vi.fn();
    render(<SettingsPanel settings={allOff} onToggle={onToggle} />);
    await userEvent.click(screen.getByRole('checkbox', { name: /hide ended sessions/i }));
    expect(onToggle).toHaveBeenCalledOnce();
  });
});
