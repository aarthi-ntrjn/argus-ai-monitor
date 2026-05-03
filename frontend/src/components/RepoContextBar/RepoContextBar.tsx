import type { Repository } from '../../types';
import { buildGitHubCompareUrl } from '../../utils/repoUtils';
import { GitCompare } from 'lucide-react';
import { postTelemetryEvent } from '../../services/api';

interface Props {
  repo: Repository;
}

export default function RepoContextBar({ repo }: Props) {
  return (
    <div className="bg-white rounded-lg shadow px-3 py-2 mb-2">
      <h2 className="text-lg font-semibold text-gray-900">{repo.name}</h2>
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
            onClick={() => postTelemetryEvent('repo_diff_opened')}
          >
            <GitCompare size={14} aria-hidden="true" />
          </a>
        )}
      </div>
    </div>
  );
}
