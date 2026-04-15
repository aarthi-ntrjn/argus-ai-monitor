import { useState } from 'react';
import { Checkbox } from '../Checkbox';
import { Button } from '../Button';

interface TelemetryBannerProps {
  onDismiss: (enabled: boolean) => void;
}

export function TelemetryBanner({ onDismiss }: TelemetryBannerProps) {
  const [enabled, setEnabled] = useState(true);

  return (
    <div
      role="banner"
      aria-label="Telemetry notice"
      className="flex items-center gap-3 px-4 py-2 bg-blue-50 border-b border-blue-100 text-sm text-blue-900"
    >
      <span className="flex-1">
        Argus collects anonymous usage data to improve the product. No personal information is sent.
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
