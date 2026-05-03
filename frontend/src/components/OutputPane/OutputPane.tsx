import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getSessionOutput, postTelemetryEvent } from '../../services/api';
import type { Session, Repository } from '../../types';
import { useSettings } from '../../hooks/useSettings';
import SessionDetail from '../SessionDetail/SessionDetail';
import { Button } from '../Button';
import { buildGitHubCompareUrl } from '../../utils/repoUtils';
import { GitCompare } from 'lucide-react';

interface Props {
  session: Session;
  repo?: Repository;
  onClose?: () => void;
  className?: string;
  'data-tour-id'?: string;
}

export default function OutputPane({ session, repo, onClose, className, 'data-tour-id': dataTourId }: Props) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const pinnedToBottom = useRef(true);
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

  // Scroll to bottom on new data only when pinned.
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (el && pinnedToBottom.current) el.scrollTop = el.scrollHeight;
  }, [data]);

  // Track whether the user is scrolled near the bottom (within 8px = pinned).
  function handleScroll() {
    const el = scrollContainerRef.current;
    if (!el) return;
    pinnedToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 8;
  }

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
        <div className="flex flex-col min-w-0">
          {repo ? (
            <>
              <span className="text-xs font-semibold text-gray-900 truncate">{repo.name}</span>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <p className="text-xs text-gray-500 font-mono truncate" title={repo.path}>{repo.path}</p>
                {repo.branch && (
                  <span className="inline-flex items-center gap-1 text-xs font-mono text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                    ⎇ {repo.branch}
                  </span>
                )}
                {buildGitHubCompareUrl(repo.remoteUrl, repo.branch) && (
                  <a
                    href={buildGitHubCompareUrl(repo.remoteUrl, repo.branch)!}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="View diff on GitHub"
                    aria-label="View diff on GitHub"
                    className="inline-flex items-center text-gray-400 hover:text-gray-700"
                    onClick={e => { e.stopPropagation(); postTelemetryEvent('repo_diff_opened'); }}
                  >
                    <GitCompare size={14} aria-hidden="true" />
                  </a>
                )}
              </div>
            </>
          ) : null}
          <span className="font-mono text-[10px] text-gray-400 truncate">{session.id}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleMode}
            aria-label={displayMode === 'focused' ? 'Focused' : 'Verbose'}
            title={displayMode === 'focused' ? 'Switch to verbose mode' : 'Switch to focused mode'}
          >
            {displayMode === 'focused' ? 'Focused' : 'Verbose'}
          </Button>
          {onClose && (
            <button
              onClick={onClose}
              aria-label="Close output pane"
              className="icon-btn text-gray-500 hover:text-blue-600"
            >
              <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
      <div ref={scrollContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto rounded-b-lg scroll-hover">
        {isError ? (
          <p className="p-6 text-center text-sm text-red-600">Failed to load output. Is the server running?</p>
        ) : (
          <>
            <SessionDetail sessionId={session.id} items={data?.items ?? []} dark displayMode={displayMode} className="max-h-none pb-0" />
          </>
        )}
      </div>
    </section>
  );
}
