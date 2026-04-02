import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { Session } from '../../types';
import { getSessionOutput } from '../../services/api';
import { isInactive } from '../../utils/sessionUtils';
import SessionPromptBar from '../SessionPromptBar/SessionPromptBar';
import SessionTypeIcon from '../SessionTypeIcon/SessionTypeIcon';

interface Props {
  session: Session;
  selected?: boolean;
  onSelect?: (id: string) => void;
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  idle: 'bg-yellow-100 text-yellow-800',
  waiting: 'bg-blue-100 text-blue-800',
  error: 'bg-red-100 text-red-800',
  completed: 'bg-gray-100 text-gray-800',
  ended: 'bg-gray-100 text-gray-500',
};

const TYPE_COLORS: Record<string, string> = {
  'copilot-cli': 'bg-purple-100 text-purple-800',
  'claude-code': 'bg-orange-100 text-orange-800',
};

function getElapsed(startedAt: string): string {
  const ms = Date.now() - new Date(startedAt).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

// Claude session IDs are prefixed (e.g. 'claude-startup-8c20d263-780c-…').
// Extract the first UUID hex segment to get a meaningful short identifier.
function claudeShortId(id: string): string {
  return id.match(/[0-9a-f]{8}-[0-9a-f]{4}/)?.[0].slice(0, 8) ?? id.slice(0, 8);
}

export default function SessionCard({ session, selected, onSelect }: Props) {
  const { data: lastOutput } = useQuery({
    queryKey: ['session-output-last', session.id],
    queryFn: () => getSessionOutput(session.id, { limit: 1 }),
    staleTime: 5000,
  });

  const lastLine = lastOutput?.items[0]?.content?.split('\n').find(l => l.trim()) ?? null;

  return (
    <div
      className={`border rounded-lg p-4 transition-colors cursor-pointer ${selected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'} ${isInactive(session) && !selected ? 'opacity-75' : ''}`}
      onClick={() => onSelect?.(session.id)}
    >
      {/* Header row */}
      <div className="flex justify-between items-start">
        <div className="flex flex-wrap gap-2 items-center">
          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded font-medium ${TYPE_COLORS[session.type] ?? 'bg-gray-100'}`}>
            <SessionTypeIcon type={session.type} size={13} />
            {session.type}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded font-medium ${STATUS_COLORS[session.status] ?? 'bg-gray-100'}`}>
            {session.status}
          </span>
          {isInactive(session) && (
            <span className="text-xs px-2 py-0.5 rounded font-medium bg-amber-100 text-amber-700">inactive</span>
          )}
          {session.pid && <span className="text-xs text-gray-400">PID: {session.pid}</span>}
          {!session.pid && session.type === 'claude-code' && (
            <span className="text-xs text-gray-400 font-mono">ID: {claudeShortId(session.id)}</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-gray-400">{getElapsed(session.startedAt)}</span>
          <Link
            to={`/sessions/${session.id}`}
            onClick={e => e.stopPropagation()}
            className="text-xs text-blue-500 hover:underline"
            aria-label="View details"
          >
            View details
          </Link>
        </div>
      </div>

      {/* Summary */}
      {session.summary && <p className="text-sm text-gray-600 mt-2 truncate">{session.summary}</p>}

      {/* Prompt bar (send + ⋮ actions) */}
      <div onClick={e => e.stopPropagation()}>
        <SessionPromptBar session={session} />
      </div>

      {/* Last output preview — below interactive controls so it never obscures the prompt */}
      {lastLine && (
        <p className="text-xs text-gray-400 mt-1 truncate font-mono">{lastLine}</p>
      )}
    </div>
  );
}
