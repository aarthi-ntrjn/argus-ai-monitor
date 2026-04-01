import { useNavigate } from 'react-router-dom';
import type { Session } from '../../types';

interface Props { session: Session; }

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

export default function SessionCard({ session }: Props) {
  const navigate = useNavigate();
  return (
    <div
      className="border border-gray-200 rounded-lg p-4 cursor-pointer hover:bg-gray-50 transition-colors"
      onClick={() => navigate(`/sessions/${session.id}`)}
    >
      <div className="flex justify-between items-start">
        <div className="flex gap-2 items-center">
          <span className={`text-xs px-2 py-0.5 rounded font-medium ${TYPE_COLORS[session.type] ?? 'bg-gray-100'}`}>
            {session.type}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded font-medium ${STATUS_COLORS[session.status] ?? 'bg-gray-100'}`}>
            {session.status}
          </span>
          {session.pid && <span className="text-xs text-gray-400">PID: {session.pid}</span>}
        </div>
        <span className="text-xs text-gray-400">{getElapsed(session.startedAt)}</span>
      </div>
      {session.summary && <p className="text-sm text-gray-600 mt-2 truncate">{session.summary}</p>}
    </div>
  );
}