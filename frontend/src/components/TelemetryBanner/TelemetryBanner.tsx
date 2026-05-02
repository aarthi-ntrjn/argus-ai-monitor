import { Link } from 'react-router-dom';
import { Button } from '../Button';

interface TelemetryBannerProps {
  onDismiss: () => void;
  onOpenSettings: () => void;
  subtle?: boolean;
}

const INLINE_ACTION_CLASSES = '!inline !p-0 !text-sm !font-normal align-baseline underline whitespace-nowrap';

export function TelemetryBanner({ onDismiss, onOpenSettings, subtle = false }: TelemetryBannerProps) {
  const textActionClassName = subtle
    ? 'text-gray-500 hover:text-gray-700'
    : 'text-blue-900 hover:text-blue-700';
  const buttonActionClassName = subtle
    ? `${INLINE_ACTION_CLASSES} !text-gray-500 hover:!text-gray-700`
    : `${INLINE_ACTION_CLASSES} !text-blue-900 hover:!text-blue-700`;
  const dismissClassName = subtle
    ? 'icon-btn shrink-0 p-0 leading-none text-gray-400 hover:text-gray-600'
    : 'icon-btn shrink-0 p-0 leading-none text-blue-700/70 hover:text-blue-700';

  if (subtle) {
    return (
      <div
        role="note"
        aria-label="Telemetry notice"
        className="flex flex-wrap items-center gap-3 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500"
      >
        <span className="flex-1">
          Argus collects anonymous usage data to improve the product. No coding or personal information is sent. Country and region is captured.{' '}
          <span className="inline-flex items-baseline gap-1">
            <Link to="/telemetry" className={`${textActionClassName} underline whitespace-nowrap`}>What we collect</Link>
            <span aria-hidden="true">-</span>
            <Button type="button" variant="ghost" size="sm" className={buttonActionClassName} onClick={() => onOpenSettings()}>Opt out</Button>
          </span>
        </span>
        <button type="button" onClick={() => onDismiss()} aria-label="Dismiss telemetry notice" className={dismissClassName}>&times;</button>
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
        Argus collects anonymous usage data to improve the product. No coding or personal information is sent. Country and region is captured.{' '}
        <span className="inline-flex items-baseline gap-1">
          <Link to="/telemetry" className={`${textActionClassName} underline whitespace-nowrap`}>What we collect</Link>
          <span aria-hidden="true">-</span>
          <Button type="button" variant="ghost" size="sm" className={buttonActionClassName} onClick={() => onOpenSettings()}>Opt out</Button>
        </span>
      </span>
      <button type="button" onClick={() => onDismiss()} aria-label="Dismiss telemetry notice" className={dismissClassName}>&times;</button>
    </div>
  );
}
