import { Link } from 'react-router-dom';
import { Moon, Play, ShieldOff, ExternalLink, Plug, Eye, Power } from 'lucide-react';
import type { Session } from '../../types';
import { isInactive } from '../../utils/sessionUtils';
import { useSettings } from '../../hooks/useSettings';
import SessionTypeIcon from '../SessionTypeIcon/SessionTypeIcon';
import Badge from '../Badge';

interface Props {
  session: Session;
  showLink?: boolean;
  onKill?: (sessionId: string) => void;
  killPending?: boolean;
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

export default function SessionMetaRow({ session, showLink = false, onKill, killPending = false }: Props) {
  const [settings] = useSettings();
  const thresholdMs = settings.restingThresholdMinutes * 60_000;
  const isKillable = onKill && session.pid != null && session.status !== 'ended' && session.status !== 'completed';

  return (
    <div className="flex justify-between items-start">
      <div className="flex flex-wrap gap-2 items-center">
        <Badge colorClass={TYPE_COLORS[session.type] ?? 'bg-gray-100'} icon={<SessionTypeIcon type={session.type} size={13} />}>
          {session.type}
        </Badge>
        <span className="text-[10px] text-gray-500 font-mono">
          {[
            session.model,
            session.pid ? `PID: ${session.pid}` : (session.type === 'claude-code' ? `ID: ${claudeShortId(session.id)}` : null),
            getElapsed(session.startedAt, session.endedAt),
          ].filter(Boolean).join(' | ')}
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {isInactive(session, thresholdMs) ? (
          <Badge colorClass="bg-amber-100 text-amber-700" icon={<Moon size={10} aria-hidden="true" />}>resting</Badge>
        ) : (
          <Badge
            colorClass={STATUS_COLORS[session.status] ?? 'bg-gray-100'}
            icon={session.status === 'active' ? <Play size={10} aria-hidden="true" /> : undefined}
          >
            {session.status === 'active' ? 'running' : session.status}
          </Badge>
        )}
        {session.launchMode === 'pty' ? (
          <Badge colorClass="bg-green-100 text-green-800" icon={<Plug size={10} aria-hidden="true" />} title="Started via argus launch: prompt injection enabled">connected</Badge>
        ) : (
          <Badge icon={<Eye size={10} aria-hidden="true" />} title="Detected session: start with argus launch to enable prompts">read-only</Badge>
        )}
        {session.yoloMode === true && (
          <Badge colorClass="bg-red-100 text-red-700" icon={<ShieldOff size={10} aria-hidden="true" />} title="Session launched with auto-approve (yolo mode)">yolo</Badge>
        )}
        {showLink && (
          <Link
            to={`/sessions/${session.id}`}
            onClick={e => e.stopPropagation()}
            className="icon-btn text-gray-500 hover:text-blue-600"
            aria-label="View details"
          >
            <ExternalLink size={14} aria-hidden="true" />
          </Link>
        )}
        {isKillable && (
          <button
            onClick={e => { e.stopPropagation(); onKill(session.id); }}
            disabled={killPending}
            className="icon-btn text-gray-400 hover:text-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Kill session"
          >
            <Power size={14} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}
