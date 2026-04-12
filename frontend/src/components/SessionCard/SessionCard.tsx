import { memo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Session } from '../../types';
import { getSessionOutput } from '../../services/api';
import { isInactive, detectPendingChoice } from '../../utils/sessionUtils';
import { useSettings } from '../../hooks/useSettings';
import SessionPromptBar from '../SessionPromptBar/SessionPromptBar';
import SessionMetaRow from '../SessionMetaRow/SessionMetaRow';

interface Props {
  session: Session;
  selected?: boolean;
  onSelect?: (id: string) => void;
}


function SessionCard({ session, selected, onSelect }: Props) {
  const [settings] = useSettings();
  const thresholdMs = settings.restingThresholdMinutes * 60_000;

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
  const isTerminated = session.status === 'ended' || session.status === 'completed';
  const pendingChoice = isTerminated ? null : detectPendingChoice(items);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`Session ${session.id.slice(0, 8)} — ${session.status}. Press Enter to ${selected ? 'close' : 'view'} output.`}
      className={`border rounded-md p-4 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400 ${selected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'} ${isInactive(session, thresholdMs) && !selected ? 'opacity-75' : ''}`}
      onClick={() => onSelect?.(session.id)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect?.(session.id); } }}
    >
      {/* Header row */}
      <SessionMetaRow session={session} showLink />

      {/* Summary / topic */}
      {pendingChoice !== null ? (
        <p role="alert" className="text-sm mt-2 line-clamp-3 whitespace-normal break-words">
          <span className="font-bold text-red-600">ATTENTION NEEDED</span>
          {pendingChoice.question ? ` ${pendingChoice.question}` : ''}
          {pendingChoice.choices.length > 0 && (
            <span className="text-gray-600">
              {' '}{pendingChoice.choices.map((c, i) => `${i + 1}. ${c}`).join(' / ')}
            </span>
          )}
        </p>
      ) : (
        <p className={`text-sm mt-2 truncate ${session.summary ? 'text-gray-600' : 'text-gray-400 italic'}`}>
          {session.summary || 'Nothing sent yet'}
        </p>
      )}

      {/* Last output preview — fixed 2-line height */}
      <p className={`text-xs bg-gray-900 mt-2 px-2 py-1 rounded line-clamp-2 whitespace-pre-wrap break-words font-mono min-h-[2.5rem] ${previewContent ? 'text-gray-300' : 'text-gray-500 italic'}`}>
        {previewContent || 'Waiting for output...'}
      </p>

      {session.launchMode === 'pty' && (
        <div onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
          <SessionPromptBar session={session} />
        </div>
      )}
    </div>
  );
}

export default memo(SessionCard);
