import teamsUrl from '../images/microsoft-teams.svg?url';
import slackUrl from '../images/slack.svg?url';

interface IntegrationStatusIconProps {
  type: 'teams' | 'slack';
  connected: boolean;
  title: string;
}

export function IntegrationStatusIcon({ type, connected, title }: IntegrationStatusIconProps) {
  const src = type === 'teams' ? teamsUrl : slackUrl;
  return (
    <div
      className={`relative flex items-center justify-center transition-opacity ${connected ? 'opacity-80' : 'opacity-25'}`}
      title={title}
      aria-label={title}
    >
      <img src={src} alt="" width={18} height={18} aria-hidden="true" />
      <span
        className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-white ${connected ? 'bg-green-500' : 'bg-gray-300'}`}
        aria-hidden="true"
      />
    </div>
  );
}

