import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getSessionOutput } from '../../services/api';
import type { Session } from '../../types';

interface Props {
  session: Session;
  onClose: () => void;
}

export default function OutputPane({ session, onClose }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data } = useQuery({
    queryKey: ['session-output', session.id],
    queryFn: () => getSessionOutput(session.id, { limit: 100 }),
    refetchInterval: 2000,
  });

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [data]);

  return (
    <section
      aria-label="Session output"
      className="flex flex-col h-full bg-gray-900 rounded-lg overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <span className="text-sm font-medium text-gray-200 truncate">
          Output — {session.id.slice(0, 8)}
        </span>
        <button
          onClick={onClose}
          aria-label="Close output pane"
          className="text-gray-400 hover:text-white transition-colors p-1 rounded"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-1 font-mono text-xs text-gray-300">
        {data?.items.length === 0 && (
          <p className="text-gray-500 italic">No output yet…</p>
        )}
        {data?.items.map(item => (
          <div key={item.id} className="whitespace-pre-wrap break-words">
            {item.toolName && (
              <span className="text-yellow-400 mr-2">[{item.toolName}]</span>
            )}
            {item.content}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </section>
  );
}
