import { memo, useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Moon, Play, TriangleAlert } from 'lucide-react';
import type { Session } from '../../types';
import { getSessionOutput, stopSession, dismissSession } from '../../services/api';
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

function getElapsed(startedAt: string): string {
  const ms = Date.now() - new Date(startedAt).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function claudeShortId(id: string): string {
  return id.match(/[0-9a-f]{8}-[0-9a-f]{4}/)?.[0].slice(0, 8) ?? id.slice(0, 8);
}

function KillModal({ session, onCancel, onConfirm, killing, error }: {
  session: Session;
  onCancel: () => void;
  onConfirm: () => void;
  killing: boolean;
  error: string | null;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { cancelRef.current?.focus(); }, []);
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onCancel();
  }, [onCancel]);

  const isLive = session.launchMode === 'pty';
  const hasPid = !!session.pid;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="kill-modal-title"
      className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50"
      onKeyDown={handleKeyDown}
      onClick={onCancel}
    >
      <div className="bg-white rounded-lg p-5 w-full max-w-sm shadow-lg" onClick={e => e.stopPropagation()}>
        <h3 id="kill-modal-title" className="text-sm font-semibold text-gray-900 mb-2">
          {isLive ? 'Kill live session?' : hasPid ? 'Kill detected session?' : 'Dismiss session?'}
        </h3>
        <p className="text-xs text-gray-600 mb-1">
          {isLive
            ? 'This will terminate the Claude process and close the PTY connection.'
            : hasPid
              ? `This will kill the process (PID ${session.pid}). The session was not launched by Argus, so it may be running in another terminal.`
              : 'This session has no tracked process. It will be marked as ended and removed from the active list.'}
        </p>
        {session.summary && (
          <p className="text-xs text-gray-400 italic mb-3 truncate">Topic: {session.summary}</p>
        )}
        {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
        <div className="flex justify-end gap-2">
          <button
            ref={cancelRef}
            onClick={onCancel}
            disabled={killing}
            className="text-sm px-3 py-1.5 text-gray-600 hover:text-gray-800 rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={killing}
            className="text-sm px-3 py-1.5 bg-red-600 text-white rounded-sm hover:bg-red-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-400"
          >
            {killing ? 'Killing...' : isLive || hasPid ? 'Kill' : 'Dismiss'}
          </button>
        </div>
      </div>
    </div>
  );
}

function SessionCard({ session, selected, onSelect }: Props) {
  const [showKillModal, setShowKillModal] = useState(false);
  const [killing, setKilling] = useState(false);
  const [killError, setKillError] = useState<string | null>(null);
  const isAlive = session.status !== 'ended' && session.status !== 'completed';

  const handleKillClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setKillError(null);
    setShowKillModal(true);
  };

  const handleKillConfirm = async () => {
    setKilling(true);
    setKillError(null);
    try {
      if (session.pid) {
        await stopSession(session.id);
      } else {
        await dismissSession(session.id);
      }
      setShowKillModal(false);
    } catch (err) {
      setKillError(err instanceof Error ? err.message : 'Failed to kill session');
    } finally {
      setKilling(false);
    }
  };

  const { data: lastOutput } = useQuery({
    queryKey: ['session-output-last', session.id],
    queryFn: () => getSessionOutput(session.id, { limit: 10 }),
    staleTime: Infinity,
  });

  const items = lastOutput?.items ?? [];
  const previewItem =
    [...items].reverse().find((i: import('../../types').SessionOutput) => i.type === 'tool_result') ??
    [...items].reverse().find((i: import('../../types').SessionOutput) => i.type === 'message') ??
    items[items.length - 1] ??
    null;
  const previewContent = previewItem?.content?.trim() ?? null;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`Session ${session.id.slice(0, 8)} — ${session.status}. Press Enter to ${selected ? 'close' : 'view'} output.`}
      className={`border rounded-md p-4 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400 ${selected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'} ${isInactive(session) && !selected ? 'opacity-75' : ''}`}
      onClick={() => onSelect?.(session.id)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect?.(session.id); } }}
    >
      {/* Header row */}
      <div className="flex justify-between items-start">
        <div className="flex flex-wrap gap-2 items-center">
          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded font-medium ${TYPE_COLORS[session.type] ?? 'bg-gray-100'}`}>
            <SessionTypeIcon type={session.type} size={13} />
            {session.type}
          </span>
          <span className="text-[10px] text-gray-500 font-mono">
            {[
              session.model,
              session.pid ? `PID: ${session.pid}` : (session.type === 'claude-code' ? `ID: ${claudeShortId(session.id)}` : null),
              getElapsed(session.startedAt),
            ].filter(Boolean).join(' | ')}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isInactive(session) ? (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded font-medium bg-amber-100 text-amber-700">
              <Moon size={10} />resting
            </span>
          ) : (
            <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded font-medium ${STATUS_COLORS[session.status] ?? 'bg-gray-100'}`}>
              {session.status === 'active' && <Play size={10} />}
              {session.status === 'active' ? 'running' : session.status}
            </span>
          )}
          {session.launchMode === 'pty' ? (
            <span className="inline-flex items-center text-xs px-2 py-0.5 rounded font-medium bg-emerald-100 text-emerald-700" title="Started via argus launch — prompt injection enabled">live</span>
          ) : (
            <span className="inline-flex items-center text-xs px-2 py-0.5 rounded font-medium bg-gray-100 text-gray-500" title="Detected session — start with argus launch to enable prompts">read-only</span>
          )}
          {isAlive && (
            <button
              onClick={handleKillClick}
              disabled={killing}
              title="Kill session"
              aria-label="Kill session"
              className="text-gray-400 hover:text-red-600 transition-colors disabled:opacity-40"
            >
              <TriangleAlert size={14} />
            </button>
          )}
          <Link
            to={`/sessions/${session.id}`}
            onClick={e => e.stopPropagation()}
            className="text-gray-500 hover:text-blue-600 transition-colors"
            aria-label="View details"
          >
            <ExternalLink size={14} />
          </Link>
        </div>
      </div>

      {/* Summary / topic */}
      <p className={`text-sm mt-2 truncate ${session.summary ? 'text-gray-600' : 'text-gray-400 italic'}`}>
        {session.summary || 'Nothing sent yet'}
      </p>

      {/* Last output preview — fixed 2-line height */}
      <p className={`text-xs bg-gray-900 mt-2 px-2 py-1 rounded line-clamp-2 whitespace-pre-wrap break-words font-mono min-h-[2.5rem] ${previewContent ? 'text-gray-300' : 'text-gray-500 italic'}`}>
        {previewContent || 'Waiting for output...'}
      </p>

      {session.launchMode === 'pty' && (
        <div onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
          <SessionPromptBar session={session} />
        </div>
      )}

      {showKillModal && (
        <KillModal
          session={session}
          onCancel={() => setShowKillModal(false)}
          onConfirm={handleKillConfirm}
          killing={killing}
          error={killError}
        />
      )}
    </div>
  );
}

export default memo(SessionCard);
