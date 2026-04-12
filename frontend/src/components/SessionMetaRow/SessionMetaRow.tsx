import { Link } from 'react-router-dom';
import { Moon, Play, ShieldOff, ExternalLink, Plug, Eye } from 'lucide-react';
import type { Session } from '../../types';
import { isInactive } from '../../utils/sessionUtils';
import SessionTypeIcon from '../SessionTypeIcon/SessionTypeIcon';

interface Props {
  session: Session;
  showLink?: boolean;
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

function getElapsed(startedAt: string, endedAt: string | null): string {
  const end = endedAt ? new Date(endedAt) : new Date();
  const ms = end.getTime() - new Date(startedAt).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function claudeShortId(id: string): string {
  return id.match(/[0-9a-f]{8}-[0-9a-f]{4}/)?.[0].slice(0, 8) ?? id.slice(0, 8);
}

export default function SessionMetaRow({ session, showLink = false }: Props) {
  return (
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
            getElapsed(session.startedAt, session.endedAt),
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
          <span className="inline-flex items-center gap-0.5 text-xs px-2 py-0.5 rounded font-medium bg-emerald-100 text-emerald-700" title="Started via argus launch: prompt injection enabled"><Plug size={10} />connected</span>
        ) : (
          <span className="inline-flex items-center gap-0.5 text-xs px-2 py-0.5 rounded font-medium bg-gray-100 text-gray-500" title="Detected session: start with argus launch to enable prompts"><Eye size={10} />read-only</span>
        )}
        {session.yoloMode === true && (
          <span className="inline-flex items-center gap-0.5 text-xs px-2 py-0.5 rounded font-medium bg-red-100 text-red-700" title="Session launched with auto-approve (yolo mode)">
            <ShieldOff size={10} />yolo
          </span>
        )}
        {showLink && (
          <Link
            to={`/sessions/${session.id}`}
            onClick={e => e.stopPropagation()}
            className="text-gray-500 hover:text-blue-600 transition-colors"
            aria-label="View details"
          >
            <ExternalLink size={14} />
          </Link>
        )}
      </div>
    </div>
  );
}
