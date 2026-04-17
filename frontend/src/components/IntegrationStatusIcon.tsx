interface IntegrationStatusIconProps {
  type: 'teams' | 'slack';
  connected: boolean;
  title: string;
}

function TeamsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18" aria-hidden="true">
      <path d="M18.75 6.75a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5z" />
      <path d="M14.25 8.25A2.625 2.625 0 0 0 11.625 5.625h-9A2.625 2.625 0 0 0 0 8.25v6A2.625 2.625 0 0 0 2.625 16.875H11.25a2.625 2.625 0 0 0 2.625-2.625h-.375V8.625h.75V8.25z" />
      <path d="M15.75 8.625v5.625A3.75 3.75 0 0 1 12 18H9.75v.375A2.625 2.625 0 0 0 12.375 21h8.25A2.625 2.625 0 0 0 23.25 18.375v-7.125a2.625 2.625 0 0 0-2.625-2.625h-4.875z" />
    </svg>
  );
}

function SlackIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18" aria-hidden="true">
      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zm10.122 2.521a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.268 0a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zm-2.523 10.122a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zm0-1.268a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
    </svg>
  );
}

export function IntegrationStatusIcon({ type, connected, title }: IntegrationStatusIconProps) {
  return (
    <div
      className={`relative flex items-center justify-center ${connected ? 'text-gray-500' : 'text-gray-300'}`}
      title={title}
      aria-label={title}
    >
      {type === 'teams' ? <TeamsIcon /> : <SlackIcon />}
      <span
        className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-white ${connected ? 'bg-green-500' : 'bg-gray-300'}`}
        aria-hidden="true"
      />
    </div>
  );
}
