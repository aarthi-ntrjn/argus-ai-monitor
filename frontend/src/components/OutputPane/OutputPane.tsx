import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getSessionOutput } from '../../services/api';
import type { Session } from '../../types';
import { useSettings } from '../../hooks/useSettings';
import SessionDetail from '../SessionDetail/SessionDetail';

interface Props {
  session: Session;
  onClose?: () => void;
  className?: string;
  'data-tour-id'?: string;
}

export default function OutputPane({ session, onClose, className, 'data-tour-id': dataTourId }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [settings, updateSetting] = useSettings();
  const displayMode = settings.outputDisplayMode ?? 'focused';

  const { data, isError } = useQuery({
    queryKey: ['session-output', session.id],
    queryFn: () => getSessionOutput(session.id, { limit: 100 }),
  });

  useEffect(() => {
    if (!onClose) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [data]);

  function toggleMode() {
    updateSetting('outputDisplayMode', displayMode === 'focused' ? 'verbose' : 'focused');
  }

  return (
    <section
      aria-label="Session output"
      data-tour-id={dataTourId}
      className={`flex flex-col bg-white border border-gray-200 rounded-lg overflow-hidden ${className ?? 'h-full'}`}
    >
      <div className="flex items-center justify-between px-3 py-2 bg-white border-b border-gray-200">
        <span className="text-xs font-medium text-gray-600 truncate">Session {session.id}</span>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleMode}
            aria-label={displayMode === 'focused' ? 'Focused' : 'Verbose'}
            title={displayMode === 'focused' ? 'Switch to verbose mode' : 'Switch to focused mode'}
            className="inline-flex items-center text-xs px-2 py-0.5 rounded font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400"
          >
            {displayMode === 'focused' ? 'Focused' : 'Verbose'}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              aria-label="Close output pane"
              className="text-gray-500 hover:text-gray-700 transition-colors p-1 rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400"
            >
              <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto rounded-b-lg">
        {isError ? (
          <p className="p-6 text-center text-sm text-red-400">Failed to load output. Is the server running?</p>
        ) : (
          <>
            <SessionDetail sessionId={session.id} items={data?.items ?? []} dark displayMode={displayMode} className="max-h-none pb-0" />
            <div ref={bottomRef} />
          </>
        )}
      </div>
    </section>
  );
}
