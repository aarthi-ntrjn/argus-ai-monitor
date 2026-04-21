import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { TelemetryBanner } from '../components/TelemetryBanner';

describe('TelemetryBanner', () => {
  it('opens settings from the opt-out action', async () => {
    const onDismiss = vi.fn();
    const onOpenSettings = vi.fn();

    render(
      <MemoryRouter>
        <TelemetryBanner onDismiss={onDismiss} onOpenSettings={onOpenSettings} subtle />
      </MemoryRouter>
    );

    await userEvent.click(screen.getByRole('button', { name: /opt out\?/i }));

    expect(onOpenSettings).toHaveBeenCalledOnce();
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('dismisses the notice without changing telemetry state directly', async () => {
    const onDismiss = vi.fn();

    render(
      <MemoryRouter>
        <TelemetryBanner onDismiss={onDismiss} onOpenSettings={vi.fn()} subtle />
      </MemoryRouter>
    );

    await userEvent.click(screen.getByRole('button', { name: /dismiss telemetry notice/i }));

    expect(onDismiss).toHaveBeenCalledWith();
  });
});
