import type { Repository, Session } from '../../types';
import { buildGitHubCompareUrl } from '../../utils/repoUtils';
import { postTelemetryEvent } from '../../services/api';
import Badge from '../Badge';
import LaunchDropdown from '../LaunchDropdown/LaunchDropdown';
import SessionCard from '../SessionCard/SessionCard';

export interface RepoWithSessions extends Repository {
  sessions: Session[];
  hasHiddenSessions: boolean;
}

interface RepoCardProps {
  repo: RepoWithSessions;
  skipConfirm: boolean;
  selectedSessionId: string | null;
  isMobile: boolean;
  onRemoveById: (id: string) => void;
  onSetRemoveConfirm: (id: string) => void;
  onSelectSession: (id: string) => void;
}

export default function RepoCard({
  repo, skipConfirm, selectedSessionId, isMobile,
  onRemoveById, onSetRemoveConfirm, onSelectSession,
}: RepoCardProps) {
  return (
    <div data-tour-id="dashboard-repo-card" className="bg-white rounded-lg shadow p-4 md:p-6">
      <div className="mb-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg md:text-xl font-semibold text-gray-900">{repo.name}</h2>
          <div className="flex items-center gap-2">
            <Badge>
              {repo.sessions.length} session{repo.sessions.length !== 1 ? 's' : ''}
            </Badge>
            <LaunchDropdown repoPath={repo.path} />
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                if (skipConfirm) {
                  onRemoveById(repo.id);
                } else {
                  onSetRemoveConfirm(repo.id);
                }
              }}
              aria-label={`Remove repository ${repo.name}`}
              title="Remove repository"
              className="icon-btn text-gray-500 hover:text-red-500"
            >
              <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <p className="text-xs text-gray-500 font-mono truncate max-w-full">{repo.path}</p>
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
              <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          )}
        </div>
      </div>
      {repo.sessions.length === 0 ? (
        <p className="text-gray-500 text-sm">
          {repo.hasHiddenSessions ? 'No active sessions' : 'No sessions'}
        </p>
      ) : (
        <div data-tour-id="dashboard-session-card" className="space-y-2">
          {repo.sessions.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              selected={!isMobile && selectedSessionId === session.id}
              onSelect={onSelectSession}
            />
          ))}
        </div>
      )}
    </div>
  );
}
