import { useEffect, useState } from 'react';
import { apiFetch } from '../../services/api';

interface FsEntry {
  name: string;
  path: string;
  isGitRepo: boolean;
}

interface BrowseResult {
  current: string;
  parent: string | null;
  entries: FsEntry[];
}

interface Props {
  onSelect: (path: string) => void;
}

export function FolderBrowser({ onSelect }: Props) {
  const [data, setData] = useState<BrowseResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const navigate = async (path?: string) => {
    try {
      setError(null);
      const params = path ? `?path=${encodeURIComponent(path)}` : '';
      const result = await apiFetch<BrowseResult>(`/fs/browse${params}`);
      setData(result);
    } catch {
      setError('Cannot read directory');
    }
  };

  useEffect(() => { navigate(); }, []);

  if (!data) return <div className="folder-browser-loading">Loading…</div>;

  return (
    <div className="folder-browser">
      <div className="folder-browser-breadcrumb">
        {data.parent && (
          <button onClick={() => navigate(data.parent!)} className="folder-browser-up">
            ↑ Up
          </button>
        )}
        <span className="folder-browser-current" title={data.current}>{data.current}</span>
      </div>
      {error && <div className="folder-browser-error">{error}</div>}
      <ul className="folder-browser-list">
        {data.entries.map(entry => (
          <li key={entry.path} className="folder-browser-item">
            <button onClick={() => navigate(entry.path)} className="folder-browser-navigate">
              📁 {entry.name}
              {entry.isGitRepo && <span className="folder-browser-git-badge">git</span>}
            </button>
            {entry.isGitRepo && (
              <button onClick={() => onSelect(entry.path)} className="folder-browser-select">
                Select
              </button>
            )}
          </li>
        ))}
        {data.entries.length === 0 && (
          <li className="folder-browser-empty">No subdirectories</li>
        )}
      </ul>
      <button onClick={() => onSelect(data.current)} className="folder-browser-select-current">
        Use current folder ({data.current})
      </button>
    </div>
  );
}
