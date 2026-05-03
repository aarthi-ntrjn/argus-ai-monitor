import { memo, useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Session } from '../../types';
import { getSessionOutput } from '../../services/api';
import { isInactive, type PendingChoice } from '../../utils/sessionUtils';
import { useArgusSettings } from '../../hooks/useArgusSettings';
import SessionPromptBar, { type SessionPromptBarHandle } from '../SessionPromptBar/SessionPromptBar';
import SessionMetaRow from '../SessionMetaRow/SessionMetaRow';
import { useKillSession } from '../../hooks/useKillSession';
import { KillSessionDialog } from '../KillSessionDialog/KillSessionDialog';
import PendingChoicePanel from '../PendingChoicePanel/PendingChoicePanel';

interface Props {
  session: Session;
  selected?: boolean;
  onSelect?: (id: string) => void;
}


function SessionCard({ session, selected, onSelect }: Props) {
  const { settings: argusSettings } = useArgusSettings();
  const thresholdMs = (argusSettings?.restingThresholdMinutes ?? 20) * 60_000;

  const { data: lastOutput } = useQuery({
    queryKey: ['session-output-last', session.id],
    queryFn: () => getSessionOutput(session.id, { limit: 10 }),
    staleTime: Infinity,
  });

  const { data: hookPendingChoice = null } = useQuery<PendingChoice | null>({
    queryKey: ['session-pending-choice', session.id],
    queryFn: () => Promise.resolve(null),
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const kill = useKillSession();

  const [questionIdx, setQuestionIdx] = useState(0);
  useEffect(() => { setQuestionIdx(0); }, [hookPendingChoice]);

  const promptBarRef = useRef<SessionPromptBarHandle>(null);

  const items = lastOutput?.items ?? [];
  const previewItem =
    [...items].reverse().find((i: import('../../types').SessionOutput) => i.type === 'message' && i.role === 'assistant') ??
    null;
  const previewContent = previewItem?.content?.trim() ?? null;
  const isTerminated = session.status === 'ended' || session.status === 'completed';
  const pendingChoice = isTerminated ? null : hookPendingChoice;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`Session ${session.id.slice(0, 8)} — ${session.status}. Press Enter to ${selected ? 'close' : 'view'} output.`}
      className={`interactive-card p-4 ${selected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-neutral-400 hover:bg-neutral-100'} ${isInactive(session, thresholdMs) && !selected ? 'opacity-75' : ''}`}
      onClick={() => onSelect?.(session.id)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect?.(session.id); } }}
    >
      {/* Header row */}
      <SessionMetaRow session={session} showLink onKill={kill.requestKill} killPending={kill.isPending} />

      {/* Summary / topic */}
      {pendingChoice !== null ? (
        <PendingChoicePanel pendingChoice={pendingChoice} session={session} idx={questionIdx} onAdvance={() => setQuestionIdx(i => i + 1)} onFocusPromptBar={() => promptBarRef.current?.focusInput()} />
      ) : (
        <p className={`text-sm mt-2 truncate ${session.summary ? 'text-gray-600' : 'text-gray-500 italic'}`}>
          {session.summary || 'Nothing sent yet'}
        </p>
      )}

      {/* Last output preview — fixed 2-line height */}
      <div className={`text-xs bg-gray-900 mt-2 px-2 py-1 rounded line-clamp-2 break-words font-mono min-h-[2.5rem] ${previewContent ? 'text-gray-300' : 'text-gray-500 italic'}`}>
        {previewContent
          ? <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
              p: ({ children }) => <span>{children}</span>,
              code: ({ children }) => <code className="bg-gray-700 rounded px-0.5">{children}</code>,
              strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
              em: ({ children }) => <em>{children}</em>,
              a: ({ children }) => <span className="text-blue-400 underline">{children}</span>,
            }}>{previewContent}</ReactMarkdown>
          : 'Waiting for output...'}
      </div>

      {session.launchMode === 'pty' && (
        <div onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
          <SessionPromptBar ref={promptBarRef} session={session} onPromptSent={pendingChoice ? () => setQuestionIdx(i => i + 1) : undefined} />
        </div>
      )}

      <KillSessionDialog
        open={kill.dialogOpen}
        sessionType={session.type}
        sessionId={session.id}
        isPending={kill.isPending}
        error={kill.error}
        onConfirm={kill.confirmKill}
        onCancel={kill.cancelKill}
      />
    </div>
  );
}

export default memo(SessionCard);
