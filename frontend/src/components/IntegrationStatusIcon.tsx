import teamsUrl from '../images/microsoft-teams.svg?url';
import slackUrl from '../images/slack.svg?url';

interface IntegrationStatusIconProps {
  type: 'teams' | 'slack';
  connected: boolean;
  title: string;
  onClick?: () => void;
  disabled?: boolean;
}

export function IntegrationStatusIcon({ type, connected, title, onClick, disabled }: IntegrationStatusIconProps) {
  const src = type === 'teams' ? teamsUrl : slackUrl;
  const inner = (
    <>
      <img src={src} alt="" width={16} height={16} aria-hidden="true" />
      <span
        className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-white ${connected ? 'bg-green-500' : 'bg-gray-300'}`}
        aria-hidden="true"
      />
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        title={title}
        aria-label={title}
        className={`icon-btn relative flex items-center justify-center transition-opacity ${connected ? 'opacity-80' : 'opacity-25'} disabled:cursor-not-allowed`}
      >
        {inner}
      </button>
    );
  }

  return (
    <div
      className={`relative flex items-center justify-center transition-opacity ${connected ? 'opacity-80' : 'opacity-25'}`}
      title={title}
      aria-label={title}
    >
      {inner}
    </div>
  );
}
