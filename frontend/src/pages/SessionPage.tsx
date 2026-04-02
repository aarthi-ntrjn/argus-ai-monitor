import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Moon, Play } from 'lucide-react';
import { getSession, getSessionOutput } from '../services/api';
import SessionDetail from '../components/SessionDetail/SessionDetail';
import SessionPromptBar from '../components/SessionPromptBar/SessionPromptBar';
import SessionTypeIcon from '../components/SessionTypeIcon/SessionTypeIcon';
import { isInactive } from '../utils/sessionUtils';

function getElapsed(startedAt: string, endedAt: string | null): string {
  const end = endedAt ? new Date(endedAt) : new Date();
  const ms = end.getTime() - new Date(startedAt).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function claudeShortId(id: string): string {
  return id.match(/[0-9a-f]{8}-[0-9a-f]{4}/)?.[0].slice(0, 8) ?? id.slice(0, 8);
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  running: 'bg-green-100 text-green-800',
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

export default function SessionPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: session, isLoading: sessionLoading, error: sessionError } = useQuery({
    queryKey: ['session', id],
    queryFn: () => getSession(id!),
    enabled: !!id,
  });

  const { data: outputPage, isLoading: outputLoading } = useQuery({
    queryKey: ['session-output', id],
    queryFn: () => getSessionOutput(id!, { limit: 100 }),
    enabled: !!id,
  });

  if (sessionLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4" />
          <div className="h-64 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  if (sessionError || !session) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <button onClick={() => navigate('/')} className="text-blue-600 hover:text-blue-800 mb-4 flex items-center gap-1">
          ← Back to Dashboard
        </button>
        <div className="text-center text-gray-500 py-16">Session not found.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <button onClick={() => navigate('/')} className="text-blue-600 hover:text-blue-800 mb-6 flex items-center gap-1">
          ← Back to Dashboard
        </button>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex flex-wrap gap-3 items-center mb-2">
            <span className={`inline-flex items-center gap-1 text-sm px-3 py-1 rounded-full font-medium ${TYPE_COLORS[session.type] ?? 'bg-gray-100'}`}>
              <SessionTypeIcon type={session.type} size={14} />
              {session.type}
            </span>
            {session.model && (
              <span className="text-xs text-gray-500 font-mono">{session.model}</span>
            )}
            {isInactive(session) ? (
              <span className="inline-flex items-center gap-1 text-sm px-3 py-1 rounded-full font-medium bg-amber-100 text-amber-700">
                <Moon size={12} />resting
              </span>
            ) : (
              <span className={`inline-flex items-center gap-1 text-sm px-3 py-1 rounded-full font-medium ${STATUS_COLORS[session.status] ?? 'bg-gray-100'}`}>
                {session.status === 'active' && <Play size={12} />}
                {session.status === 'active' ? 'running' : session.status}
              </span>
            )}
            {session.pid && (
              <span className="text-sm text-gray-500">PID: {session.pid}</span>
            )}
            {!session.pid && session.type === 'claude-code' && (
              <span className="text-sm text-gray-500 font-mono">ID: {claudeShortId(session.id)}</span>
            )}
            <span className="text-sm text-gray-500">
              Duration: {getElapsed(session.startedAt, session.endedAt)}
            </span>
          </div>
          {session.summary && (
            <p className="text-gray-600 text-sm mt-2">{session.summary}</p>
          )}
          <p className="text-xs text-gray-400 mt-1">ID: {session.id}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <SessionPromptBar session={session} />
        </div>

        <div className="bg-white border border-gray-200 rounded-lg shadow">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Output Stream</h2>
          </div>
          {outputLoading ? (
            <div className="p-8 text-center text-gray-400">Loading output...</div>
          ) : (
            <div className="rounded-b-lg overflow-hidden bg-gray-900">
              <SessionDetail
                sessionId={session.id}
                items={outputPage?.items ?? []}
                dark
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
