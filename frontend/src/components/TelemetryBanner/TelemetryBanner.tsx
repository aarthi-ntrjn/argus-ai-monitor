import { Link } from 'react-router-dom';
import { useState } from 'react';
import { Checkbox } from '../Checkbox';
import { Button } from '../Button';

interface TelemetryBannerProps {
  onDismiss: (enabled: boolean) => void;
  subtle?: boolean;
}

export function TelemetryBanner({ onDismiss, subtle = false }: TelemetryBannerProps) {
  const [enabled, setEnabled] = useState(true);

  if (subtle) {
    return (
      <div
        role="note"
        aria-label="Telemetry notice"
        className="flex flex-wrap items-center gap-3 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500"
      >
        <span className="flex-1">
          Argus collects anonymous usage data to improve the product. No personal information is sent.{' '}
          <Link to="/telemetry" className="underline hover:text-gray-700 whitespace-nowrap">What we collect</Link>
        </span>
        <Checkbox
          label="Send telemetry"
          aria-label="Enable anonymous telemetry"
          checked={enabled}
          onChange={e => setEnabled(e.target.checked)}
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDismiss(enabled)}
          aria-label="Dismiss telemetry notice"
        >
          Got it
        </Button>
      </div>
    );
  }

  return (
    <div
      role="banner"
      aria-label="Telemetry notice"
      className="flex items-center gap-3 px-4 py-2 bg-blue-50 border-b border-blue-100 text-sm text-blue-900"
    >
      <span className="flex-1">
        Argus collects anonymous usage data to improve the product. No personal information is sent.{' '}
        <Link to="/telemetry" className="underline hover:text-blue-700 whitespace-nowrap">What we collect</Link>
      </span>
      <Checkbox
        label="Send telemetry"
        aria-label="Enable anonymous telemetry"
        checked={enabled}
        onChange={e => setEnabled(e.target.checked)}
      />
      <Button
        variant="primary"
        size="sm"
        onClick={() => onDismiss(enabled)}
        aria-label="Dismiss telemetry notice"
      >
        Got it
      </Button>
    </div>
  );
}
